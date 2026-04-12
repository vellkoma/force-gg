"""
チャンピオンサービス
Data Dragon API からチャンピオンデータを取得・加工する
"""
import asyncio
import logging
import re
from typing import Optional

import httpx
from fastapi import HTTPException

from app.cache.redis import CacheClient
from app.core.config import settings
from app.models.build import BuildRecommendation, ItemInfo, RuneInfo
from app.models.champion import ChampionDetail, ChampionListResponse, ChampionStats, ChampionSummary

logger = logging.getLogger(__name__)

CACHE_KEY_VERSION = "ddragon:version"
CACHE_KEY_CHAMPIONS = "ddragon:champions:{version}"
CACHE_KEY_CHAMPION_DETAIL = "ddragon:champion:{version}:{champion_id}"
CACHE_KEY_CHAMPION_BUILDS = "champion_builds:{version}:{champion_id}"

# バージョン情報のTTL（1時間）
VERSION_TTL = 3600

# タグ別コアアイテムID定義（Data Dragon item.json に存在する実アイテムID）
# ロールごとにおすすめアイテムIDを5件まで指定する
_TAG_ITEM_IDS: dict[str, list[int]] = {
    "Fighter":   [3078, 3071, 3053, 3748, 6632],   # トリフォ, ブラッドサースター, スティールキャップ, タイタンズ, ドラゴンクロー
    "Tank":      [3068, 3083, 3143, 3065, 3082],    # サンファイア, ウォームグ, ランデュイン, スピリットビサージュ, フローズンハート
    "Mage":      [3089, 3135, 3157, 3165, 3040],    # ラバドン, ヴォイドスタッフ, ゾーニャ, モレロ, セラフ
    "Assassin":  [3142, 6692, 3814, 3147, 6676],    # ヨウムー, セリルダ, エッジオブナイト, ハイドラ, メジャイ
    "Marksman":  [6672, 3031, 3036, 3094, 3087],    # クラーケン, IE, モータルリマインダー, ラピッドファイア, スタティック
    "Support":   [3190, 3109, 2065, 3050, 3107],    # ルーデンサポ, ナイトの誓い, ライラ, ザズィラン, リデンプション
    "default":   [3078, 3031, 3089, 3068, 3190],    # フォールバック
}

# タグ別プライマリルーンスタイルIndex（runesReforged.json の配列順）
# 0: Precision, 1: Domination, 2: Sorcery, 3: Resolve, 4: Inspiration
_TAG_PRIMARY_STYLE_IDX: dict[str, int] = {
    "Fighter":   0,  # Precision
    "Tank":      3,  # Resolve
    "Mage":      2,  # Sorcery
    "Assassin":  1,  # Domination
    "Marksman":  0,  # Precision
    "Support":   3,  # Resolve
    "default":   0,
}

