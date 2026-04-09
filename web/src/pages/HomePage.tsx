import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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
    description: '戦績・ランク・KDA・使用チャンピオンを一覧表示。（準備中）',
    href:        '#',
  },
  {
    icon:        '🤖',
    title:       'AIコーチング',
    description: 'Claude AIがあなたのプレイを分析し、改善ポイントを日本語でアドバイス。（プレミアム機能）',
    href:        '#',
  },
] as const

const HomePage: FC = () => {
  return (
    <div className="min-h-screen bg-lol-bg">
      {/* ナビゲーションバー */}
      <nav className="border-b border-lol-border bg-lol-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-bold text-xl text-lol-accent tracking-wide">
            LoL Stats JP
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/champions"
              className="text-sm text-lol-text-body hover:text-lol-accent transition-colors"
            >
              チャンピオン
            </Link>
            <Button variant="secondary" size="sm" disabled>
              サインイン（準備中）
            </Button>
          </div>
        </div>
      </nav>

      {/* ヒーローセクション */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center animate-fade-in">
        <p className="text-lol-accent font-display font-semibold text-sm tracking-widest uppercase mb-4">
          日本語対応 / League of Legends 統計
        </p>
        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl text-lol-text mb-6 leading-tight">
          ランクを上げるための
          <br />
          <span className="text-lol-accent">データ</span>がここに
        </h1>
        <p className="text-lol-text-body text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          チャンピオン統計・サモナー戦績・AIコーチングを完全日本語でお届け。
          日本サーバー（JP1）のデータに特化しています。
        </p>
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
          <Button variant="ghost" size="lg" disabled>
            サモナーを検索（準備中）
          </Button>
        </div>
      </section>

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
