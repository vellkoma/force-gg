import { type FC, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchChampion, fetchChampionBuilds } from '@/api/champions'
import type { ChampionDetailData } from '@/types/champion'
import { CHAMPION_TAG_LABELS } from '@/types/champion'
import { Card } from '@/components/ui/Card'
import { AdBanner } from '@/components/ads/AdBanner'


const ChampionDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>()

  const { data: champion, isLoading, isError } = useQuery<ChampionDetailData>({
    queryKey: ['champion', id],
    queryFn:  () => fetchChampion(id!),
    enabled:  Boolean(id),
    staleTime: 60 * 60 * 1000,
  })

  const { data: builds, isLoading: buildsLoading } = useQuery({
    queryKey: ['champion-builds', id],
    queryFn:  () => fetchChampionBuilds(id!),
    enabled:  Boolean(id),
    staleTime: 24 * 60 * 60 * 1000,
  })

  useEffect(() => {
    if (champion) {
      document.title = `${champion.name} | force.gg`
    }
    return () => { document.title = 'force.gg' }
  }, [champion])

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* ローディング */}
        {isLoading && (
          <div className="space-y-4">
            <div className="h-48 bg-lol-card border border-lol-border rounded-xl animate-pulse" />
            <div className="h-32 bg-lol-card border border-lol-border rounded-xl animate-pulse" />
          </div>
        )}

        {/* エラー */}
        {isError && (
          <div className="border border-lol-error/30 bg-lol-error/10 rounded-xl p-4">
            <p className="text-lol-error text-sm">チャンピオン情報の取得に失敗しました。</p>
          </div>
        )}

        {/* チャンピオン情報 */}
        {champion && (
          <>
            {/* プロフィールカード */}
            <Card>
              <div className="flex gap-6">
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champion.id}_0.jpg`}
                  alt={champion.name}
                  onError={(e) => { e.currentTarget.src = champion.image_url }}
                  className="w-32 h-40 object-cover object-top rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {champion.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs border border-lol-accent/50 text-lol-accent px-2 py-0.5 rounded"
                      >
                        {CHAMPION_TAG_LABELS[tag] ?? tag}
                      </span>
                    ))}
                  </div>
                  <h1 className="font-display font-bold text-3xl text-lol-text">{champion.name}</h1>
                  <p className="text-lol-text-sub text-sm mb-3">{champion.title}</p>
                  <p className="text-lol-text-body text-sm leading-relaxed">{champion.blurb}</p>
                  <p className="text-xs text-lol-text-sub mt-3">
                    リソース: {champion.partype || '—'}
                  </p>
                </div>
              </div>
            </Card>

            {/* 基本ステータス */}
            <Card>
              <h2 className="font-display font-bold text-lg text-lol-text mb-4">基本ステータス</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {[
                  { label: 'HP',      value: champion.stats.hp },
                  { label: 'HP/Lv',   value: champion.stats.hpperlevel },
                  { label: 'MP',      value: champion.stats.mp },
                  { label: '移動速度', value: champion.stats.movespeed },
                  { label: '鎧',      value: champion.stats.armor },
                  { label: '魔法耐性', value: champion.stats.spellblock },
                  { label: '攻撃射程', value: champion.stats.attackrange },
                  { label: 'AD',      value: champion.stats.attackdamage },
                  { label: 'AS',      value: Number(champion.stats.attackspeed.toFixed(3)) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-lol-bg rounded-lg px-3 py-2">
                    <p className="text-lol-text-sub">{label}</p>
                    <p className="text-lol-text font-bold mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* 広告（ステータスとビルドの間） */}
            <AdBanner slot="champion-detail-mid" format="horizontal" />

            {/* ビルド推奨 */}
            <Card>
              <h2 className="font-display font-bold text-lg text-lol-text mb-4">推奨ビルド</h2>
              {buildsLoading && (
                <div className="h-24 bg-lol-bg rounded-lg animate-pulse" />
              )}
              {!buildsLoading && builds && (
                <div className="space-y-5">
                  {/* コアアイテム */}
                  <div>
                    <p className="text-xs text-lol-text-sub mb-3">コアアイテム</p>
                    <div className="flex flex-wrap gap-3">
                      {builds.core_items.map((item) => (
                        <div key={item.id} className="flex flex-col items-center gap-1 w-16">
                          <img
                            src={item.image_url}
                            alt={item.name}
                            title={item.name}
                            className="w-12 h-12 rounded-lg border border-lol-border"
                          />
                          <span className="text-[10px] text-lol-text-sub text-center leading-tight line-clamp-2">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-lol-accent">{item.gold_total}G</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ルーン */}
                  <div>
                    <p className="text-xs text-lol-text-sub mb-3">推奨ルーン</p>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        {builds.rune_primary.icon && (
                          <img
                            src={`https://ddragon.leagueoflegends.com/cdn/img/${builds.rune_primary.icon}`}
                            alt={builds.rune_primary.name}
                            className="w-8 h-8"
                          />
                        )}
                        <div>
                          <p className="text-xs text-lol-text">{builds.rune_primary.name}</p>
                          <p className="text-[10px] text-lol-text-sub">プライマリ</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {builds.rune_secondary.icon && (
                          <img
                            src={`https://ddragon.leagueoflegends.com/cdn/img/${builds.rune_secondary.icon}`}
                            alt={builds.rune_secondary.name}
                            className="w-8 h-8"
                          />
                        )}
                        <div>
                          <p className="text-xs text-lol-text">{builds.rune_secondary.name}</p>
                          <p className="text-[10px] text-lol-text-sub">セカンダリ</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-lol-text-sub">
                    ※ Data Dragon 公式データを元にした推奨です。実際のマッチ統計ではありません。
                  </p>
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {/* フッター */}
      <footer className="border-t border-lol-border mt-20 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-lol-text-sub">
          <p>force.gg は Riot Games が公認したサービスではありません。</p>
        </div>
      </footer>
    </div>
  )
}

export default ChampionDetailPage
