import { useState } from 'react'
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PremiumBadge } from '@/components/ui/PremiumBadge'
import { useAuth } from '@/contexts/AuthContext'
import { createCheckoutSession, getSubscription, getBillingPortalUrl } from '@/api/stripe'

// -------------------------------------------------------------------
// 機能比較テーブルデータ
// -------------------------------------------------------------------

interface FeatureRow {
  label:   string
  free:    boolean | string
  premium: boolean | string
}

const FEATURES: FeatureRow[] = [
  { label: 'チャンピオン一覧・基本統計',                                       free: true,        premium: true },
  { label: 'サモナー検索・戦績表示',                                           free: '直近5試合', premium: '全件表示' },
  { label: 'AI コーチング機能（Claude AI によるパーソナライズドアドバイス）', free: false,       premium: true },
  { label: 'AIチャンピオン選択アドバイス',                                     free: false,       premium: true },
  { label: 'デスクトップオーバーレイアプリ',                                   free: false,       premium: true },
  { label: '広告非表示',                                                       free: false,       premium: true },
  { label: '詳細ビルド推奨',                                                   free: false,       premium: true },
  { label: '優先サポート',                                                     free: false,       premium: true },
]

// -------------------------------------------------------------------
// サブコンポーネント
// -------------------------------------------------------------------

const Check: FC<{ ok: boolean | string }> = ({ ok }) => {
  if (ok === true)  return <span className="text-lol-success text-lg">✓</span>
  if (ok === false) return <span className="text-lol-text-sub text-lg">—</span>
  return <span className="text-lol-text-body text-sm">{ok}</span>
}

interface PricingCardProps {
  title: string
  price: string
  period: string
  badge?: string
  description: string
  priceType: 'monthly' | 'yearly'
  isSelected: boolean
  onSelect: () => void
}

const PricingCard: FC<PricingCardProps> = ({
  title, price, period, badge, description, isSelected, onSelect,
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={[
      'w-full text-left rounded-xl border-2 p-6 transition-all duration-200 cursor-pointer',
      isSelected
        ? 'border-lol-accent bg-lol-accent/10'
        : 'border-lol-border bg-lol-card hover:border-lol-accent/50',
    ].join(' ')}
  >
    <div className="flex items-start justify-between gap-2 mb-2">
      <span className="font-display font-bold text-lol-text text-lg">{title}</span>
      {badge && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-lol-accent text-lol-bg whitespace-nowrap">
          {badge}
        </span>
      )}
    </div>
    <div className="flex items-baseline gap-1 mb-1">
      <span className="font-display font-bold text-3xl text-lol-accent">{price}</span>
      <span className="text-lol-text-sub text-sm">{period}</span>
    </div>
    <p className="text-lol-text-sub text-sm">{description}</p>
    {isSelected && (
      <div className="mt-3 flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-lol-accent flex items-center justify-center text-lol-bg text-xs font-bold">
          ✓
        </span>
        <span className="text-lol-accent text-sm font-medium">選択中</span>
      </div>
    )}
  </button>
)

// -------------------------------------------------------------------
// メインページ
// -------------------------------------------------------------------

