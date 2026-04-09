"""
チャンピオンエンドポイントの基本テスト
実行方法: pytest tests/test_champion.py -v
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.cache.redis import CacheClient, InMemoryCache
from main import app


# -------------------------------------------------------------------
# InMemoryCache 単体テスト
# -------------------------------------------------------------------
class TestInMemoryCache:
    """InMemoryCacheの動作確認"""

    @pytest.mark.asyncio
    async def test_get_returns_none_for_missing_key(self):
        cache = InMemoryCache()
        result = await cache.get("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_setex_and_get(self):
        cache = InMemoryCache()
        await cache.setex("test_key", 60, json.dumps({"hello": "world"}))
        result = await cache.get("test_key")
        assert result == json.dumps({"hello": "world"})

    @pytest.mark.asyncio
    async def test_expired_key_returns_none(self):
        """TTL=0（即時期限切れ）のキーはNoneを返すべき"""
        import time
        cache = InMemoryCache()
        # 過去の時刻を expire_at として直接注入
        cache._store["expired_key"] = ("value", time.time() - 1)
        result = await cache.get("expired_key")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete(self):
        cache = InMemoryCache()
        await cache.setex("del_key", 60, "value")
        await cache.delete("del_key")
        result = await cache.get("del_key")
        assert result is None


# -------------------------------------------------------------------
# CacheClient 単体テスト
# -------------------------------------------------------------------
class TestCacheClient:
    """CacheClientのフォールバック動作確認"""

    @pytest.mark.asyncio
    async def test_falls_back_to_in_memory_on_redis_error(self):
        """Redisに接続できない場合はインメモリキャッシュを使う"""
        client = CacheClient(redis_url="redis://localhost:0")  # 接続不可なポート
        await client.connect()
        assert client.backend == "in-memory"

    @pytest.mark.asyncio
    async def test_set_and_get_with_fallback(self):
        client = CacheClient(redis_url="redis://localhost:0")
        await client.connect()

        await client.set("key1", {"data": 42}, ttl=60)
        result = await client.get("key1")
        assert result == {"data": 42}

    @pytest.mark.asyncio
    async def test_get_returns_none_for_missing_key(self):
        client = CacheClient(redis_url="redis://localhost:0")
        await client.connect()
        result = await client.get("no_such_key")
        assert result is None


# -------------------------------------------------------------------
# チャンピオンAPIエンドポイント 統合テスト
# -------------------------------------------------------------------
MOCK_VERSIONS = ["14.24.1", "14.23.1"]

MOCK_CHAMPION_LIST = {
    "version": "14.24.1",
    "data": {
        "Aatrox": {
            "id": "Aatrox",
            "key": "266",
            "name": "アートロックス",
            "title": "崩壊した者",
            "image": {"full": "Aatrox.png"},
            "tags": ["Fighter", "Tank"],
        },
        "Jinx": {
            "id": "Jinx",
            "key": "222",
            "name": "ジンクス",
            "title": "ルーズキャノン",
            "image": {"full": "Jinx.png"},
            "tags": ["Marksman"],
        },
    },
}

MOCK_AATROX_DETAIL = {
    "version": "14.24.1",
    "data": {
        "Aatrox": {
            "id": "Aatrox",
            "key": "266",
            "name": "アートロックス",
            "title": "崩壊した者",
            "image": {"full": "Aatrox.png"},
            "tags": ["Fighter", "Tank"],
            "blurb": "かつてはアゾールの擁護者であり...",
            "partype": "Blood Well",
            "stats": {
                "hp": 650,
                "hpperlevel": 114,
                "mp": 0,
                "mpperlevel": 0,
                "armor": 38,
                "armorperlevel": 4.45,
                "spellblock": 32,
                "spellblockperlevel": 2.05,
                "attackdamage": 60,
                "attackdamageperlevel": 5,
                "attackspeed": 0.651,
                "movespeed": 345,
                "attackrange": 175,
                "crit": 0,
                "critperlevel": 0,
            },
        }
    },
}


@pytest.fixture
def mock_http_responses():
    """Data Dragon APIをモックする fixture"""

    async def mock_fetch(self, url: str):
        if "versions.json" in url:
            return MOCK_VERSIONS
        if "champion.json" in url and "Aatrox" not in url:
            return MOCK_CHAMPION_LIST
        if "champion/Aatrox.json" in url:
            return MOCK_AATROX_DETAIL
        raise Exception(f"Unexpected URL in test: {url}")

    return mock_fetch


@pytest.mark.asyncio
async def test_list_champions_returns_200(mock_http_responses):
    """GET /api/champions が 200 と正しいJSONを返すこと"""
    with patch("app.services.champion.ChampionService._fetch_json", mock_http_responses):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/champions")

    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "14.24.1"
    assert body["total"] == 2
    # 日本語名で昇順ソートされること（ア行 < ジ行）
    names = [c["name"] for c in body["champions"]]
    assert names == sorted(names)


@pytest.mark.asyncio
async def test_list_champions_response_shape(mock_http_responses):
    """レスポンスの各チャンピオンが必須フィールドを持つこと"""
    with patch("app.services.champion.ChampionService._fetch_json", mock_http_responses):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/champions")

    champs = response.json()["champions"]
    for champ in champs:
        assert "id" in champ
        assert "key" in champ
        assert "name" in champ
        assert "title" in champ
        assert "image_url" in champ
        assert "tags" in champ
        assert "ddragon.leagueoflegends.com" in champ["image_url"]


@pytest.mark.asyncio
async def test_get_champion_detail_returns_200(mock_http_responses):
    """GET /api/champions/Aatrox が 200 と詳細データを返すこと"""
    with patch("app.services.champion.ChampionService._fetch_json", mock_http_responses):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/champions/Aatrox")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "Aatrox"
    assert body["name"] == "アートロックス"
    assert "stats" in body
    assert body["stats"]["hp"] == 650


@pytest.mark.asyncio
async def test_get_nonexistent_champion_returns_404():
    """存在しないチャンピオンIDで 404 が返ること"""

    async def mock_fetch_404(self, url: str):
        if "versions.json" in url:
            return MOCK_VERSIONS
        # Data Dragon は存在しないチャンピオンで404を返す
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="チャンピオン 'Unknown' が見つかりません")

    with patch("app.services.champion.ChampionService._fetch_json", mock_fetch_404):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/champions/Unknown")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_health_check():
    """GET /health が 200 を返すこと"""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "cache_backend" in body


@pytest.mark.asyncio
async def test_root_endpoint():
    """GET / がサービス情報を返すこと"""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
