/**
 * プレミアム登録キャンセルページ
 * Stripe チェックアウトキャンセル後のリダイレクト先: /premium/cancel
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

const PremiumCancelPage: FC = () => (
  <div className="min-h-screen bg-lol-bg flex flex-col items-center justify-center px-4">
    <div className="max-w-md w-full text-center">
      {/* アイコン */}
      <div className="mb-6 flex justify-center">
        <div className="w-20 h-20 rounded-full bg-lol-card border-2 border-lol-border flex items-center justify-center">
          <span className="text-4xl text-lol-text-sub">〜</span>
        </div>
      </div>

      {/* タイトル */}
      <h1 className="font-display font-bold text-3xl text-lol-text mb-3">
        また気が向いたらいつでも
      </h1>

      <p className="text-lol-text-body text-base mb-2">
        プレミアム登録はキャンセルされました。
      </p>
      <p className="text-lol-text-sub text-sm mb-8">
        無料プランは引き続きご利用いただけます。
        プレミアムに興味が出たときはいつでも登録できます。
      </p>

      {/* お得ポイント再訴求 */}
      <div className="bg-lol-card border border-lol-border rounded-xl p-5 mb-8 text-left">
        <p className="text-lol-text-sub text-xs uppercase tracking-wider font-bold mb-3">
          プレミアムでできること
        </p>
        <ul className="space-y-2 text-sm text-lol-text-body">
          <li>— AIコーチングで即戦力チャンピオンを選択</li>
          <li>— デスクトップアプリでゲーム中リアルタイム確認</li>
          <li>— 広告なしの快適な操作体験</li>
          <li>— 7日間無料トライアル付き</li>
        </ul>
      </div>

      {/* ボタン */}
      <div className="flex flex-col gap-3">
        <Link to="/premium" className="block">
          <Button variant="primary" size="lg" className="w-full">
            プレミアムページに戻る
          </Button>
        </Link>
        <Link to="/" className="block">
          <Button variant="secondary" size="md" className="w-full">
            ホームに戻る
          </Button>
        </Link>
      </div>
    </div>
  </div>
)

export default PremiumCancelPage