const PremiumPage: FC = () => {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly')

  // サブスクリプション情報（ログイン済みのみ取得）
  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: getSubscription,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const isSubscribed =
    subscription?.status === 'active' || subscription?.status === 'trialing'

  // チェックアウトセッション作成
  const checkout = useMutation({
    mutationFn: () => createCheckoutSession(selectedPlan),
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  // ビリングポータル
  const portal = useMutation({
    mutationFn: getBillingPortalUrl,
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  const handleCTA = () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (isSubscribed) {
      portal.mutate()
    } else {
      checkout.mutate()
    }
  }

  const ctaLabel = () => {
    if (!isAuthenticated)           return 'ログインして始める'
    if (isSubscribed)               return 'プランを管理する'
    return '7日間無料トライアルを開始'
  }

  const isLoading = checkout.isPending || portal.isPending

  return (
    <div>

      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* ヒーローセクション */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="font-display font-bold text-4xl text-lol-text">
              LoL Stats JP
            </h1>
            <PremiumBadge className="text-sm px-3 py-1" />
          </div>
          <p className="text-lol-text-body text-lg mb-2">
            すべての機能をアンロックして、ランクアップを加速しよう。
          </p>

          {/* 購読中ステータス表示 */}
          {isSubscribed && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-lol-success/10 border border-lol-success/30 text-lol-success text-sm font-medium">
              <span>プレミアム会員 — {subscription?.status === 'trialing' ? 'トライアル中' : '有効'}</span>
            </div>
          )}
        </div>

        {/* 7日間無料トライアルバナー */}
        {!isSubscribed && (
          <div className="mb-8 rounded-xl bg-lol-accent/10 border border-lol-accent/30 p-4 text-center">
            <p className="text-lol-accent font-bold text-sm">
              7日間無料トライアル付き — クレジットカードなしでは開始できません
            </p>
            <p className="text-lol-text-sub text-xs mt-1">
              トライアル期間中はいつでもキャンセル可能。課金は8日目から開始します。
            </p>
          </div>
        )}

        {/* 料金カード */}
        {!isSubscribed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <PricingCard
              title="月額プラン"
              price="¥980"
              period="/ 月"
              description="いつでも解約可能"
              priceType="monthly"
              isSelected={selectedPlan === 'monthly'}
              onSelect={() => setSelectedPlan('monthly')}
            />
            <PricingCard
              title="年額プラン"
              price="¥9,800"
              period="/ 年"
              badge="2ヶ月分お得！"
              description="月あたり ¥817（¥163お得）"
              priceType="yearly"
              isSelected={selectedPlan === 'yearly'}
              onSelect={() => setSelectedPlan('yearly')}
            />
          </div>
        )}

        {/* 機能比較テーブル */}
        <Card accent className="mb-8 p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lol-border bg-lol-card2">
                <th className="text-left px-5 py-3 font-display font-bold text-lol-text">
                  機能
                </th>
                <th className="text-center px-5 py-3 font-display font-bold text-lol-text-sub w-24">
                  無料
                </th>
                <th className="text-center px-5 py-3 font-display font-bold text-lol-accent w-28">
                  プレミアム
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((row, i) => (
                <tr
                  key={row.label}
                  className={[
                    'border-b border-lol-border last:border-0 transition-colors hover:bg-lol-accent/5',
                    i % 2 === 0 ? 'bg-lol-card' : 'bg-lol-card2',
                  ].join(' ')}
                >
                  <td className="px-5 py-3 text-lol-text-body">{row.label}</td>
                  <td className="px-5 py-3 text-center"><Check ok={row.free} /></td>
                  <td className="px-5 py-3 text-center"><Check ok={row.premium} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* CTA */}
        <div className="text-center">
          {checkout.isError && (
            <p className="mb-3 text-sm text-red-400">
              エラーが発生しました。もう一度お試しください。
            </p>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={handleCTA}
            disabled={isLoading}
            className="w-full max-w-xs"
          >
            {isLoading ? '処理中...' : ctaLabel()}
          </Button>

          {!isAuthenticated && (
            <p className="mt-3 text-xs text-lol-text-sub">
              アカウントを作成して7日間無料でお試しください
            </p>
          )}

          {isSubscribed && (
            <p className="mt-3 text-xs text-lol-text-sub">
              ポータルからプラン変更・解約ができます
            </p>
          )}

          {!isSubscribed && isAuthenticated && (
            <p className="mt-3 text-xs text-lol-text-sub">
              Stripe の安全な決済画面に移動します
            </p>
          )}
        </div>

        {/* ログイン済みユーザー名表示 */}
        {user && (
          <p className="text-center mt-6 text-xs text-lol-text-sub">
            {user.email} でログイン中
          </p>
        )}
      </div>

      {/* フッター */}
      <footer className="border-t border-lol-border mt-20 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-lol-text-sub">
          <p>LoL Stats JP は Riot Games が公認したサービスではありません。</p>
          <p className="mt-1">決済は Stripe を通じて安全に処理されます。</p>
        </div>
      </footer>
    </div>
  )
}

export default PremiumPage
