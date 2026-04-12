/**
 * プレミアム登録完了ページ
 * Stripe チェックアウト成功後のリダイレクト先: /premium/success
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PremiumBadge } from '@/components/ui/PremiumBadge'

const UNLOCKED_FEATURES = [
  'AIチャンピオン選択アドバイス（Claude API）',
  'デスクトップオーバーレイアプリ（Electron）',
  '広告なしの快適な操作体験',
  '詳細ビルド推奨・メタ分析',
  '優先サポート',
]

const PremiumSuccessPage: FC = () => (
  <div className="min-h-screen bg-lol-bg flex flex-col items-center justify-center px-4">
    <div className="max-w-md w-full text-center">
      {/* アイコン */}
      <div className="mb-6 flex justify-center">
        <div className="w-20 h-20 rounded-full bg-lol-accent/20 border-2 border-lol-accent flex items-center justify-center">
          <span className="text-4xl text-lol-accent font-bold">✓</span>
        </div>
      </div>

      {/* タイトル */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <h1 className="font-display font-bold text-3xl text-lol-text">
          プレミアム会員登録完了！
        </h1>
      </div>
      <PremiumBadge className="mb-6 inline-flex" />

      <p className="text-lol-text-body text-base mb-8">
        ありがとうございます。以下の機能がすべて利用できるようになりました。
      </p>

      {/* アンロックされた機能一覧 */}
      <div className="bg-lol-card border border-lol-border rounded-xl p-6 mb-8 text-left">
        <h2 className="font-display font-bold text-lol-accent text-sm uppercase tracking-wider mb-4">
          利用可能な機能
        </h2>
        <ul className="space-y-3">
          {UNLOCKED_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <span className="text-lol-accent font-bold text-sm mt-0.5">✓</span>
              <span className="text-lol-text-body text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ボタン */}
      <div className="flex flex-col gap-3">
        <Link to="/" className="block">
          <Button variant="primary" size="lg" className="w-full">
            ホームに戻る
          </Button>
        </Link>
        <Link to="/premium" className="block">
          <Button variant="secondary" size="md" className="w-full">
            プランを確認する
          </Button>
        </Link>
      </div>

      <p className="mt-6 text-xs text-lol-text-sub">
        解約・プラン変更はプレミアムページのポータルから行えます
      </p>
    </div>
  </div>
)

export default PremiumSuccessPage
