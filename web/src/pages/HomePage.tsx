import { useState, type FC, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { SummonerSearchBar } from '@/components/summoner/SummonerSearchBar'
import { AdBanner } from '@/components/ads/AdBanner'

type SearchMode = 'summoner' | 'champion'

const FEATURES = [
  {
    icon:        '📊',
    title:       'チャンピオン統計',
    description: '最新パッチの勝率・ピック率・バン率をリアルタイムで確認。',
    href:        '/champions',
  },
  {
    icon:        '🔍',
    title:       'サモナー検索',
    description: '戦績・ランク・KDA・使用チャンピオンを一覧表示。GameName#TAG形式で検索できます。',
    href:        '/summoner',
  },
  {
    icon:        '🤖',
    title:       'AIコーチング',
    description: 'Claude AIがあなたのプレイを分析し、改善ポイントをアドバイス。（プレミアム機能）',
    href:        '#',
  },
] as const

const HomePage: FC = () => {
  const navigate = useNavigate()
  const [mode, setMode]               = useState<SearchMode>('summoner')
  const [championQuery, setChampionQuery] = useState('')

  const handleSummonerSearch = (gameName: string, tagLine: string) => {
    navigate(`/summoner/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`)
  }

  const handleChampionSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = championQuery.trim()
    if (!q) return
    navigate(`/champions?q=${encodeURIComponent(q)}`)
  }

  return (
    <div>
      {/* ヒーローセクション */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center animate-fade-in">
        <p className="text-lol-accent font-display font-semibold text-sm tracking-widest uppercase mb-4">
          League of Legends 統計 &amp; AI コーチング
        </p>
        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl text-lol-text mb-6 leading-tight">
          ランクを上げるための
          <br />
          <span className="text-lol-accent">データ</span>がここに
        </h1>
        <p className="text-lol-text-body text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          チャンピオン統計・サモナー戦績・AIコーチングを一つのプラットフォームで。
          日本サーバー（JP1）のデータに対応しています。
        </p>

        {/* 検索バー */}
        <div className="mb-8 w-full max-w-2xl mx-auto">
          {/* タブ */}
          <div className="flex mb-3 bg-lol-card border border-lol-border rounded-xl p-1 w-fit mx-auto">
            <button
              type="button"
              onClick={() => setMode('summoner')}
              className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                mode === 'summoner'
                  ? 'bg-lol-accent text-lol-bg'
                  : 'text-lol-text-sub hover:text-lol-text'
              }`}
            >
              サモナー
            </button>
            <button
              type="button"
              onClick={() => setMode('champion')}
              className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                mode === 'champion'
                  ? 'bg-lol-accent text-lol-bg'
                  : 'text-lol-text-sub hover:text-lol-text'
              }`}
            >
              チャンピオン
            </button>
          </div>

          {/* 検索フォーム */}
          {mode === 'summoner' ? (
            <SummonerSearchBar onSearch={handleSummonerSearch} />
          ) : (
            <form onSubmit={handleChampionSearch} className="flex gap-2">
              <input
                type="text"
                value={championQuery}
                onChange={(e) => setChampionQuery(e.target.value)}
                placeholder="チャンピオン名を入力（例: アーリ、Jinx）"
                aria-label="チャンピオン名を入力"
                className="flex-1 bg-lol-card border border-lol-border hover:border-lol-border-hover rounded-xl px-4 py-3 text-lol-text placeholder-lol-text-sub text-base outline-none transition-colors duration-200 focus:border-lol-accent focus:ring-1 focus:ring-lol-accent/40"
              />
              <button
                type="submit"
                className="shrink-0 px-6 py-3 bg-lol-accent text-lol-bg font-bold rounded-xl hover:brightness-110 transition-all duration-200"
              >
                検索
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/champions"
            className="inline-flex items-center justify-center gap-2 font-display
                       bg-lol-accent text-lol-bg font-bold hover:brightness-110
                       border border-lol-accent px-6 py-3 text-lg rounded-xl
                       transition-all duration-200"
          >
            チャンピオン統計を見る
          </Link>
          <Link
            to="/summoner"
            className="inline-flex items-center justify-center gap-2 font-display
                       bg-transparent text-lol-text-body border border-lol-border
                       hover:border-lol-border-hover hover:bg-white/5
                       px-6 py-3 text-lg rounded-xl transition-all duration-200"
          >
            サモナー検索
          </Link>
        </div>
      </section>

      {/* 広告（ヒーロー下） */}
      <div className="max-w-6xl mx-auto px-4">
        <AdBanner slot="home-hero-bottom" format="horizontal" />
      </div>

      {/* 機能カードセクション */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="font-display font-bold text-2xl text-center text-lol-text mb-8">
          主な機能
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <Card key={feature.title} hoverable className="text-center">
              <div className="text-4xl mb-3" aria-hidden="true">
                {feature.icon}
              </div>
              <h3 className="font-display font-bold text-lg text-lol-text mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-lol-text-body leading-relaxed">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-lol-border mt-20 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-lol-text-sub space-y-1">
          <p>LoL Stats JP は Riot Games が公認したサービスではありません。</p>
          <p>
            LoL Stats JP isn't endorsed by Riot Games and doesn't reflect the views or opinions of
            Riot Games or anyone officially involved in producing or managing Riot Games properties.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
