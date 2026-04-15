import { useState } from 'react'
import type { FC, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCoachingMutation } from '@/hooks/useCoaching'
import { CoachingPanel } from '@/components/coaching/CoachingPanel'
import { AdBanner } from '@/components/ads/AdBanner'
import { useAuth } from '@/contexts/AuthContext'

// --- 定数 ---

const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as const

const RANKS = [
  'IRON IV', 'IRON III', 'IRON II', 'IRON I',
  'BRONZE IV', 'BRONZE III', 'BRONZE II', 'BRONZE I',
  'SILVER IV', 'SILVER III', 'SILVER II', 'SILVER I',
  'GOLD IV', 'GOLD III', 'GOLD II', 'GOLD I',
  'PLATINUM IV', 'PLATINUM III', 'PLATINUM II', 'PLATINUM I',
  'EMERALD IV', 'EMERALD III', 'EMERALD II', 'EMERALD I',
  'DIAMOND IV', 'DIAMOND III', 'DIAMOND II', 'DIAMOND I',
  'MASTER', 'GRANDMASTER', 'CHALLENGER',
] as const

// デフォルト送信用ダミー値（将来的にサモナーページのデータと連携予定）
const DEFAULT_STATS = {
  win_rate: 0.5,
  kda: 2.5,
  cs_per_min: 6.0,
  games_played: 10,
}

// --- コンポーネント ---

const CoachingPage: FC = () => {
  const { isAuthenticated, user } = useAuth()
  const [championName, setChampionName] = useState('')
  const [role, setRole] = useState<string>('ADC')
  const [rank, setRank] = useState<string>('GOLD IV')

  const { mutate, data, isPending, error, reset } = useCoachingMutation()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!championName.trim()) return

    mutate({
      champion_name: championName.trim(),
      role,
      rank,
      recent_stats: DEFAULT_STATS,
    })
  }

  const errorMessage = (() => {
    if (!error) return null
    const err = error as { status?: number; message?: string }
    if (err.status === 404) return 'チャンピオンが見つかりませんでした。名前を確認してください。'
    if (err.status === 429) return 'リクエストが多すぎます。しばらくお待ちください。'
    return 'エラーが発生しました。時間をおいて再度お試しください。'
  })()

  // 未ログイン
  if (!isAuthenticated) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-lol-card border border-lol-border rounded-xl p-8 text-center space-y-4">
          <div className="text-4xl font-display font-bold text-lol-gold tracking-wider">
            AI コーチング
          </div>
          <p className="text-lol-text-body text-base">
            この機能を使用するにはログインが必要です。
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-2.5 bg-lol-gold text-[#070B14] font-display font-bold rounded-lg
                       hover:brightness-110 transition-all tracking-wider text-sm"
          >
            ログインする
          </Link>
        </div>
      </main>
    )
  }

  // ログイン済みだが非プレミアム
  if (!user?.isPremium) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-lol-card border border-lol-border rounded-xl p-8 text-center space-y-5">
          <div className="space-y-1">
            <div className="text-4xl font-display font-bold text-lol-gold tracking-wider">
              AI コーチング
            </div>
            <p className="text-lol-text-sub text-sm">
              チャンピオン別のパーソナライズされたアドバイス
            </p>
          </div>

          <div className="bg-lol-bg border border-lol-border rounded-lg px-6 py-5 space-y-2">
            <p className="text-lol-text font-bold text-base">
              AI コーチングはプレミアム機能です
            </p>
            <p className="text-lol-text-sub text-sm">
              月額 ¥980 でフルアクセス — Claude AI によるパーソナライズドアドバイスを利用できます。
            </p>
          </div>

          <Link
            to="/premium"
            className="inline-block px-6 py-2.5 bg-lol-gold text-[#070B14] font-display font-bold rounded-lg
                       hover:brightness-110 transition-all tracking-wider text-sm"
          >
            プレミアムにアップグレード
          </Link>

          <p className="text-xs text-lol-text-sub">
            7日間無料トライアル付き
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* ページタイトル */}
      <div>
        <h1 className="text-3xl font-display font-bold text-lol-gold tracking-wider">
          AI コーチング
        </h1>
        <p className="text-lol-text-sub mt-1 text-sm">
          チャンピオン別のパーソナライズされたアドバイス
        </p>
      </div>

      {/* 入力フォーム */}
      <form
        onSubmit={handleSubmit}
        className="bg-lol-card border border-lol-border rounded-xl p-6 space-y-5"
      >
        {/* チャンピオン名 */}
        <div className="space-y-1.5">
          <label htmlFor="champion" className="text-xs font-bold text-lol-text-sub uppercase tracking-wider">
            チャンピオン名
          </label>
          <input
            id="champion"
            type="text"
            value={championName}
            onChange={(e) => {
              setChampionName(e.target.value)
              if (data) reset()
            }}
            placeholder="例: Jinx, Yasuo, Ahri"
            required
            className="w-full bg-lol-bg border border-lol-border rounded-lg px-4 py-2.5
                       text-lol-text placeholder-lol-text-sub/50 text-sm
                       focus:outline-none focus:border-[#00C6FF] transition-colors"
          />
        </div>

        {/* ロール選択 */}
        <div className="space-y-1.5">
          <label htmlFor="role" className="text-xs font-bold text-lol-text-sub uppercase tracking-wider">
            ロール
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-lol-bg border border-lol-border rounded-lg px-4 py-2.5
                       text-lol-text text-sm
                       focus:outline-none focus:border-[#00C6FF] transition-colors"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* ランク選択 */}
        <div className="space-y-1.5">
          <label htmlFor="rank" className="text-xs font-bold text-lol-text-sub uppercase tracking-wider">
            ランク
          </label>
          <select
            id="rank"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            className="w-full bg-lol-bg border border-lol-border rounded-lg px-4 py-2.5
                       text-lol-text text-sm
                       focus:outline-none focus:border-[#00C6FF] transition-colors"
          >
            {RANKS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={isPending || !championName.trim()}
          className="w-full bg-lol-gold text-[#070B14] font-display font-bold py-3 rounded-lg
                     hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all tracking-wider text-sm"
        >
          {isPending ? '分析中...' : '分析する'}
        </button>
      </form>

      {/* ローディング */}
      {isPending && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-10 h-10 border-4 border-lol-border border-t-[#00C6FF] rounded-full animate-spin" />
          <p className="text-lol-text-sub text-sm">AIが分析中...</p>
        </div>
      )}

      {/* エラー */}
      {errorMessage && (
        <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-4">
          <p className="text-red-400 text-sm">⚠️ {errorMessage}</p>
        </div>
      )}

      {/* 結果表示 */}
      {data && !isPending && (
        <div className="bg-lol-card border border-lol-border rounded-xl p-6">
          <CoachingPanel advice={data} />
        </div>
      )}

      {/* 広告バナー */}
      <AdBanner slot="coaching-bottom" format="horizontal" />
    </main>
  )
}

export default CoachingPage
