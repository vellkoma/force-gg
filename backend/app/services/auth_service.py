"""
認証サービス
- メール+パスワード登録／ログイン
- JWT アクセストークン / リフレッシュトークン 生成・検証
- Google / Discord OAuth 2.0 フロー

【DB戦略】
  DATABASE_URL が設定されている場合は asyncpg (PostgreSQL) を使用する。
  未設定の場合はインメモリ dict にフォールバックする（開発・テスト用）。
  ビジネスロジック（JWT生成など）はどちらのモードでも共通。
"""
import hashlib
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import HTTPException
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core import database
from app.models.user import UserRecord, UserResponse, TokenResponse

# -------------------------------------------------------------------
# パスワードハッシュ設定（bcrypt）
# -------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# -------------------------------------------------------------------
# インメモリ "DB"（DATABASE_URL 未設定時のフォールバック）
# -------------------------------------------------------------------
_mem_by_email: dict[str, UserRecord] = {}
_mem_by_id: dict[str, UserRecord] = {}

# OAuth state 検証用（CSRF対策）。state -> redirect_uri のマッピング。
# 本番ではRedisに保存するべきだが、短命な値なのでインメモリで問題ない。
_oauth_states: dict[str, str] = {}


# ===================================================================
# 内部ユーティリティ
# ===================================================================

def _hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _generate_user_id() -> str:
    return secrets.token_hex(16)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _row_to_user(row: dict) -> UserRecord:
    """asyncpg.Record / dict → UserRecord に変換する"""
    return UserRecord(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        avatar=row["avatar"],
        provider=row["provider"],
        hashed_password=row["hashed_password"],
        is_premium=row["is_premium"],
        premium_expires_at=row["premium_expires_at"],
        stripe_customer_id=row["stripe_customer_id"],
        stripe_subscription_id=row["stripe_subscription_id"],
        created_at=row["created_at"],
    )


# ===================================================================
# データアクセス層（DB / インメモリを切り替える）
# ===================================================================

async def _find_by_email(email: str) -> Optional[UserRecord]:
    pool = database.get_pool()
    if pool:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1", email.lower()
            )
            return _row_to_user(row) if row else None
    return _mem_by_email.get(email.lower())


async def _find_by_id(user_id: str) -> Optional[UserRecord]:
    pool = database.get_pool()
    if pool:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE id = $1", user_id
            )
            return _row_to_user(row) if row else None
    return _mem_by_id.get(user_id)


async def _find_by_stripe_customer(customer_id: str) -> Optional[UserRecord]:
    pool = database.get_pool()
    if pool:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE stripe_customer_id = $1", customer_id
            )
            return _row_to_user(row) if row else None
    for user in _mem_by_id.values():
        if user.stripe_customer_id == customer_id:
            return user
    return None


