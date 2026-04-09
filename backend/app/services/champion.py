"""
チャンピオンサービス
Data Dragon API からチャンピオンデータを取得・加工する
"""
import logging
from typing import Optional

import httpx
from fastapi import HTTPException

from app.cache.redis import CacheClient
from app.core.config import settings
from app.models.champion import ChampionDetail, ChampionListResponse, ChampionStats, ChampionSummary

logger = logging.getLogger(__name__)

CACHE_KEY_VERSION = "ddragon:version"
CACHE_KEY_CHAMPIONS = "ddragon:champions:{version}"
CACHE_KEY_CHAMPION_DETAIL = "ddragon:champion:{version}:{champion_id}"

# バージョン情報のTTL（1時間）
VERSION_TTL = 3600


class ChampionService:
    """
    Data Dragon API ラッパー
    バージョン自動取得 + 日本語データ取得 + Redisキャッシュを担当
    """

    def __init__(self, cache: CacheClient) -> None:
        self._cache = cache
        self._base = settings.ddragon_base_url

    async def _fetch_json(self, url: str) -> dict | list:
        """httpx.AsyncClient で GETリクエストを送り JSON を返す"""
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.json()
            except httpx.TimeoutException:
                raise HTTPException(
                    status_code=504,
                    detail="Data Dragonへの接続がタイムアウトしました",
                )
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Data Dragon APIエラー: ステータス {e.response.status_code}",
                )
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=503,
                    detail=f"Data Dragon APIへの接続に失敗しました: {str(e)}",
                )

    async def get_latest_version(self) -> str:
        """Data Dragon の最新バージョンを取得する（キャッシュ付き）"""
        cached = await self._cache.get(CACHE_KEY_VERSION)
        if cached:
            return str(cached)

        url = f"{self._base}/api/versions.json"
        versions: list = await self._fetch_json(url)  # type: ignore[assignment]

        if not versions or not isinstance(versions, list):
            raise HTTPException(
                status_code=502,
                detail="Data Dragonからバージョン情報を取得できませんでした",
            )

        latest: str = versions[0]
        await self._cache.set(CACHE_KEY_VERSION, latest, VERSION_TTL)
        logger.info("Data Dragon 最新バージョン: %s", latest)
        return latest

    def _build_image_url(self, version: str, image_name: str) -> str:
        return f"{self._base}/cdn/{version}/img/champion/{image_name}"

    def _parse_champion_summary(self, version: str, raw: dict) -> ChampionSummary:
        """Data Dragon の生データから ChampionSummary を生成する"""
        return ChampionSummary(
            id=raw["id"],
            key=raw["key"],
            name=raw["name"],
            title=raw["title"],
            image_url=self._build_image_url(version, raw["image"]["full"]),
            tags=raw.get("tags", []),
        )

    def _parse_champion_detail(self, version: str, raw: dict) -> ChampionDetail:
        """Data Dragon の生データから ChampionDetail を生成する"""
        try:
            stats = ChampionStats.model_validate(raw["stats"])
        except Exception as e:
            logger.warning("チャンピオンスペック解析エラー [%s]: %s", raw.get("id"), str(e))
            raise HTTPException(
                status_code=502,
                detail="チャンピオンスペックデータの解析に失敗しました",
            )

        return ChampionDetail(
            id=raw["id"],
            key=raw["key"],
            name=raw["name"],
            title=raw["title"],
            image_url=self._build_image_url(version, raw["image"]["full"]),
            tags=raw.get("tags", []),
            blurb=raw.get("blurb", ""),
            stats=stats,
            partype=raw.get("partype", ""),
        )

    async def get_all_champions(self) -> ChampionListResponse:
        """
        全チャンピオン一覧を取得する
        キャッシュに存在する場合はそちらを返す
        """
        version = await self.get_latest_version()
        cache_key = CACHE_KEY_CHAMPIONS.format(version=version)

        cached = await self._cache.get(cache_key)
        if cached and isinstance(cached, dict):
            # キャッシュヒット: モデルに再変換して返す
            champions = [ChampionSummary.model_validate(c) for c in cached["champions"]]
            return ChampionListResponse(
                version=cached["version"],
                total=cached["total"],
                champions=champions,
            )

        # キャッシュミス: Data Dragon から取得
        url = f"{self._base}/cdn/{version}/data/ja_JP/champion.json"
        data: dict = await self._fetch_json(url)  # type: ignore[assignment]

        if "data" not in data:
            raise HTTPException(
                status_code=502,
                detail="Data Dragonからチャンピオンデータを取得できませんでした",
            )

        champions = sorted(
            [
                self._parse_champion_summary(version, champ)
                for champ in data["data"].values()
            ],
            key=lambda c: c.name,  # 日本語名で昇順ソート
        )

        response = ChampionListResponse(
            version=version,
            total=len(champions),
            champions=champions,
        )

        # キャッシュに保存（JSON シリアライズ可能な dict に変換）
        await self._cache.set(
            cache_key,
            response.model_dump(),
            settings.cache_ttl_champion_list,
        )
        logger.info("チャンピオン一覧をキャッシュに保存: %d件 (version=%s)", len(champions), version)

        return response

    async def get_champion_by_id(self, champion_id: str) -> ChampionDetail:
        """
        単体チャンピオン詳細を取得する
        champion_id は英語ID（例: Aatrox）またはキー数値文字列
        """
        version = await self.get_latest_version()
        cache_key = CACHE_KEY_CHAMPION_DETAIL.format(version=version, champion_id=champion_id)

        cached = await self._cache.get(cache_key)
        if cached and isinstance(cached, dict):
            return ChampionDetail.model_validate(cached)

        # Data Dragon は単体チャンピオン取得も可能（詳細版）
        url = f"{self._base}/cdn/{version}/data/ja_JP/champion/{champion_id}.json"
        data: dict = await self._fetch_json(url)  # type: ignore[assignment]

        if "data" not in data or champion_id not in data["data"]:
            raise HTTPException(
                status_code=404,
                detail=f"チャンピオン '{champion_id}' が見つかりません",
            )

        raw = data["data"][champion_id]
        detail = self._parse_champion_detail(version, raw)

        await self._cache.set(
            cache_key,
            detail.model_dump(),
            settings.cache_ttl_champion_detail,
        )

        return detail
