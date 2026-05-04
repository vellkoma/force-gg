"""
日次データ更新スクリプト
- 全8リーグのスケジュールを PandaScore（→ Leaguepedia フォールバック）から取得して DB に upsert
- リーグアイコンを PandaScore から取得して img/leagues/ に保存
- チームアイコンは PandaScore CDN URL をそのまま DB に保存（ローカル保存不要）

実行: python update.py  (backend/ ディレクトリで)
推奨: タスクスケジューラー / cron で毎日早朝に実行
"""
import asyncio
import logging
import os
import sys

import aiosqlite
import httpx

sys.path.insert(0, ".")

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

PANDASCORE_API = "https://api.pandascore.co"


# ─── リーグアイコン ────────────────────────────────────────────

async def update_league_icons() -> None:
    token = settings.pandascore_api_key
    if not token:
        logger.warning("PANDASCORE_API_KEY 未設定 - リーグアイコンをスキップ")
        return

    auth = {"Authorization": f"Bearer {token}"}
    ok   = 0

    async with httpx.AsyncClient(headers=auth, timeout=15) as api:
        for league_id, cfg in LEAGUE_CONFIG.items():
            name = cfg["name"]
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

    logger.info("リーグアイコン: %d/%d 件取得", ok, len(LEAGUE_CONFIG))


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
    async with aiosqlite.connect(db._DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            "SELECT DISTINCT team1_name FROM esports_matches WHERE team1_image_url = '' OR team1_image_url IS NULL"
        ) as cur:
            names1 = [row[0] async for row in cur]
        async with conn.execute(
            "SELECT DISTINCT team2_name FROM esports_matches WHERE team2_image_url = '' OR team2_image_url IS NULL"
        ) as cur:
            names2 = [row[0] async for row in cur]

    team_names = list(set(names1 + names2))
    if not team_names:
        logger.info("  チームロゴ補完不要")
        return

    logger.info("  ロゴ未取得チーム: %d件", len(team_names))
    # Leaguepedia レートリミット回避（スケジュール取得で消費した後の回復待ち）
    await asyncio.sleep(60)
    logos = await fetch_team_logos(team_names)
    if not logos:
        logger.warning("  チームロゴ取得失敗（次回更新時に再試行）")
        return

    async with aiosqlite.connect(db._DB_PATH) as conn:
        for name, url in logos.items():
            await conn.execute(
                "UPDATE esports_matches SET team1_image_url = ? WHERE team1_name = ? AND (team1_image_url = '' OR team1_image_url IS NULL)",
                (url, name),
            )
            await conn.execute(
                "UPDATE esports_matches SET team2_image_url = ? WHERE team2_name = ? AND (team2_image_url = '' OR team2_image_url IS NULL)",
                (url, name),
            )
        await conn.commit()
    logger.info("  チームロゴ補完: %d チーム", len(logos))


# ─── メイン ───────────────────────────────────────────────────

async def main() -> None:
    logger.info("=== force.gg 日次更新 開始 ===")

    await db.init_db()

    # リーグアイコン
    logger.info("--- リーグアイコン更新 ---")
    await update_league_icons()

    # スケジュール（Leaguepediaフォールバック後は長めに待機）
    logger.info("--- スケジュール更新 ---")
    total = 0
    for league_id, cfg in LEAGUE_CONFIG.items():
        count, source = await update_league_schedule(league_id, cfg)
        total += count
        # Leaguepediaを使った後は30秒待機してレートリミット回避
        wait = 30 if source == "leaguepedia" else 2
        await asyncio.sleep(wait)

    # チームロゴ補完（全リーグまとめて取得でレートリミット回避）
    logger.info("--- チームロゴ補完 ---")
    await update_team_logos()

    logger.info("=== 完了: スケジュール合計 %d 件 ===", total)


if __name__ == "__main__":
    asyncio.run(main())