async def _save_user(user: UserRecord) -> None:
    """ユーザーをUPSERTする（新規作成 / 更新どちらも）"""
    pool = database.get_pool()
    if pool:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO users (
                    id, email, name, avatar, provider, hashed_password,
                    is_premium, premium_expires_at,
                    stripe_customer_id, stripe_subscription_id, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                ON CONFLICT (id) DO UPDATE SET
                    email                  = EXCLUDED.email,
                    name                   = EXCLUDED.name,
                    avatar                 = EXCLUDED.avatar,
                    provider               = EXCLUDED.provider,
                    hashed_password        = EXCLUDED.hashed_password,
                    is_premium             = EXCLUDED.is_premium,
                    premium_expires_at     = EXCLUDED.premium_expires_at,
                    stripe_customer_id     = EXCLUDED.stripe_customer_id,
                    stripe_subscription_id = EXCLUDED.stripe_subscription_id
                """,
                user.id,
                user.email.lower(),
                user.name,
                user.avatar,
                user.provider,
                user.hashed_password,
                user.is_premium,
                user.premium_expires_at,
                user.stripe_customer_id,
                user.stripe_subscription_id,
                user.created_at,
            )
        return
    _mem_by_email[user.email.lower()] = user
    _mem_by_id[user.id] = user


# ===================================================================
# メール認証
# ===================================================================

async def create_user(email: str, password: str, name: str) -> UserRecord:
    """
    メール登録。重複メールは 409 を返す。
    パスワードは bcrypt でハッシュ化してから保存する。
    """
    if await _find_by_email(email):
        raise HTTPException(409, "このメールアドレスはすでに登録されています")

    user = UserRecord(
        id=_generate_user_id(),
        email=email.lower(),
        name=name,
        provider="email",
        hashed_password=_hash_password(password),
        created_at=_now_utc(),
    )
    await _save_user(user)
    return user


async def authenticate_user(email: str, password: str) -> UserRecord:
    """
    メール+パスワードで認証。失敗時は 401 を返す。
    タイミング攻撃対策として、ユーザーが存在しない場合でもハッシュ検証を実行する。
    """
    user = await _find_by_email(email)

    if user is None or user.hashed_password is None:
        _verify_password(
            "dummy",
            "$2b$12$UXH4wu64oeWyewhcukpss.CXk/BEXemOLvVlWQflgd0kBQ8a4x03S",
        )
        raise HTTPException(401, "メールアドレスまたはパスワードが正しくありません")

    if not _verify_password(password, user.hashed_password):
        raise HTTPException(401, "メールアドレスまたはパスワードが正しくありません")

    return user


# ===================================================================
# JWT トークン
# ===================================================================

def create_jwt_token(user_id: str, email: str) -> str:
    expire = _now_utc() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    expire = _now_utc() + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_token(token: str, expected_type: str = "access") -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(401, "トークンが無効または期限切れです")

    if payload.get("type") != expected_type:
        raise HTTPException(401, "トークンの種別が正しくありません")

    return payload


def _build_token_response(user: UserRecord) -> TokenResponse:
    return TokenResponse(
        token=create_jwt_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
        user=user.to_response(),
    )


async def refresh_access_token(refresh_token: str) -> TokenResponse:
    payload = verify_token(refresh_token, expected_type="refresh")
    user_id = payload.get("sub")
    user = await _find_by_id(user_id)
    if user is None:
        raise HTTPException(401, "ユーザーが見つかりません")
    return _build_token_response(user)


async def get_user_from_token(token: str) -> UserResponse:
    payload = verify_token(token, expected_type="access")
    user_id = payload.get("sub")
    user = await _find_by_id(user_id)
    if user is None:
        raise HTTPException(401, "ユーザーが見つかりません")
    return user.to_response()


async def get_user_record_by_id(user_id: str) -> UserRecord:
    user = await _find_by_id(user_id)
    if user is None:
        raise HTTPException(404, "ユーザーが見つかりません")
    return user


# ===================================================================
# Stripe 課金連携
# ===================================================================

async def set_stripe_customer_id(user_id: str, customer_id: str) -> None:
    user = await _find_by_id(user_id)
    if user is None:
        raise HTTPException(404, "ユーザーが見つかりません")
    user.stripe_customer_id = customer_id
    await _save_user(user)


async def activate_premium(user_id: str, subscription_id: str) -> None:
    user = await _find_by_id(user_id)
    if user is None:
        return
    user.is_premium = True
    user.stripe_subscription_id = subscription_id
    await _save_user(user)


async def deactivate_premium_by_customer(customer_id: str) -> None:
    user = await _find_by_stripe_customer(customer_id)
    if user is None:
        return
    user.is_premium = False
    user.stripe_subscription_id = None
    await _save_user(user)


# ===================================================================
# OAuth 2.0 — 共通
# ===================================================================

def _generate_state(redirect_uri: str) -> str:
    """CSRF対策用のランダムなstateを生成してredirect_uriと共にインメモリに保存する"""
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = redirect_uri
    return state


def _validate_and_consume_state(state: str) -> str:
    """stateを検証して使用済みにする。不正なstateは 400 を raise。redirect_uriを返す。"""
    if state not in _oauth_states:
        raise HTTPException(400, "不正なstateパラメータです（CSRF対策）")
    return _oauth_states.pop(state)


async def _find_or_create_oauth_user(
    email: str,
    name: str,
    avatar: Optional[str],
    provider: str,
) -> UserRecord:
    user = await _find_by_email(email)
    if user is not None:
        user.avatar = avatar
        await _save_user(user)
        return user

    user = UserRecord(
        id=_generate_user_id(),
        email=email.lower(),
        name=name,
        avatar=avatar,
        provider=provider,
        created_at=_now_utc(),
    )
    await _save_user(user)
    return user


# ===================================================================
# Google OAuth 2.0
# ===================================================================

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"

GOOGLE_SCOPES = ["openid", "email", "profile"]


def get_google_auth_url(state: Optional[str] = None, redirect_uri: Optional[str] = None) -> str:
    actual_redirect_uri = redirect_uri or settings.google_redirect_uri
    if state is None:
        state = _generate_state(actual_redirect_uri)
    else:
        _oauth_states[state] = actual_redirect_uri

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": actual_redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"


async def _exchange_google_code(code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Googleトークン取得に失敗しました")
    return resp.json()


async def _fetch_google_user(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Googleユーザー情報取得に失敗しました")
    return resp.json()


async def handle_google_callback(code: str, state: str) -> TokenResponse:
    redirect_uri = _validate_and_consume_state(state)
    token_data = await _exchange_google_code(code, redirect_uri)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(502, "Googleからアクセストークンを取得できませんでした")

    google_user = await _fetch_google_user(access_token)
    email = google_user.get("email")
    if not email:
        raise HTTPException(502, "Googleからメールアドレスを取得できませんでした")

    user = await _find_or_create_oauth_user(
        email=email,
        name=google_user.get("name", email),
        avatar=google_user.get("picture"),
        provider="google",
    )
    return _build_token_response(user)


# ===================================================================
# Discord OAuth 2.0
# ===================================================================

DISCORD_AUTH_ENDPOINT = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_ENDPOINT = "https://discord.com/api/oauth2/token"
DISCORD_USERINFO_ENDPOINT = "https://discord.com/api/users/@me"

DISCORD_SCOPES = ["identify", "email"]


def get_discord_auth_url(state: Optional[str] = None, redirect_uri: Optional[str] = None) -> str:
    actual_redirect_uri = redirect_uri or settings.discord_redirect_uri
    if state is None:
        state = _generate_state(actual_redirect_uri)
    else:
        _oauth_states[state] = actual_redirect_uri

    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": actual_redirect_uri,
        "response_type": "code",
        "scope": " ".join(DISCORD_SCOPES),
        "state": state,
    }
    return f"{DISCORD_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"


async def _exchange_discord_code(code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            DISCORD_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Discordトークン取得に失敗しました")
    return resp.json()


async def _fetch_discord_user(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            DISCORD_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Discordユーザー情報取得に失敗しました")
    return resp.json()


async def handle_discord_callback(code: str, state: str) -> TokenResponse:
    redirect_uri = _validate_and_consume_state(state)
    token_data = await _exchange_discord_code(code, redirect_uri)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(502, "Discordからアクセストークンを取得できませんでした")

    discord_user = await _fetch_discord_user(access_token)
    email = discord_user.get("email")
    if not email:
        raise HTTPException(502, "Discordからメールアドレスを取得できませんでした")

    avatar_hash = discord_user.get("avatar")
    discord_id = discord_user.get("id")
    avatar_url: Optional[str] = None
    if avatar_hash and discord_id:
        avatar_url = f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar_hash}.png"

    user = await _find_or_create_oauth_user(
        email=email,
        name=discord_user.get("username", email),
        avatar=avatar_url,
        provider="discord",
    )
    return _build_token_response(user)


# ===================================================================
# 統合コールバックハンドラー
# ===================================================================

async def handle_oauth_callback(provider: str, code: str, state: str) -> TokenResponse:
    if provider == "google":
        return await handle_google_callback(code, state)
    elif provider == "discord":
        return await handle_discord_callback(code, state)
    else:
        raise HTTPException(400, f"未対応のOAuthプロバイダーです: {provider}")
