/**
 * Stripe サブスクリプション関連の型定義
 */

export interface SubscriptionInfo {
  /** サブスクリプションの状態 */
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete' | null
  /** プランの種別 */
  planType: 'monthly' | 'yearly' | null
  /** 現在の請求期間終了日時（ISO 8601） */
  currentPeriodEnd: string | null
  /** トライアル終了日時（ISO 8601）。トライアル中のみ存在 */
  trialEnd: string | null
}

export interface CheckoutRequest {
  plan: 'monthly' | 'yearly'
}

export interface CheckoutResponse {
  url: string
}

export interface BillingPortalResponse {
  url: string
}
