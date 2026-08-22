"""
管理用エンドポイントの共有シークレット認証

データ更新など、外部のスケジューラーから叩く管理エンドポイントで使う。
"""
import secrets

from fastapi import HTTPException

from app.core.config import settings


def verify_update_secret(provided: str) -> None:
    """
    X-Update-Secret ヘッダーを検証する。不一致なら 401 を raise する。

    - シークレット未設定時は常に拒否する。既定値が空文字列のため、
      未設定のまま素通しにすると空ヘッダーで認証を通過できてしまう。
    - 比較は secrets.compare_digest を使い、実行時間から
      シークレットを推測されないようにする。
    """
    if not settings.update_secret:
        raise HTTPException(
            status_code=503,
            detail="管理エンドポイントは無効です（UPDATE_SECRET 未設定）",
        )

    if not secrets.compare_digest(provided, settings.update_secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
