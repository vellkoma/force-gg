"""
ユーザー認証関連の Pydantic モデル定義
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    """メール登録リクエスト"""
    email: EmailStr
    password: str
    name: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("パスワードは8文字以上で入力してください")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("名前を入力してください")
        return v.strip()


class UserLogin(BaseModel):
    """メールログインリクエスト"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """クライアントに返すユーザー情報（パスワードハッシュは含まない）"""
    id: str
    email: str
    name: str
    avatar: Optional[str] = None
    provider: str  # 'google' | 'discord' | 'email'
    is_premium: bool = False
    premium_expires_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    """JWT + リフレッシュトークンのレスポンス"""
    token: str
    refresh_token: str
    user: UserResponse


class RefreshRequest(BaseModel):
    """リフレッシュトークンリクエスト"""
    refresh_token: str


class OAuthCallbackRequest(BaseModel):
    """OAuthコールバックリクエスト"""
    provider: str   # 'google' | 'discord'
    code: str
    state: str


class ForgotPasswordRequest(BaseModel):
    """パスワードリセットリクエスト（メール送信）"""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """パスワードリセット実行"""
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("パスワードは8文字以上で入力してください")
        return v


# -------------------------------------------------------------------
# 内部用レコード（インメモリDB用）
# PostgreSQL 移行時はここを SQLAlchemy モデルに置き換える
# -------------------------------------------------------------------
class UserRecord(BaseModel):
    """インメモリDB用の完全なユーザーレコード"""
    id: str
    email: str
    name: str
    avatar: Optional[str] = None
    provider: str
    hashed_password: Optional[str] = None        # email登録のみ使用
    is_premium: bool = False
    premium_expires_at: Optional[datetime] = None
    stripe_customer_id: Optional[str] = None     # Stripeカスタマーid
    stripe_subscription_id: Optional[str] = None # Stripeサブスクリプションid
    created_at: datetime = datetime.utcnow()

    def to_response(self) -> UserResponse:
        """クライアント向けレスポンスに変換（センシティブフィールドを除外）"""
        return UserResponse(
            id=self.id,
            email=self.email,
            name=self.name,
            avatar=self.avatar,
            provider=self.provider,
            is_premium=self.is_premium,
            premium_expires_at=self.premium_expires_at,
        )
