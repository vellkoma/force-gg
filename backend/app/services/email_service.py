"""
メール送信サービス（Resend API）
RESEND_API_KEY が未設定の場合はコンソールにリセットURLを出力する（開発用フォールバック）
"""
import logging

import httpx
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def send_password_reset_email(email: str, name: str, reset_url: str) -> None:
    """パスワードリセットメールを送信する"""
    if not settings.resend_api_key:
        # リセットURLにはトークンが含まれるため、本番ではログに出さない。
        # 開発環境ではメールが送れないので、URL を出さないと動作確認ができない。
        if settings.is_development:
            logger.warning("RESEND_API_KEY未設定 — パスワードリセットURL（開発用）: %s", reset_url)
        else:
            logger.error("RESEND_API_KEY未設定のためパスワードリセットメールを送信できません: %s", email)
        return

    html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #070b14; color: #e0e6f0; padding: 32px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background: #0d1626; border: 1px solid #1e2a40; border-radius: 12px; padding: 32px;">
    <h1 style="color: #c89b3c; font-size: 22px; margin: 0 0 4px 0; font-weight: bold; letter-spacing: 2px;">force.gg</h1>
    <p style="color: #6b7a99; font-size: 13px; margin: 0 0 28px 0;">LoL 統計 &amp; AI コーチング</p>
    <p style="margin: 0 0 12px 0;">こんにちは、{name} さん</p>
    <p style="margin: 0 0 28px 0; line-height: 1.7; color: #c8d8f0;">
      パスワードリセットのリクエストを受け付けました。<br>
      以下のボタンをクリックして新しいパスワードを設定してください。
    </p>
    <div style="text-align: center; margin: 0 0 28px 0;">
      <a href="{reset_url}"
         style="background: #c89b3c; color: #070b14; font-weight: bold; padding: 14px 36px;
                border-radius: 10px; text-decoration: none; display: inline-block; font-size: 15px;">
        パスワードをリセット
      </a>
    </div>
    <p style="color: #6b7a99; font-size: 12px; line-height: 1.7; margin: 0 0 8px 0;">
      このリンクは <strong>1時間</strong> で有効期限が切れます。
    </p>
    <p style="color: #6b7a99; font-size: 12px; margin: 0;">
      身に覚えのない場合はこのメールを無視してください。
    </p>
  </div>
</body>
</html>"""

    payload = {
        "from": settings.email_from,
        "to": [email],
        "subject": "【force.gg】パスワードリセットのご案内",
        "html": html_body,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            RESEND_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        )

    if resp.status_code not in (200, 201):
        logger.error("Resendメール送信失敗: %s %s", resp.status_code, resp.text)
        raise HTTPException(500, "メール送信に失敗しました。しばらくしてから再度お試しください。")

    logger.info("パスワードリセットメール送信完了: %s", email)


async def send_oauth_account_notice_email(email: str, name: str, provider: str) -> None:
    """Google/Discord アカウントにログイン方法を案内するメールを送信する"""
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY未設定 — OAuthアカウント案内（開発用）: %s provider=%s", email, provider)
        return

    provider_label = "Google" if provider == "google" else "Discord"
    provider_color = "#EA4335" if provider == "google" else "#7289DA"

    html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #070b14; color: #e0e6f0; padding: 32px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background: #0d1626; border: 1px solid #1e2a40; border-radius: 12px; padding: 32px;">
    <h1 style="color: #c89b3c; font-size: 22px; margin: 0 0 4px 0; font-weight: bold; letter-spacing: 2px;">force.gg</h1>
    <p style="color: #6b7a99; font-size: 13px; margin: 0 0 28px 0;">LoL 統計 &amp; AI コーチング</p>
    <p style="margin: 0 0 12px 0;">こんにちは、{name} さん</p>
    <p style="margin: 0 0 24px 0; line-height: 1.7; color: #c8d8f0;">
      パスワードリセットのリクエストを受け付けましたが、このアカウントは
      <strong style="color: {provider_color};">{provider_label}</strong>
      でログインしています。
    </p>
    <p style="margin: 0 0 28px 0; line-height: 1.7; color: #c8d8f0;">
      ログイン画面の「{provider_label}でログイン」ボタンからログインしてください。
    </p>
    <p style="color: #6b7a99; font-size: 12px; margin: 0;">
      身に覚えのない場合はこのメールを無視してください。
    </p>
  </div>
</body>
</html>"""

    payload = {
        "from": settings.email_from,
        "to": [email],
        "subject": "【force.gg】ログイン方法のご案内",
        "html": html_body,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            RESEND_API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        )

    if resp.status_code not in (200, 201):
        logger.error("Resendメール送信失敗(OAuth案内): %s %s", resp.status_code, resp.text)
    else:
        logger.info("OAuthアカウント案内メール送信完了: %s", email)
