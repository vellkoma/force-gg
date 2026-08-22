"""
Redisキャッシュ層
Redisが使用できない場合はインメモリキャッシュにフォールバックする
"""
import json
import time
import asyncio
import logging
from typing import Any, Optional
from redis.asyncio import Redis, from_url
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


class InMemoryCache:
    """
    Redisが使えない環境向けのインメモリキャッシュ実装
    TTL付きの簡易キャッシュ（プロセス再起動でクリア）
    """

    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}  # key -> (value, expire_at)
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[str]:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expire_at = entry
            if expire_at > 0 and time.time() > expire_at:
                del self._store[key]
                return None
            return value

    async def setex(self, key: str, ttl: int, value: str) -> None:
        async with self._lock:
            expire_at = time.time() + ttl if ttl > 0 else 0
            self._store[key] = (value, expire_at)

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def incr(self, key: str, ttl: int) -> int:
        """カウンタを1増やして現在値を返す。初回のみ TTL を設定する。"""
        async with self._lock:
            entry = self._store.get(key)
            now = time.time()
            if entry is None or (entry[1] > 0 and now > entry[1]):
                self._store[key] = ("1", now + ttl)
                return 1
            value, expire_at = entry
            count = int(value) + 1
            self._store[key] = (str(count), expire_at)
            return count

    async def ping(self) -> bool:
        return True


class CacheClient:
    """
    Redisラッパークラス
    接続失敗時はインメモリキャッシュに自動フォールバック
    """

    def __init__(self, redis_url: str) -> None:
        self._redis_url = redis_url
        self._redis: Optional[Redis] = None
        self._fallback = InMemoryCache()
        self._use_redis = False

    async def connect(self) -> None:
        """Redis接続を試みる。失敗した場合はインメモリキャッシュを使用する"""
        try:
            self._redis = from_url(self._redis_url, encoding="utf-8", decode_responses=True)
            await self._redis.ping()
            self._use_redis = True
            logger.info("Redis接続成功: %s", self._redis_url)
        except (RedisError, ConnectionRefusedError, OSError) as e:
            logger.warning(
                "Redis接続失敗（インメモリキャッシュにフォールバック）: %s", str(e)
            )
            self._use_redis = False
            self._redis = None

    async def disconnect(self) -> None:
        """Redis接続を閉じる"""
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    async def get(self, key: str) -> Optional[Any]:
        """キャッシュからJSONデシリアライズして返す。存在しない場合はNoneを返す"""
        try:
            if self._use_redis and self._redis is not None:
                raw = await self._redis.get(key)
            else:
                raw = await self._fallback.get(key)

            if raw is None:
                return None
            return json.loads(raw)
        except (RedisError, json.JSONDecodeError) as e:
            logger.warning("キャッシュ取得エラー [%s]: %s", key, str(e))
            return None

    async def set(self, key: str, value: Any, ttl: int) -> None:
        """値をJSONシリアライズしてTTL付きでキャッシュに保存する"""
        try:
            serialized = json.dumps(value, ensure_ascii=False)
            if self._use_redis and self._redis is not None:
                await self._redis.setex(key, ttl, serialized)
            else:
                await self._fallback.setex(key, ttl, serialized)
        except (RedisError, TypeError) as e:
            logger.warning("キャッシュ保存エラー [%s]: %s", key, str(e))

    async def delete(self, key: str) -> None:
        """指定キーのキャッシュを削除する"""
        try:
            if self._use_redis and self._redis is not None:
                await self._redis.delete(key)
            else:
                await self._fallback.delete(key)
        except RedisError as e:
            logger.warning("キャッシュ削除エラー [%s]: %s", key, str(e))

    async def incr(self, key: str, ttl: int) -> int:
        """
        カウンタを原子的に1増やして現在値を返す。キーが新規なら TTL を設定する。
        レート制限のカウントに使う。障害時は 0 を返し、制限を素通しさせる
        （キャッシュ障害でログインが不能になる方が被害が大きいため）。
        """
        try:
            if self._use_redis and self._redis is not None:
                count = await self._redis.incr(key)
                if count == 1:
                    await self._redis.expire(key, ttl)
                return int(count)
            return await self._fallback.incr(key, ttl)
        except RedisError as e:
            logger.warning("カウンタ増分エラー [%s]: %s", key, str(e))
            return 0

    async def delete_pattern(self, pattern: str) -> int:
        """パターンにマッチする全キーを削除する（Redis専用、フォールバック時は0を返す）"""
        try:
            if self._use_redis and self._redis is not None:
                keys = await self._redis.keys(pattern)
                if keys:
                    return await self._redis.delete(*keys)
                return 0
            # インメモリキャッシュではパターン削除をサポートしない
            return 0
        except RedisError as e:
            logger.warning("キャッシュパターン削除エラー [%s]: %s", pattern, str(e))
            return 0

    @property
    def backend(self) -> str:
        """現在使用中のキャッシュバックエンド名を返す"""
        return "redis" if self._use_redis else "in-memory"
