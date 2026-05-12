"""
日次データ更新スクリプト
- 全8リーグのスケジュールを PandaScore（→ Leaguepedia フォールバック）から取得して DB に upsert
- リーグアイコンを PandaScore から取得して DB に保存
- チームアイコンは PandaScore CDN URL をそのまま DB に保存（ローカル保存不要）

オプション:
  -S, --skip-schedule       スケジュール・リーグアイコン・チームロゴの取得をスキップ
  -s, --skip-champion-stats チャンピオン統計集計をスキップ
  -c, --champion-stats-only チャンピオン統計集計のみ実行（-S の短縮形）
  -r, --rank RANK           収集するランク帯（デフォルト: CHALLENGER）
                            選択肢: CHALLENGER / GRANDMASTER / MASTER /
                                    DIAMOND / EMERALD / PLATINUM / GOLD /
                                    SILVER / BRONZE / IRON
                            ※ DIAMOND 以下は本番 API キーが必要（開発キーは 403）
  --rank-all                全ランク帯を順番に収集（-r より優先）
                            ※ DIAMOND 以下は本番 API キーが必要
  -p, --patch PATCH         収集対象パッチ（例: 16.9）。省略時は最新パッチ
                            指定すると該当パッチのマッチのみ集計してDBに保存

実行例:
  python update.py                          # すべて実行（チャレンジャーデータ・最新パッチ）
  python update.py -c                       # チャンピオン統計のみ（チャレンジャー・最新パッチ）
  python update.py -c -r GOLD              # チャンピオン統計のみ（ゴールド帯）
  python update.py -c -r PLATINUM          # チャンピオン統計のみ（プラチナ帯）
  python update.py -c -p 16.9              # チャンピオン統計のみ（パッチ 16.9 指定）
  python update.py -c -r GOLD -p 16.9     # ゴールド帯 × パッチ 16.9 指定
  python update.py -c --rank-all           # 全ランク帯・最新パッチ
  python update.py -c --rank-all -p 16.9  # 全ランク帯 × パッチ 16.9 指定
  python update.py -S                       # スケジュール・アイコンのみ（統計スキップ）
  python update.py -s                       # スケジュール・アイコンのみ（統計スキップ）
  python update.py -s -r DIAMOND           # スケジュール更新 + ダイヤ帯統計集計

推奨: タスクスケジューラー / cron で毎日早朝に実行
"""
import argparse
import asyncio
import logging
import sys

import httpx

sys.path.insert(0, ".")

# settings より先に .env を読み込む（pydantic-settings が環境変数を参照する前に設定する）
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

from app.core.config import settings
from app.services import esports_db as db
from app.services import pandascore as ps
from app.services.esports_sync import LEAGUE_CONFIG, _parse_match
from app.services.leaguepedia import fetch_schedule, fetch_schedule_from_scoreboard, fetch_team_logos
from app.services.champion_stats_aggregator import collect_and_store_stats
from app.services.riot_client import RiotClient

PANDASCORE_API = "https://api.pandascore.co"


# ─── リーグアイコン ────────────────────────────────────────────

async def update_league_icons() -> None:
    token = settings.pandascore_api_key
    if not token:
        logger.warning("PANDASCORE_API_KEY 未設定 - リーグアイコンをスキップ")
        return

    # 既存アイコンを確認し、不足しているリーグのみ取得
    existing = await db.get_league_icons()
    all_names = [cfg["name"] for cfg in LEAGUE_CONFIG.values()]
    missing = [name for name in all_names if name not in existing]

    if not missing:
        logger.info("リーグアイコン: 全 %d 件取得済み - スキップ", len(all_names))
        return

    logger.info("リーグアイコン: %d 件未取得 → 取得開始", len(missing))
    auth = {"Authorization": f"Bearer {token}"}
    ok   = 0

    async with httpx.AsyncClient(headers=auth, timeout=15) as api:
        for name in missing:
            try:
                r = await api.get(f"{PANDASCORE_API}/lol/leagues",
                                  params={"search[name]": name, "per_page": "5"})
                r.raise_for_status()
                img_url = None
                for lg in r.json():
                    if name.lower() in (lg.get("name") or "").lower():
                        img_url = lg.get("image_url")
                        break

                if img_url:
                    await db.upsert_league_icon(name, img_url)
                    logger.info("  リーグアイコン: %s → DB保存", name)
                    ok += 1
                else:
                    logger.warning("  リーグアイコン未検出: %s", name)

            except Exception as e:
                logger.warning("  リーグアイコンエラー (%s): %s", name, e)
            await asyncio.sleep(0.3)

    logger.info("リーグアイコン: %d/%d 件取得", ok, len(missing))


# ─── スケジュール ──────────────────────────────────────────────

