"""
FastAPI アプリケーションエントリポイント
CORS設定・ライフサイクル管理・ルーター登録を行う
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.cache.redis import CacheClient
from app.core.config import settings
from app.routers import auth, champion, coaching, esports, match, stripe, summoner
from app.services import esports_db
from app.services.esports_status import status_check_loop

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
# httpx のリクエストログを抑制（ノイズ対策）
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    アプリ起動・終了時のライフサイクル管理
    起動時: Redisに接続（失敗時はインメモリキャッシュにフォールバック）
    終了時: Redis接続をクリーンアップ
    """
    logger.info("バックエンドサーバーを起動しています...")

    cache = CacheClient(redis_url=settings.redis_url)
    await cache.connect()
    app.state.cache = cache

    logger.info("キャッシュバックエンド: %s", cache.backend)

    # Esports DB 初期化 + 試合中ステータス監視タスク起動
    await esports_db.init_db()
    status_task = asyncio.create_task(status_check_loop())
    app.state.status_task = status_task

    yield  # アプリ実行中

    logger.info("バックエンドサーバーをシャットダウンしています...")
    status_task.cancel()
    await cache.disconnect()


import os
os.makedirs("img/leagues", exist_ok=True)
os.makedirs("img/teams",   exist_ok=True)

app = FastAPI(
    title="force.gg API",
    description=(
        "Backend API for force.gg. "
        "Powered by Riot Games API / Data Dragon."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.mount("/img", StaticFiles(directory="img"), name="img")

# -------------------------------------------------------------------
# CORS設定
# フロントエンド (localhost:5173) からのリクエストを許可
# 本番環境では CORS_ORIGINS 環境変数で制御する
# -------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# ルーター登録
# -------------------------------------------------------------------
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(champion.router)
app.include_router(summoner.router)
app.include_router(match.router)
app.include_router(stripe.router)
app.include_router(coaching.router)
app.include_router(esports.router)


@app.get("/", tags=["health"])
async def root() -> dict:
    """ヘルスチェック用エンドポイント"""
    return {
        "status": "ok",
        "service": "force.gg API",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """詳細ヘルスチェック（キャッシュバックエンド情報付き）"""
    cache: CacheClient = app.state.cache
    return {
        "status": "ok",
        "cache_backend": cache.backend,
    }
