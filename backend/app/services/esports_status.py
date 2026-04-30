"""
試合ステータス監視ループ
DB の begin_at を元に not_started / running / finished を自動更新する。
外部APIは叩かない。スケジュール取得は update.py に任せる。
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

import aiosqlite

from app.core.config import settings

logger  = logging.getLogger(__name__)
_CHECK_INTERVAL = 60  # 秒（1分ごとにステータスを再評価）


async def _refresh_statuses() -> int:
    """begin_at と現在時刻を比較してステータスを更新。変更件数を返す"""
    now     = datetime.now(timezone.utc)
    updated = 0

    async with aiosqlite.connect(settings.esports_db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, begin_at, status FROM esports_matches "
            "WHERE status IN ('not_started', 'running')"
        ) as cur:
            rows = [dict(r) async for r in cur]

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
                # 4時間経過しても finished に変わっていない = データ未更新
                # ステータスはそのまま（update.py が正しい結果で上書きする）
                continue

            if new != old:
                await db.execute(
                    "UPDATE esports_matches SET status = ? WHERE id = ?",
                    (new, row["id"]),
                )
                updated += 1

        if updated:
            await db.commit()

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