async def update_league_schedule(league_id: int, cfg: dict) -> int:
    name  = cfg["name"]
    wiki  = cfg["wiki"]

    # PandaScore 優先（最新試合が1年以上前なら古いデータとみなしてスキップ）
    from datetime import datetime, timedelta, timezone
    matches = await ps.fetch_schedule(name, league_id)
    if matches:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
        newest_begin = max(m["begin_at"] for m in matches)
        if newest_begin < cutoff:
            logger.info("  PandaScore データが古すぎる (%s) → スキップ: %s", newest_begin[:10], name)
            matches = []

    # Leaguepedia フォールバック
    if not matches:
        logger.info("  PandaScore にデータなし → Leaguepedia フォールバック: %s", name)
        from datetime import datetime, timezone
        dt_now = datetime.now(timezone.utc)
        season = "Spring" if dt_now.month <= 6 else "Summer"

        for try_year in (dt_now.year, dt_now.year - 1):
            rows = await fetch_schedule(wiki, try_year, season)
            if not rows:
                rows = await fetch_schedule_from_scoreboard(wiki, try_year)
            matches = [m for m in (_parse_match(r, league_id) for r in rows) if m]
            if matches:
                logger.info("  %s: %d年データ取得", name, try_year)
                break

    if not matches:
        logger.info("  %s: データなし", name)
        return 0, "none"

    await db.upsert_matches(matches)
    await db.update_sync_log(league_id)
    source = matches[0].get("source", "leaguepedia")
    logger.info("  %s: %d 件 upsert (source=%s)", name, len(matches), source)
    return len(matches), source


# ─── チームロゴ補完 ────────────────────────────────────────────

async def update_team_logos() -> None:
    """DBのチームアイコンが空のレコードをLeaguepediaから一括補完する"""
    team_names = await db.get_teams_missing_logos()
    if not team_names:
        logger.info("  チームロゴ補完不要")
        return

    logger.info("  ロゴ未取得チーム: %d件", len(team_names))
    # Leaguepedia レートリミット回避（スケジュール取得で消費した後の回復待ち）
    await asyncio.sleep(300)
    logos = await fetch_team_logos(team_names)
    if not logos:
        logger.warning("  チームロゴ取得失敗（次回更新時に再試行）")
        return

    await db.bulk_update_team_logos(logos)
    logger.info("  チームロゴ補完: %d チーム", len(logos))


# ─── メイン ───────────────────────────────────────────────────

_ALL_RANKS = ["CHALLENGER","GRANDMASTER","MASTER","DIAMOND","EMERALD","PLATINUM","GOLD","SILVER","BRONZE","IRON"]


async def main(skip_schedule: bool = False, skip_champion_stats: bool = False, rank_group: str = "CHALLENGER", patch: str | None = None, rank_all: bool = False) -> None:
    logger.info("=== force.gg 日次更新 開始 ===")

    await db.init_db()

    total = 0

    if not skip_schedule:
        # リーグアイコン
        logger.info("--- リーグアイコン更新 ---")
        await update_league_icons()

        # スケジュール（LEAGUE_CONFIG の順番通り：PandaScoreリーグ → Leaguepediaリーグ）
        logger.info("--- スケジュール更新 ---")
        for league_id, cfg in LEAGUE_CONFIG.items():
            count, source = await update_league_schedule(league_id, cfg)
            total += count
            # Leaguepedia使用後は300秒待機してレートリミット回復を待つ
            wait = 300 if source == "leaguepedia" else 2
            if wait > 2:
                logger.info("  Leaguepedia レートリミット回避: %d秒待機", wait)
            await asyncio.sleep(wait)

        # チームロゴ補完（全リーグまとめて取得でレートリミット回避）
        logger.info("--- チームロゴ補完 ---")
        await update_team_logos()
    else:
        logger.info("--- スケジュール・アイコン更新 スキップ ---")

    if not skip_champion_stats:
        # チャンピオン統計集計（Riot APIキーが設定されている場合のみ）
        logger.info("--- チャンピオン統計集計 ---")
        if settings.riot_api_key:
            riot = RiotClient()
            ranks_to_collect = _ALL_RANKS if rank_all else [rank_group]
            for rg in ranks_to_collect:
                await collect_and_store_stats(riot, rg, patch)
        else:
            logger.warning("RIOT_API_KEY 未設定 - チャンピオン統計集計をスキップ")
    else:
        logger.info("--- チャンピオン統計集計 スキップ ---")

    logger.info("=== 完了: スケジュール合計 %d 件 ===", total)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="force.gg 日次データ更新")
    parser.add_argument(
        "-S", "--skip-schedule",
        action="store_true",
        help="スケジュール・リーグアイコン・チームロゴの取得をスキップ",
    )
    parser.add_argument(
        "-s", "--skip-champion-stats",
        action="store_true",
        help="チャンピオン統計集計をスキップ",
    )
    parser.add_argument(
        "-c", "--champion-stats-only",
        action="store_true",
        help="チャンピオン統計集計のみ実行",
    )
    parser.add_argument(
        "-r", "--rank",
        default="CHALLENGER",
        choices=["CHALLENGER","GRANDMASTER","MASTER","DIAMOND","EMERALD","PLATINUM","GOLD","SILVER","BRONZE","IRON"],
        help="収集するランク帯（デフォルト: CHALLENGER）",
    )
    parser.add_argument(
        "-p", "--patch",
        default=None,
        help="収集対象パッチ（例: 16.9）。省略時は最新パッチ",
    )
    parser.add_argument(
        "--rank-all",
        action="store_true",
        help="全ランク帯を順番に収集（DIAMOND以下は本番APIキーが必要）",
    )
    args = parser.parse_args()

    skip_schedule = args.skip_schedule or args.champion_stats_only
    skip_champion_stats = args.skip_champion_stats

    async def _run_and_close() -> None:
        await main(skip_schedule=skip_schedule, skip_champion_stats=skip_champion_stats, rank_group=args.rank, patch=args.patch, rank_all=args.rank_all)
        await db.close_db()

    asyncio.run(_run_and_close())
