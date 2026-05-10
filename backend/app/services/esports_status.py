"""
試合ステータス監視ループ
DB の begin_at を元に not_started / running / finished を自動更新する。
外部APIは叩かない。スケジュール取得は update.py に任せる。
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.services import esports_db as db

logger  = logging.getLogger(__name__)
_CHECK_INTERVAL = 60  # 秒（1分ごとにステータスを再評価）


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