# タグ別セカンダリルーンスタイルIndex
_TAG_SECONDARY_STYLE_IDX: dict[str, int] = {
    "Fighter":   3,  # Resolve
    "Tank":      0,  # Precision
    "Mage":      4,  # Inspiration
    "Assassin":  2,  # Sorcery
    "Marksman":  4,  # Inspiration
    "Support":   2,  # Sorcery
    "default":   2,
}


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

    # ------------------------------------------------------------------
    # ビルド推奨
    # ------------------------------------------------------------------

    @staticmethod
    def _strip_html(text: str) -> str:
        """HTMLタグと改行を除去してプレーンテキストに変換する"""
        return re.sub(r"<[^>]+>", "", text).replace("\n", " ").strip()

    def _resolve_tag(self, tags: list[str]) -> str:
        """チャンピオンタグリストからマッピングキーを決定する（先頭タグ優先）"""
        for tag in tags:
            if tag in _TAG_ITEM_IDS:
                return tag
        return "default"

    async def _fetch_items(self, version: str) -> dict:
        """Data Dragon item.json を取得して {itemId: raw_item} の辞書を返す"""
        url = f"{self._base}/cdn/{version}/data/ja_JP/item.json"
        data: dict = await self._fetch_json(url)  # type: ignore[assignment]
        if "data" not in data:
            raise HTTPException(
                status_code=502,
                detail="Data Dragonからアイテムデータを取得できませんでした",
            )
        return data["data"]

    async def _fetch_runes(self, version: str) -> list:
        """Data Dragon runesReforged.json を取得してスタイルリストを返す"""
        url = f"{self._base}/cdn/{version}/data/ja_JP/runesReforged.json"
        data: list = await self._fetch_json(url)  # type: ignore[assignment]
        if not isinstance(data, list) or len(data) == 0:
            raise HTTPException(
                status_code=502,
                detail="Data Dragonからルーンデータを取得できませんでした",
            )
        return data

    def _build_item_info(self, version: str, item_id: int, raw: dict) -> ItemInfo:
        """Data Dragon の生アイテムデータから ItemInfo を生成する"""
        return ItemInfo(
            id=item_id,
            name=raw.get("name", ""),
            description=self._strip_html(raw.get("description", "")),
            image_url=f"{self._base}/cdn/{version}/img/item/{item_id}.png",
            gold_total=raw.get("gold", {}).get("total", 0),
        )

    def _pick_keystone(self, style: dict) -> RuneInfo:
        """スタイル辞書からキーストーン（最初のスロットの先頭ルーン）を取得する"""
        slots = style.get("slots", [])
        if not slots or not slots[0].get("runes"):
            raise HTTPException(
                status_code=502,
                detail="ルーンスタイルデータの構造が想定外です",
            )
        rune = slots[0]["runes"][0]
        return RuneInfo(
            id=rune["id"],
            name=rune.get("name", ""),
            icon=rune.get("icon", ""),
            description=self._strip_html(rune.get("longDesc", rune.get("shortDesc", ""))),
        )

    def _pick_path_rune(self, style: dict) -> RuneInfo:
        """スタイル辞書からパスルーン（スタイル自体のアイコン・名前）を取得する"""
        # サブスタイルとして使う場合はスタイルの icon / name を返す
        # （パスルーン = スタイルのエントリポイントで代用）
        return RuneInfo(
            id=style["id"],
            name=style.get("name", ""),
            icon=style.get("icon", ""),
            description=f"{style.get('name', '')} スタイルのパスルーン",
        )

    async def get_champion_builds(self, champion_id: str) -> BuildRecommendation:
        """
        Data Dragon からアイテムとルーンのデータを取得してビルド推奨を構築する。

        チャンピオンのタグ（Fighter/Mage 等）に基づき定義済みアイテムIDとルーンスタイルを選定する。
        実際のマッチ統計ではなく Data Dragon 公式データを利用する。

        キャッシュキー: "champion_builds:{version}:{champion_id}"
        TTL: settings.cache_ttl_champion_detail（86400秒）
        """
        version = await self.get_latest_version()
        cache_key = CACHE_KEY_CHAMPION_BUILDS.format(version=version, champion_id=champion_id)

        # キャッシュヒット確認
        cached = await self._cache.get(cache_key)
        if cached and isinstance(cached, dict):
            return BuildRecommendation.model_validate(cached)

        # チャンピオン詳細を取得してタグを特定する
        champion_detail = await self.get_champion_by_id(champion_id)
        role_tag = self._resolve_tag(champion_detail.tags)

        # アイテムデータとルーンデータを並行取得
        items_data, runes_data = await asyncio.gather(
            self._fetch_items(version),
            self._fetch_runes(version),
        )

        # アイテムIDリストに基づいてコアアイテムを選定
        target_item_ids = _TAG_ITEM_IDS.get(role_tag, _TAG_ITEM_IDS["default"])
        core_items: list[ItemInfo] = []
        for item_id in target_item_ids:
            raw_item = items_data.get(str(item_id))
            if raw_item is None:
                logger.warning("アイテムID %d がData Dragonに存在しません（スキップ）", item_id)
                continue
            core_items.append(self._build_item_info(version, item_id, raw_item))

        if not core_items:
            raise HTTPException(
                status_code=502,
                detail="推奨アイテムデータを構築できませんでした",
            )

        # ルーン選定
        if len(runes_data) < 5:
            raise HTTPException(
                status_code=502,
                detail="ルーンスタイルデータが不足しています",
            )

        primary_idx = _TAG_PRIMARY_STYLE_IDX.get(role_tag, 0)
        secondary_idx = _TAG_SECONDARY_STYLE_IDX.get(role_tag, 2)

        # インデックスが範囲外の場合はフォールバック
        primary_idx = min(primary_idx, len(runes_data) - 1)
        secondary_idx = min(secondary_idx, len(runes_data) - 1)

        primary_style = runes_data[primary_idx]
        secondary_style = runes_data[secondary_idx]

        rune_primary = self._pick_keystone(primary_style)
        rune_secondary = self._pick_path_rune(secondary_style)

        recommendation = BuildRecommendation(
            champion_id=champion_id,
            version=version,
            core_items=core_items,
            rune_primary=rune_primary,
            rune_secondary=rune_secondary,
            source="data_dragon",
        )

        # キャッシュ保存（24時間、パッチ更新まで不変）
        await self._cache.set(
            cache_key,
            recommendation.model_dump(),
            settings.cache_ttl_champion_detail,
        )
        logger.info(
            "ビルド推奨をキャッシュに保存: champion=%s, role=%s, version=%s",
            champion_id,
            role_tag,
            version,
        )

        return recommendation
