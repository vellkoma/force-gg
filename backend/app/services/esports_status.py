"""
試合ステータス監視ループ
- status_check_loop: DB の begin_at を元に not_started / running を1分ごとに更新（外部API不使用）
- live_refresh_loop: PandaScore から running / 直近終了試合を1時間ごとに取得してDB更新
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.services import esports_db as db
from app.services import pandascore as ps
from app.services.esports_sync import LEAGUE_CONFIG

logger  = logging.getLogger(__name__)
_CHECK_INTERVAL  = 60    # 秒（1分ごとにステータスを再評価）
_REFRESH_INTERVAL = 3600  # 秒（1時間ごとにPandaScoreからlive/結果を取得）


async def _refresh_statuses() -> int:
    """begin_at と現在時刻を比較してステータスを更新。変更件数を返す"""
    now     = datetime.now(timezone.utc)
    updated = 0

    pool = db._pool_or_raise()
    rows = await pool.fetch(
        "SELECT id, begin_at, status FROM esports_matches "
        "WHERE status IN ('not_started', 'running')"
    )

    updates: list[tuple[str, int]] = []
    for row in rows:
        try:
            begin = datetime.fromisoformat(row["begin_at"])
            if begin.tzinfo is None:
                begin = begin.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        old = row["status"]
        if begin > now + timedelta(minutes=10):
            new = "not_started"
        elif now - begin < timedelta(hours=4):
            new = "running"
        else:
            continue

        if new != old:
            updates.append((new, row["id"]))

    if updates:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.executemany(
                    "UPDATE esports_matches SET status = $1 WHERE id = $2",
                    updates,
                )
        updated = len(updates)

    return updated


async def status_check_loop() -> None:
    """サーバー起動中ずっと1分ごとにステータスを更新し続ける"""
    logger.info("試合ステータス監視ループ 開始（%d秒間隔）", _CHECK_INTERVAL)
    while True:
        try:
            n = await _refresh_statuses()
            if n:
                logger.info("ステータス更新: %d 件", n)
        except Exception as e:
            logger.warning("ステータス更新エラー: %s", e)
        await asyncio.sleep(_CHECK_INTERVAL)


async def live_refresh_loop() -> None:
    """
    1時間ごとに PandaScore から running / 直近終了試合を取得して DB を更新する。
    begin_at ベースのステータス推定では finish を検出できないため、
    このループで実際の試合結果・スコアを反映する。
    """
    logger.info("Live試合リフレッシュループ 開始（%d秒間隔）", _REFRESH_INTERVAL)
    # 起動直後に1回実行してから1時間待つ
    await asyncio.sleep(30)  # 起動直後は他の初期化を待つ
    while True:
        total = 0
        for our_league_id, config in LEAGUE_CONFIG.items():
            try:
                matches = await ps.fetch_live_and_recent(config["name"], our_league_id)
                if matches:
                    await db.upsert_matches(matches)
                    total += len(matches)
            except Exception as e:
                logger.warning("live_refresh エラー (%s): %s", config["name"], e)
            await asyncio.sleep(2)  # リーグ間でAPI呼び出しを少し間隔を空ける
        if total:
            logger.info("Live試合リフレッシュ完了: %d 件更新", total)
        await asyncio.sleep(_REFRESH_INTERVAL)
