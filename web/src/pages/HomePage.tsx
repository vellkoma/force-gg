import type { FC } from 'react'
import { HomeSearchBar } from '@/components/search/HomeSearchBar'
import { AdBanner } from '@/components/ads/AdBanner'
import { EsportsSchedule } from '@/components/esports/EsportsSchedule'
import { UpdatePanel } from '@/components/ui/UpdatePanel'

const HomePage: FC = () => {
  return (
    <div>
      {/* ヒーローセクション */}
      <section className="max-w-6xl mx-auto px-4 pt-16 pb-6 text-center animate-fade-in">
        <p className="text-lol-accent font-display font-semibold text-sm tracking-widest uppercase mb-4">
          League of Legends 統計 &amp; AI コーチング
        </p>
        <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl text-lol-text mb-6 leading-tight">
          ランクを上げるための
          <br />
          <span className="text-lol-accent">データ</span>がここに
        </h1>
        <div className="mb-4">
          <HomeSearchBar />
        </div>
      </section>

      {/* 大きい広告（ヒーロー下） */}
      <div className="max-w-6xl mx-auto px-4 mb-6">
        <AdBanner slot="home-hero-bottom" format="billboard" noMargin />
      </div>

      {/* Esports スケジュール */}
      <EsportsSchedule />

      {/* 開発中アップデートパネル（公開時に削除予定） */}
      <UpdatePanel />

      {/* フッター */}
      <footer className="border-t border-lol-border mt-4 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-lol-text-sub space-y-1">
          <p>force.gg は Riot Games が公認したサービスではありません。</p>
          <p>
            force.gg isn't endorsed by Riot Games and doesn't reflect the views or opinions of
            Riot Games or anyone officially involved in producing or managing Riot Games properties.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
