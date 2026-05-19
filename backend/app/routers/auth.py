"""
認証エンドポイント
- メール登録 / ログイン
- Google / Discord OAuth 2.0
- JWTリフレッシュ
- ログアウト（クライアント側でトークン破棄）
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, Query

from app.models.user import (
    ForgotPasswordRequest,
    OAuthCallbackRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SetPasswordRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(tags=["auth"])


# -------------------------------------------------------------------
# メール認証
# -------------------------------------------------------------------

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: UserCreate) -> TokenResponse:
    """
    メールアドレス + パスワードで新規ユーザー登録。
    登録直後にJWTトークンを返す（ログインと同等）。
    """
    user = await auth_service.create_user(
        email=body.email,
        password=body.password,
        name=body.name,
    )
    return TokenResponse(
        token=auth_service.create_jwt_token(user.id, user.email),
        refresh_token=auth_service.create_refresh_token(user.id),
        user=user.to_response(),
    )


@router.post("/login/email", response_model=TokenResponse)
async def login_email(body: UserLogin) -> TokenResponse:
    """
    メールアドレス + パスワードでログイン。
    認証失敗時は 401 を返す。
    """
    user = await auth_service.authenticate_user(body.email, body.password)
    return TokenResponse(
        token=auth_service.create_jwt_token(user.id, user.email),
        refresh_token=auth_service.create_refresh_token(user.id),
        user=user.to_response(),
    )


# -------------------------------------------------------------------
# OAuth 2.0 — Google
# -------------------------------------------------------------------

@router.get("/oauth/google/url")
async def google_auth_url(
    state: Optional[str] = Query(default=None, description="CSRFトークン（省略時は自動生成）"),
    redirect_uri: Optional[str] = Query(default=None, description="コールバックURL（デスクトップアプリ用ループバックURLを指定可能）"),
) -> dict:
    """
    Google OAuth 認証URLを返す。
    フロントエンドはこのURLにリダイレクトする。
    デスクトップアプリは redirect_uri にループバックURL（http://127.0.0.1:{port}）を指定できる。
    """
    url = auth_service.get_google_auth_url(state=state, redirect_uri=redirect_uri)
    return {"url": url}


# -------------------------------------------------------------------
# OAuth 2.0 — Discord
# -------------------------------------------------------------------

@router.get("/oauth/discord/url")
async def discord_auth_url(
    state: Optional[str] = Query(default=None, description="CSRFトークン（省略時は自動生成）"),
    redirect_uri: Optional[str] = Query(default=None, description="コールバックURL（デスクトップアプリ用ループバックURLを指定可能）"),
) -> dict:
    """
    Discord OAuth 認証URLを返す。
    フロントエンドはこのURLにリダイレクトする。
    デスクトップアプリは redirect_uri にループバックURL（http://127.0.0.1:{port}）を指定できる。
    """
    url = auth_service.get_discord_auth_url(state=state, redirect_uri=redirect_uri)
    return {"url": url}


# -------------------------------------------------------------------
# OAuth コールバック（Google / Discord 共通）
# -------------------------------------------------------------------

@router.post("/oauth/callback", response_model=TokenResponse)
async def oauth_callback(body: OAuthCallbackRequest) -> TokenResponse:
    """
    OAuthコールバック処理（Google / Discord 共通エンドポイント）。
    フロントエンドがコールバックURLから code / state を受け取り、
    このエンドポイントに POST する。
    """
    return await auth_service.handle_oauth_callback(
        provider=body.provider,
        code=body.code,
        state=body.state,
    )


# -------------------------------------------------------------------
# 認証済みユーザー情報
# -------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
async def get_me(
    authorization: Annotated[Optional[str], Header()] = None,
) -> UserResponse:
    """
    現在ログイン中のユーザー情報を返す。
    Authorization: Bearer <token> ヘッダーが必要。
    """
    if not authorization or not authorization.startswith("Bearer "):
        from fastapi import HTTPException
        raise HTTPException(401, "認証が必要です")
    token = authorization.removeprefix("Bearer ").strip()
    return await auth_service.get_user_from_token(token)


# -------------------------------------------------------------------
# トークンリフレッシュ
# -------------------------------------------------------------------

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest) -> TokenResponse:
    """
    リフレッシュトークンを使って新しいアクセストークンを発行する。
    リフレッシュトークンが期限切れ・無効の場合は 401 を返す。
    """
    return await auth_service.refresh_access_token(body.refresh_token)


# -------------------------------------------------------------------
# ログアウト
# -------------------------------------------------------------------

@router.post("/set-password", status_code=200)
async def set_password(
    body: SetPasswordRequest,
    authorization: Annotated[Optional[str], Header()] = None,
) -> dict:
    """
    ログイン済みユーザーがパスワードを設定する。
    Google / Discord アカウントがメールログインも使えるようにする。
    Authorization: Bearer <token> ヘッダーが必要。
    """
    if not authorization or not authorization.startswith("Bearer "):
        from fastapi import HTTPException
        raise HTTPException(401, "認証が必要です")
    token = authorization.removeprefix("Bearer ").strip()
    payload = auth_service.verify_token(token, expected_type="access")
    user_id = payload.get("sub")
    await auth_service.set_password_for_user(user_id, body.new_password)
    return {"message": "パスワードを設定しました。メールアドレスとパスワードでもログインできるようになりました。"}


@router.post("/forgot-password", status_code=200)
async def forgot_password(body: ForgotPasswordRequest) -> dict:
    """
    パスワードリセットメールを送信する。
    メールアドレスの存在有無に関わらず同じレスポンスを返す（メール列挙攻撃対策）。
    """
    await auth_service.request_password_reset(body.email)
    return {"message": "ご登録のメールアドレスにリセット用のリンクをお送りしました。"}


@router.post("/reset-password", status_code=200)
async def reset_password(body: ResetPasswordRequest) -> dict:
    """トークンを使ってパスワードをリセットする"""
    await auth_service.reset_password(body.token, body.new_password)
    return {"message": "パスワードを変更しました。新しいパスワードでログインしてください。"}


@router.post("/logout")
async def logout() -> dict:
    """
    サーバー側のログアウト処理。
    JWTはステートレスなため、実際の無効化はクライアント側（トークン削除）で行う。
    本番でトークンブラックリストが必要な場合はRedisに保存する。
    """
    return {"message": "ログアウトしました"}
