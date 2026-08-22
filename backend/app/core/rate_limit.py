"""
レート制限

認証系エンドポイントのブルートフォース対策。
Redis のカウンタで「一定時間内の試行回数」を数え、上限を超えたら 429 を返す。

Redis が使えない環境ではインメモリにフォールバックする（プロセス単位のため
複数レプリカでは制限が緩くなるが、無いよりは有効）。
"""
import logging

from fastapi import HTTPException, Request

from app.cache.redis import CacheClient

logger = logging.getLogger(__name__)


def client_ip(request: Request) -> str:
    """
    クライアント IP を取得する。

    Railway などのリバースプロキシ配下では X-Forwarded-For の先頭が
    実クライアントの IP になる。ヘッダーは偽装可能だが、レート制限の
    用途では「偽装するたびに別枠になる」だけで実害は限定的。
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def enforce(
    cache: CacheClient,
    scope: str,
    identifier: str,
    *,
    limit: int,
    window_seconds: int,
) -> None:
    """
    試行回数を数え、上限を超えていれば 429 を raise する。

    Args:
        scope:      制限の種類（"login" など）。キーの名前空間になる
        identifier: 制限の単位（IP アドレスやメールアドレス）
        limit:      window_seconds 内に許可する試行回数
        window_seconds: 集計期間（秒）

    Note:
        カウンタは試行のたびに増える。成功時にリセットしたい場合は
        呼び出し側で reset() を使う。
    """
    key = f"ratelimit:{scope}:{identifier}"
    count = await cache.incr(key, window_seconds)

    # incr が 0 を返すのはキャッシュ障害時。制限をかけずに通す
    if count == 0:
        return

    if count > limit:
        logger.warning(
            "レート制限超過: scope=%s identifier=%s count=%d limit=%d",
            scope, identifier, count, limit,
        )
        raise HTTPException(
            status_code=429,
            detail="試行回数が多すぎます。しばらく時間をおいてから再度お試しください。",
            headers={"Retry-After": str(window_seconds)},
        )


async def reset(cache: CacheClient, scope: str, identifier: str) -> None:
    """カウンタを削除する。ログイン成功時に呼び、正規ユーザーへの影響をなくす。"""
    await cache.delete(f"ratelimit:{scope}:{identifier}")
