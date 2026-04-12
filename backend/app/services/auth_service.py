"""
認証サービス
- メール+パスワード登録／ログイン
- JWT アクセストークン / リフレッシュトークン 生成・検証
- Google / Discord OAuth 2.0 フロー

【インメモリDB設計】
  users: dict[str, UserRecord]  — email をキーに保存
  PostgreSQL 移行時はこのサービス層のデータアクセス部分だけ差し替える。
  ビジネスロジック（JWT生成など）はそのまま再利用可能。
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
from app.models.user import UserRecord, UserResponse, TokenResponse

# -------------------------------------------------------------------
# パスワードハッシュ設定（bcrypt）
# -------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# -------------------------------------------------------------------
# インメモリ "DB"
# key: email（小文字正規化）, value: UserRecord
# PostgreSQL 移行時はこの dict をリポジトリクラスに置き換える
# -------------------------------------------------------------------
_users_by_email: dict[str, UserRecord] = {}
_users_by_id: dict[str, UserRecord] = {}

# OAuth state 検証用（CSRF対策）。本番ではRedisに保存する。
_oauth_states: set[str] = set()


# ===================================================================
# 内部ユーティリティ
# ===================================================================

def _hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _generate_user_id() -> str:
    """ユニークなユーザーID生成（UUID代替）"""
    return secrets.token_hex(16)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ===================================================================
# ユーザー管理（データアクセス層）
# PostgreSQL 移行時はこのブロックをリポジトリクラスに切り出す
# ===================================================================

def _find_by_email(email: str) -> Optional[UserRecord]:
    return _users_by_email.get(email.lower())


def _find_by_id(user_id: str) -> Optional[UserRecord]:
    return _users_by_id.get(user_id)


def _save_user(user: UserRecord) -> None:
    _users_by_email[user.email.lower()] = user
    _users_by_id[user.id] = user


# ===================================================================
# メール認証
# ===================================================================

async def create_user(email: str, password: str, name: str) -> UserRecord:
    """
    メール登録。重複メールは 409 を返す。
    パスワードは bcrypt でハッシュ化してから保存する。
    """
    if _find_by_email(email):
        raise HTTPException(409, "このメールアドレスはすでに登録されています")

    user = UserRecord(
        id=_generate_user_id(),
        email=email.lower(),
        name=name,
        provider="email",
        hashed_password=_hash_password(password),
        created_at=_now_utc(),
    )
    _save_user(user)
    return user


async def authenticate_user(email: str, password: str) -> UserRecord:
    """
    メール+パスワードで認証。失敗時は 401 を返す。
    タイミング攻撃対策として、ユーザーが存在しない場合でもハッシュ検証を実行する。
    """
    user = _find_by_email(email)

    if user is None or user.hashed_password is None:
        # タイミング攻撃対策: ユーザーが存在しなくても同じ時間をかける
        # 正規のbcryptハッシュ（"dummy"のハッシュ値）でダミー検証を実行する
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
    """
    アクセストークンを生成する（有効期限15分）。
    ペイロード:
      sub  : user_id
      email: メールアドレス
      type : 'access'
    """
    expire = _now_utc() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    """
    リフレッシュトークンを生成する（有効期限90日）。
    ペイロード:
      sub  : user_id
      type : 'refresh'
    """
    expire = _now_utc() + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_token(token: str, expected_type: str = "access") -> dict:
    """
    JWTトークンを検証してペイロードを返す。
    無効・期限切れの場合は 401 を raise する。
    """
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
    """UserRecord から TokenResponse を組み立てるヘルパー"""
    return TokenResponse(
        token=create_jwt_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
        user=user.to_response(),
    )


async def refresh_access_token(refresh_token: str) -> TokenResponse:
    """
    リフレッシュトークンを使って新しいアクセストークンを発行する。
    """
    payload = verify_token(refresh_token, expected_type="refresh")
    user_id = payload.get("sub")
    user = _find_by_id(user_id)
    if user is None:
        raise HTTPException(401, "ユーザーが見つかりません")
    return _build_token_response(user)


async def get_user_from_token(token: str) -> UserResponse:
    """
    アクセストークンを検証してユーザー情報を返す。
    deps.py から呼び出す用。
    """
    payload = verify_token(token, expected_type="access")
    user_id = payload.get("sub")
    user = _find_by_id(user_id)
    if user is None:
        raise HTTPException(401, "ユーザーが見つかりません")
    return user.to_response()


async def get_user_record_by_id(user_id: str) -> UserRecord:
    """
    ユーザーIDで UserRecord（内部用フルレコード）を取得する。
    Stripe 課金処理など内部サービスから呼び出す用。
    """
    user = _find_by_id(user_id)
    if user is None:
        raise HTTPException(404, "ユーザーが見つかりません")
    return user


async def set_stripe_customer_id(user_id: str, customer_id: str) -> None:
    """Stripe カスタマー ID をユーザーレコードに保存する"""
    user = _find_by_id(user_id)
    if user is None:
        raise HTTPException(404, "ユーザーが見つかりません")
    user.stripe_customer_id = customer_id
    _save_user(user)


async def activate_premium(user_id: str, subscription_id: str) -> None:
    """
    Stripe Webhook（checkout.session.completed）受信後にプレミアムを有効化する。
    subscription_id を保存し is_premium = True にする。
    """
    user = _find_by_id(user_id)
    if user is None:
        return  # ユーザーが存在しない場合は無視
    user.is_premium = True
    user.stripe_subscription_id = subscription_id
    _save_user(user)


async def deactivate_premium_by_customer(customer_id: str) -> None:
    """
    Stripe Webhook（customer.subscription.deleted）受信後にプレミアムを無効化する。
    customer_id でユーザーを検索して is_premium = False にする。
    """
    # インメモリDB全体を走査して customer_id が一致するユーザーを探す
    target: Optional[UserRecord] = None
    for user in _users_by_id.values():
        if user.stripe_customer_id == customer_id:
            target = user
            break
    if target is None:
        return
    target.is_premium = False
    target.stripe_subscription_id = None
    _save_user(target)


# ===================================================================
# OAuth 2.0 — 共通
# ===================================================================

def _generate_state() -> str:
    """CSRF対策用のランダムなstateを生成してインメモリに保存する"""
    state = secrets.token_urlsafe(32)
    _oauth_states.add(state)
    return state


def _validate_and_consume_state(state: str) -> None:
    """stateを検証して使用済みにする。不正なstateは 400 を raise。"""
    if state not in _oauth_states:
        raise HTTPException(400, "不正なstateパラメータです（CSRF対策）")
    _oauth_states.discard(state)


async def _find_or_create_oauth_user(
    email: str,
    name: str,
    avatar: Optional[str],
    provider: str,
) -> UserRecord:
    """
    OAuthプロバイダーから取得したユーザー情報でDB検索し、
    存在しなければ新規作成する。
    同じメールでプロバイダーが異なる場合は既存アカウントに統合する。
    """
    user = _find_by_email(email)
    if user is not None:
        # アバター更新のみ行う（プロバイダーは最初に登録した方を優先）
        user.avatar = avatar
        _save_user(user)
        return user

    user = UserRecord(
        id=_generate_user_id(),
        email=email.lower(),
        name=name,
        avatar=avatar,
        provider=provider,
        created_at=_now_utc(),
    )
    _save_user(user)
    return user


# ===================================================================
# Google OAuth 2.0
# ===================================================================

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"

GOOGLE_SCOPES = ["openid", "email", "profile"]


def get_google_auth_url(state: Optional[str] = None) -> str:
    """
    Google OAuth 認証URLを生成する。
    state が None の場合はランダム生成（CSRF対策）。
    """
    if state is None:
        state = _generate_state()
    else:
        _oauth_states.add(state)

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"


async def _exchange_google_code(code: str) -> dict:
    """認可コードをアクセストークンに交換する"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Googleトークン取得に失敗しました")
    return resp.json()


