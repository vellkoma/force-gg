"""
PostgreSQL 接続プール管理（asyncpg）

DATABASE_URL が設定されていない場合はインメモリモードにフォールバックする。
これにより Redis なし・PostgreSQL なしの開発環境でもサーバーが起動できる。
"""
import logging
from typing import Optional

import asyncpg

from app.core.config import settings

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def init() -> bool:
    """
    DBプールを初期化してテーブルを作成する。
    DATABASE_URL が空 / 接続失敗の場合は False を返し、インメモリにフォールバックする。
    """
    global _pool
    if not settings.database_url:
        logger.info("DATABASE_URL 未設定 → インメモリDBで動作します")
        return False

    # Railway は "postgres://" を返す場合があるので修正する
    dsn = settings.database_url.replace("postgres://", "postgresql://", 1)

    try:
        _pool = await asyncpg.create_pool(
            dsn,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        await _create_tables()
        logger.info("PostgreSQL 接続成功")
        return True
    except Exception as exc:
        logger.error("PostgreSQL 接続失敗: %s → インメモリDBで動作します", exc)
        _pool = None
        return False


async def close() -> None:
    """アプリ終了時にプールをクローズする"""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> Optional[asyncpg.Pool]:
    return _pool


def is_connected() -> bool:
    return _pool is not None


async def _create_tables() -> None:
    """users テーブルを作成する（存在しない場合のみ）"""
    assert _pool is not None
    async with _pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id                    TEXT PRIMARY KEY,
                email                 TEXT UNIQUE NOT NULL,
                name                  TEXT NOT NULL,
                avatar                TEXT,
                provider              TEXT NOT NULL DEFAULT 'email',
                hashed_password       TEXT,
                is_premium            BOOLEAN NOT NULL DEFAULT FALSE,
                premium_expires_at    TIMESTAMPTZ,
                stripe_customer_id    TEXT,
                stripe_subscription_id TEXT,
                created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_stripe_customer "
            "ON users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL"
        )
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token      TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
