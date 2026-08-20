"""
Stripe 課金エンドポイント

POST /api/stripe/create-checkout  → チェックアウトセッション作成（要認証）
POST /api/stripe/webhook          → Stripe Webhook 受信（署名検証必須・認証不要）
GET  /api/stripe/subscription     → サブスクリプション情報（要認証）
POST /api/stripe/billing-portal   → ビリングポータル URL 取得（要認証）
DELETE /api/stripe/subscription   → サブスクリプション解約（要認証）
"""
import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.core.config import settings
from app.deps import get_current_user
from app.models.user import UserResponse
from app.services import auth_service, stripe_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stripe", tags=["stripe"])

# Stripe 価格 ID マッピング
PRICE_IDS: dict[str, str] = {
    "monthly": settings.stripe_monthly_price_id,
    "yearly":  settings.stripe_yearly_price_id,
}


# -------------------------------------------------------------------
# リクエスト / レスポンスモデル
# -------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    """チェックアウトセッション作成リクエスト"""
    plan: Literal["monthly", "yearly"]


class CheckoutResponse(BaseModel):
    """チェックアウトセッションレスポンス"""
    url: str


class BillingPortalResponse(BaseModel):
    """ビリングポータルレスポンス"""
    url: str


class SubscriptionResponse(BaseModel):
    """サブスクリプション情報レスポンス"""
    status: str | None
    plan_type: str | None
    current_period_end: str | None
    trial_end: str | None


# -------------------------------------------------------------------
# POST /api/stripe/create-checkout
# -------------------------------------------------------------------

@router.post("/create-checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> CheckoutResponse:
    """
    Stripe チェックアウトセッションを作成してリダイレクト URL を返す。
    7 日間の無料トライアル付き。

    PREMIUM_SIGNUP_ENABLED=false の間は新規登録を受け付けない。
    """
    if not settings.premium_signup_enabled:
        raise HTTPException(503, "プレミアムプランの新規登録は現在休止中です")

    price_id = PRICE_IDS.get(body.plan)
    if not price_id:
        raise HTTPException(400, "無効なプラン名です")

    # ユーザーの Stripe カスタマー ID を取得（なければ作成）
    user_record = await auth_service.get_user_record_by_id(current_user.id)

    if not user_record.stripe_customer_id:
        customer_id = await stripe_service.create_customer(
            user_id=current_user.id,
            email=current_user.email,
        )
        await auth_service.set_stripe_customer_id(current_user.id, customer_id)
    else:
        customer_id = user_record.stripe_customer_id

    checkout_url = await stripe_service.create_checkout_session(
        customer_id=customer_id,
        price_id=price_id,
        success_url=f"{settings.frontend_url}/premium/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.frontend_url}/premium/cancel",
        trial_days=7,
    )
    return CheckoutResponse(url=checkout_url)


# -------------------------------------------------------------------
# POST /api/stripe/webhook
# -------------------------------------------------------------------

@router.post("/webhook", status_code=200)
async def stripe_webhook(
    request: Request,
    stripe_signature: Annotated[str | None, Header(alias="stripe-signature")] = None,
) -> dict:
    """
    Stripe Webhook を受信する。

    署名検証は stripe_service.handle_webhook() が行う。
    対応イベント:
      - checkout.session.completed    : プレミアム有効化
      - customer.subscription.deleted : プレミアム無効化
      - invoice.payment_failed        : 支払い失敗ログ

    注意: このエンドポイントは認証不要。Stripe からの呼び出しのみ想定。
    """
    if not stripe_signature:
        raise HTTPException(400, "stripe-signature ヘッダーが必要です")

    payload = await request.body()

    event = await stripe_service.handle_webhook(payload, stripe_signature)
    event_type: str = event.get("type", "")
    data_obj: dict = event.get("data", {}).get("object", {})

    logger.info("Stripe Webhook 受信: %s", event_type)

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data_obj)

    elif event_type == "customer.subscription.deleted":
        customer_id: str = data_obj.get("customer", "")
        if customer_id:
            await auth_service.deactivate_premium_by_customer(customer_id)
            logger.info("プレミアム無効化 customer=%s", customer_id)

    elif event_type == "invoice.payment_failed":
        customer_id = data_obj.get("customer", "")
        logger.warning("支払い失敗 customer=%s", customer_id)
        # TODO: 支払い失敗通知メールを送信（SES / SendGrid 等）

    return {"status": "ok"}


async def _handle_checkout_completed(session: dict) -> None:
    """checkout.session.completed を処理してプレミアムを有効化する"""
    user_id: str | None = session.get("metadata", {}).get("user_id")
    subscription_id: str | None = session.get("subscription")
    customer_id: str | None = session.get("customer")

    if not user_id:
        logger.error("checkout.session.completed に user_id メタデータがありません")
        return

    # Stripe カスタマー ID を紐づけ（念のため）
    if customer_id:
        await auth_service.set_stripe_customer_id(user_id, customer_id)

    if subscription_id:
        await auth_service.activate_premium(user_id, subscription_id)
        logger.info("プレミアム有効化 user_id=%s subscription_id=%s", user_id, subscription_id)


# -------------------------------------------------------------------
# GET /api/stripe/subscription
# -------------------------------------------------------------------

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> SubscriptionResponse:
    """
    現在ログイン中のユーザーのサブスクリプション情報を返す。
    サブスクリプションがない場合は全フィールドが null のレスポンスを返す。
    """
    user_record = await auth_service.get_user_record_by_id(current_user.id)

    if not user_record.stripe_subscription_id:
        return SubscriptionResponse(
            status=None,
            plan_type=None,
            current_period_end=None,
            trial_end=None,
        )

    info = await stripe_service.get_subscription(user_record.stripe_subscription_id)
    return SubscriptionResponse(**info)


# -------------------------------------------------------------------
# POST /api/stripe/billing-portal
# -------------------------------------------------------------------

@router.post("/billing-portal", response_model=BillingPortalResponse)
async def billing_portal(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> BillingPortalResponse:
    """
    Stripe カスタマーポータル URL を返す。
    ユーザーはここでプラン変更・解約・支払い方法を管理できる。
    """
    user_record = await auth_service.get_user_record_by_id(current_user.id)

    if not user_record.stripe_customer_id:
        raise HTTPException(400, "Stripeカスタマー情報が見つかりません。先にプランを購入してください。")

    portal_url = await stripe_service.create_billing_portal_session(
        customer_id=user_record.stripe_customer_id,
        return_url=f"{settings.frontend_url}/settings",
    )
    return BillingPortalResponse(url=portal_url)


# -------------------------------------------------------------------
# DELETE /api/stripe/subscription
# -------------------------------------------------------------------

@router.delete("/subscription")
async def cancel_subscription(
    current_user: Annotated[UserResponse, Depends(get_current_user)],
) -> dict:
    """
    サブスクリプションを期末解約（cancel_at_period_end = True）に設定する。
    即時解約ではなく、現在の請求期間終了時に解約となる。
    解約後もビリングポータルから再開できる。
    """
    user_record = await auth_service.get_user_record_by_id(current_user.id)

    if not user_record.stripe_subscription_id:
        raise HTTPException(400, "有効なサブスクリプションが見つかりません")

    await stripe_service.cancel_subscription(user_record.stripe_subscription_id)
    return {"message": "サブスクリプションを期末解約に設定しました。現在の請求期間終了時に解約されます。"}