async def _fetch_google_user(access_token: str) -> dict:
    """Google APIからユーザー情報を取得する"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Googleユーザー情報取得に失敗しました")
    return resp.json()


async def handle_google_callback(code: str, state: str) -> TokenResponse:
    """
    Googleのコールバックを処理してJWTトークンを返す。
    1. state 検証（CSRF対策）
    2. code → access_token 交換
    3. ユーザー情報取得
    4. DB登録 or 更新
    5. JWTトークン発行
    """
    _validate_and_consume_state(state)

    token_data = await _exchange_google_code(code)
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


def get_discord_auth_url(state: Optional[str] = None) -> str:
    """
    Discord OAuth 認証URLを生成する。
    state が None の場合はランダム生成（CSRF対策）。
    """
    if state is None:
        state = _generate_state()
    else:
        _oauth_states.add(state)

    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": " ".join(DISCORD_SCOPES),
        "state": state,
    }
    return f"{DISCORD_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"


async def _exchange_discord_code(code: str) -> dict:
    """認可コードをアクセストークンに交換する"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            DISCORD_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "redirect_uri": settings.discord_redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Discordトークン取得に失敗しました")
    return resp.json()


async def _fetch_discord_user(access_token: str) -> dict:
    """Discord APIからユーザー情報を取得する"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            DISCORD_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Discordユーザー情報取得に失敗しました")
    return resp.json()


async def handle_discord_callback(code: str, state: str) -> TokenResponse:
    """
    Discordのコールバックを処理してJWTトークンを返す。
    アバターURL: https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png
    """
    _validate_and_consume_state(state)

    token_data = await _exchange_discord_code(code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(502, "Discordからアクセストークンを取得できませんでした")

    discord_user = await _fetch_discord_user(access_token)
    email = discord_user.get("email")
    if not email:
        raise HTTPException(502, "Discordからメールアドレスを取得できませんでした")

    # Discordアバター URL の組み立て
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
    """
    プロバイダー名に応じてコールバック処理を振り分ける。
    ルーターから呼び出すためのファサード。
    """
    if provider == "google":
        return await handle_google_callback(code, state)
    elif provider == "discord":
        return await handle_discord_callback(code, state)
    else:
        raise HTTPException(400, f"未対応のOAuthプロバイダーです: {provider}")
