/**
 * Stripe 課金 API クライアント
 * バックエンドの /api/stripe/* エンドポイントと通信する
 */
import apiClient from '@/api/client'
import type {
  BillingPortalResponse,
  CheckoutResponse,
  SubscriptionInfo,
} from '@/types/stripe'

/**
 * Stripe チェックアウトセッションを作成してリダイレクト URL を返す
 * POST /api/stripe/create-checkout
 *
 * @param priceType 'monthly' = ¥980/月, 'yearly' = ¥9,800/年
 * @returns Stripe チェックアウトページの URL
 */
export const createCheckoutSession = async (
  priceType: 'monthly' | 'yearly',
): Promise<CheckoutResponse> => {
  const { data } = await apiClient.post<CheckoutResponse>('/api/stripe/create-checkout', {
    plan: priceType,
  })
  return data
}

/**
 * 現在ログイン中のユーザーのサブスクリプション情報を取得する
 * GET /api/stripe/subscription
 *
 * @returns サブスクリプション情報（未購読の場合は全フィールドが null）
 */
export const getSubscription = async (): Promise<SubscriptionInfo> => {
  const { data } = await apiClient.get<{
    status: SubscriptionInfo['status']
    plan_type: SubscriptionInfo['planType']
    current_period_end: string | null
    trial_end: string | null
  }>('/api/stripe/subscription')

  // snake_case → camelCase 変換
  return {
    status: data.status,
    planType: data.plan_type,
    currentPeriodEnd: data.current_period_end,
    trialEnd: data.trial_end,
  }
}

/**
 * Stripe カスタマーポータルの URL を取得する
 * POST /api/stripe/billing-portal
 *
 * ユーザーはポータルでプラン変更・解約・支払い方法の変更ができる
 */
export const getBillingPortalUrl = async (): Promise<BillingPortalResponse> => {
  const { data } = await apiClient.post<BillingPortalResponse>('/api/stripe/billing-portal')
  return data
}

/**
 * サブスクリプションを期末解約する
 * DELETE /api/stripe/subscription
 *
 * 即時解約ではなく、現在の請求期間終了時に解約となる
 */
export const cancelSubscription = async (): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>('/api/stripe/subscription')
  return data
}
