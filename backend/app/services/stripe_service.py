"""
Stripe 課金サービス
- カスタマー作成
- チェックアウトセッション（月額 / 年額）
- ビリングポータル（解約・プラン変更）
- Webhook 処理（署名検証必須）

テストカード番号: 4242 4242 4242 4242
ローカル Webhook 転送:
  stripe listen --forward-to localhost:8000/api/stripe/webhook
"""
from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import HTTPException

from app.core.config import settings
from app.models.user import UserRecord

# Stripe SDK の API キーを設定（環境変数から取得）
stripe.api_key = settings.stripe_secret_key


def _stripe_configured() -> bool:
    """Stripe が設定済みかチェック"""
    return bool(settings.stripe_secret_key)


def _require_stripe() -> None:
    """Stripe が未設定の場合は 503 を返す"""
    if not _stripe_configured():
        raise HTTPException(503, "Stripe が設定されていません。環境変数 STRIPE_SECRET_KEY を設定してください。")


# ===================================================================
# カスタマー管理
# ===================================================================

async def create_customer(user_id: str, email: str) -> str:
    """
    Stripe にカスタマーを作成してカスタマー ID を返す。
    既存カスタマーの検索は呼び出し元（ルーター）で行う。
    """
    _require_stripe()
    try:
        customer = stripe.Customer.create(
            email=email,
            metadata={"user_id": user_id},
        )
        return customer.id
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"Stripeカスタマー作成エラー: {e.user_message or str(e)}")


# ===================================================================
# チェックアウトセッション
# ===================================================================

async def create_checkout_session(
    customer_id: str,
    price_id: str,
    success_url: str,
    cancel_url: str,
    trial_days: int = 7,
) -> str:
    """
    Stripe チェックアウトセッションを作成してリダイレクト URL を返す。
    デフォルトで 7 日間の無料トライアルを付与する。
    """
    _require_stripe()
    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            subscription_data={"trial_period_days": trial_days},
            success_url=success_url,
            cancel_url=cancel_url,
            locale="ja",
        )
        return session.url  # type: ignore[return-value]
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"チェックアウトセッション作成エラー: {e.user_message or str(e)}")


# ===================================================================
# ビリングポータル
# ===================================================================

async def create_billing_portal_session(customer_id: str, return_url: str) -> str:
    """
    Stripe カスタマーポータルの URL を返す。
    ユーザーはここでプラン変更・解約・支払い方法変更を行う。
    """
    _require_stripe()
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session.url
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"ビリングポータル作成エラー: {e.user_message or str(e)}")


# ===================================================================
# サブスクリプション情報取得
# ===================================================================

async def get_subscription(subscription_id: str) -> dict:
    """
    サブスクリプション情報を取得して整形した dict を返す。
    返却キー: status, plan_type, current_period_end, trial_end
    """
    _require_stripe()
    try:
        sub = stripe.Subscription.retrieve(subscription_id)
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"サブスクリプション取得エラー: {e.user_message or str(e)}")

    # プランの判別（月額 / 年額）
    plan_type: Optional[str] = None
    if sub.get("items") and sub["items"]["data"]:
        price_id = sub["items"]["data"][0]["price"]["id"]
        if price_id == settings.stripe_monthly_price_id:
            plan_type = "monthly"
        elif price_id == settings.stripe_yearly_price_id:
            plan_type = "yearly"

    def _ts_to_iso(ts: Optional[int]) -> Optional[str]:
        if ts is None:
            return None
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

    return {
        "status": sub.get("status"),
        "plan_type": plan_type,
        "current_period_end": _ts_to_iso(sub.get("current_period_end")),
        "trial_end": _ts_to_iso(sub.get("trial_end")),
    }


# ===================================================================
# サブスクリプション解約（期末解約）
# ===================================================================

async def cancel_subscription(subscription_id: str) -> bool:
    """
    サブスクリプションを期末解約（cancel_at_period_end = True）に設定する。
    即時解約ではなく、現在の請求期間終了時に解約となる。
    """
    _require_stripe()
    try:
        stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True,
        )
        return True
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"サブスクリプション解約エラー: {e.user_message or str(e)}")


# ===================================================================
# Webhook 処理
# ===================================================================

async def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """
    Stripe Webhook を受信して署名を検証し、イベントを処理する。

    対応イベント:
      - checkout.session.completed    : 決済完了 → プレミアム有効化
      - customer.subscription.deleted : 解約完了 → プレミアム無効化
      - invoice.payment_failed        : 支払い失敗（ログ出力）

    署名検証に失敗した場合は 400 を返す。
    """
    if not settings.stripe_webhook_secret:
        raise HTTPException(503, "Stripe Webhook シークレットが設定されていません")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(400, "Webhookペイロードが不正です")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Webhook署名の検証に失敗しました")

    return event


def extract_user_id_from_session(session: dict) -> Optional[str]:
    """チェックアウトセッションのメタデータからユーザーIDを取得する"""
    return session.get("metadata", {}).get("user_id")
