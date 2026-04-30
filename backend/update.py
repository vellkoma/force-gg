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
from app.services.leaguepedia import fetch_schedule, fetch_schedule_from_scoreboard

PANDASCORE_API = "https://api.pandascore.co"


# ─── リーグアイコン ────────────────────────────────────────────

async def update_league_icons() -> None:
    os.makedirs("img/leagues", exist_ok=True)
    token = settings.pandascore_api_key
    if not token:
        logger.warning("PANDASCORE_API_KEY 未設定 - リーグアイコンをスキップ")
        return

    auth    = {"Authorization": f"Bearer {token}"}
    ok      = 0

    async with (
        httpx.AsyncClient(headers=auth, timeout=15) as api,
        httpx.AsyncClient(timeout=15) as dl,
    ):
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
                    ri = await dl.get(img_url, follow_redirects=True)
                    if ri.status_code == 200 and len(ri.content) > 200:
                        ct  = ri.headers.get("content-type", "")
                        ext = ".webp" if "webp" in ct else (".jpg" if "jpeg" in ct else ".png")
                        path = f"img/leagues/{name}{ext}"
                        with open(path, "wb") as f:
                            f.write(ri.content)
                        logger.info("  リーグアイコン: %s → %s (%dKB)", name, path, len(ri.content) // 1024)
                        ok += 1
                    else:
                        logger.warning("  リーグアイコン DL 失敗: %s status=%d", name, ri.status_code)
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

    # PandaScore 優先
    matches = await ps.fetch_schedule(name, league_id)

    # Leaguepedia フォールバック
    if not matches:
        logger.info("  PandaScore にデータなし → Leaguepedia フォールバック: %s", name)
        from datetime import datetime, timezone
        dt_now = datetime.now(timezone.utc)
        season = "Spring" if dt_now.month <= 6 else "Summer"

        rows = await fetch_schedule(wiki, dt_now.year, season)
        if not rows:
            rows = await fetch_schedule_from_scoreboard(wiki, dt_now.year)
        matches = [m for m in (_parse_match(r, league_id) for r in rows) if m]

    if not matches:
        logger.info("  %s: データなし", name)
        return 0

    await db.upsert_matches(matches)
    await db.update_sync_log(league_id)
    source = matches[0].get("source", "leaguepedia")
    logger.info("  %s: %d 件 upsert (source=%s)", name, len(matches), source)
    return len(matches)


# ─── メイン ───────────────────────────────────────────────────

async def main() -> None:
    logger.info("=== force.gg 日次更新 開始 ===")

    await db.init_db()

    # リーグアイコン
    logger.info("--- リーグアイコン更新 ---")
    await update_league_icons()

    # スケジュール（リーグ間 1 秒待機）
    logger.info("--- スケジュール更新 ---")
    total = 0
    for league_id, cfg in LEAGUE_CONFIG.items():
        count = await update_league_schedule(league_id, cfg)
        total += count
        await asyncio.sleep(1)

    logger.info("=== 完了: スケジュール合計 %d 件 ===", total)


if __name__ == "__main__":
    asyncio.run(main())
