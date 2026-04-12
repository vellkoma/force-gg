"""
FastAPI 依存性注入モジュール
アプリ起動時に初期化されたキャッシュクライアントを各ルーターに提供する
"""
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, Request

from app.cache.redis import CacheClient
from app.core.config import settings
from app.models.user import UserResponse
from app.services import auth_service
from app.services.champion import ChampionService
from app.services.match import MatchService
from app.services.riot_client import RiotClient
from app.services.summoner import SummonerService


def get_cache(request: Request) -> CacheClient:
    """
    リクエストのアプリ状態からキャッシュクライアントを取得する
    main.py の lifespan で app.state.cache に設定済みであること
    """
    return request.app.state.cache


def get_riot_client() -> RiotClient:
    """RiotClient のインスタンスを返す（設定は settings から自動取得）"""
    return RiotClient()


def get_champion_service(
    cache: Annotated[CacheClient, Depends(get_cache)],
) -> ChampionService:
    """ChampionService のインスタンスを返す"""
    return ChampionService(cache=cache)


def get_summoner_service(
    cache: Annotated[CacheClient, Depends(get_cache)],
    riot: Annotated[RiotClient, Depends(get_riot_client)],
) -> SummonerService:
    """SummonerService のインスタンスを返す"""
    return SummonerService(riot=riot, cache=cache)


def get_match_service(
    cache: Annotated[CacheClient, Depends(get_cache)],
    riot: Annotated[RiotClient, Depends(get_riot_client)],
) -> MatchService:
    """MatchService のインスタンスを返す"""
    return MatchService(riot=riot, cache=cache)


# -------------------------------------------------------------------
# 認証依存関係
# -------------------------------------------------------------------

async def get_current_user(
    authorization: Annotated[Optional[str], Header()] = None,
) -> UserResponse:
    """
    Authorization: Bearer <token> ヘッダーを検証して UserResponse を返す。
    認証が必要なエンドポイントで Depends(get_current_user) として使用する。
    無効なトークンは 401 を raise する。
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "認証が必要です")
    token = authorization.removeprefix("Bearer ").strip()
    return await auth_service.get_user_from_token(token)


async def get_optional_user(
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[UserResponse]:
    """
    認証トークンが存在すれば UserResponse を返し、なければ None を返す。
    認証任意の公開エンドポイントで Depends(get_optional_user) として使用する。
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.removeprefix("Bearer ").strip()
        return await auth_service.get_user_from_token(token)
    except HTTPException:
        return None
