"""
FastAPI 依存性注入モジュール
アプリ起動時に初期化されたキャッシュクライアントを各ルーターに提供する
"""
from typing import Annotated

from fastapi import Depends, Request

from app.cache.redis import CacheClient
from app.services.champion import ChampionService


def get_cache(request: Request) -> CacheClient:
    """
    リクエストのアプリ状態からキャッシュクライアントを取得する
    main.py の lifespan で app.state.cache に設定済みであること
    """
    return request.app.state.cache


def get_champion_service(
    cache: Annotated[CacheClient, Depends(get_cache)],
) -> ChampionService:
    """ChampionService のインスタンスを返す"""
    return ChampionService(cache=cache)
