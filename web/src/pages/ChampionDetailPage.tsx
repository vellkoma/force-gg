import { type FC, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchChampion, fetchChampionBuilds } from '@/api/champions'
import { useChampionPositionStats } from '@/hooks/useChampions'
import type { ChampionDetailData } from '@/types/champion'
import { CHAMPION_TAG_LABELS, POSITION_LABELS } from '@/types/champion'
import { Card } from '@/components/ui/Card'
import { AdBanner } from '@/components/ads/AdBanner'

type Tab = 'spec' | 'build' | 'stats'

const RANK_OPTIONS = [
  { value: 'PLATINUM_PLUS', label: 'プラチナ+' },
  { value: 'GOLD_PLUS',     label: 'ゴールド+' },
  { value: 'DIAMOND_PLUS',  label: 'ダイヤ+' },
  { value: 'ALL',           label: '全ランク' },
]

const ChampionDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('spec')
  const [rank, setRank] = useState('PLATINUM_PLUS')

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

  const { data: posStats, isLoading: statsLoading } = useChampionPositionStats(id, rank)

  useEffect(() => {
    if (champion) document.title = `${champion.name} | force.gg`
    return () => { document.title = 'force.gg' }
  }, [champion])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'spec',  label: 'スペック' },
    { key: 'build', label: 'ビルド' },
    { key: 'stats', label: '統計' },
  ]

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {isLoading && (
          <div className="space-y-4">
            <div className="h-48 bg-lol-card border border-lol-border rounded-xl animate-pulse" />
            <div className="h-32 bg-lol-card border border-lol-border rounded-xl animate-pulse" />
          </div>
        )}

        {isError && (
          <div className="border border-lol-error/30 bg-lol-error/10 rounded-xl p-4">
            <p className="text-lol-error text-sm">チャンピオン情報の取得に失敗しました。</p>
          </div>
        )}

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
                      <span key={tag} className="text-xs border border-lol-accent/50 text-lol-accent px-2 py-0.5 rounded">
                        {CHAMPION_TAG_LABELS[tag] ?? tag}
                      </span>
                    ))}
                  </div>
                  <h1 className="font-display font-bold text-3xl text-lol-text">{champion.name}</h1>
                  <p className="text-lol-text-sub text-sm mb-3">{champion.title}</p>
                  <p className="text-lol-text-body text-sm leading-relaxed">{champion.blurb}</p>
                  <p className="text-xs text-lol-text-sub mt-3">リソース: {champion.partype || '—'}</p>
                </div>
              </div>
            </Card>

            {/* タブ */}
            <div className="flex border-b border-lol-border gap-1">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={[
                    'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === key
                      ? 'border-lol-accent text-lol-accent'
                      : 'border-transparent text-lol-text-sub hover:text-lol-text',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>

            <AdBanner slot="champion-detail-mid" format="horizontal" />

            {/* スペックタブ */}
            {activeTab === 'spec' && (
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
            )}

            {/* ビルドタブ */}
            {activeTab === 'build' && (
              <Card>
                <h2 className="font-display font-bold text-lg text-lol-text mb-4">推奨ビルド</h2>
                {buildsLoading && <div className="h-24 bg-lol-bg rounded-lg animate-pulse" />}
                {!buildsLoading && builds && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs text-lol-text-sub mb-3">コアアイテム</p>
                      <div className="flex flex-wrap gap-3">
                        {builds.core_items.map((item) => (
                          <div key={item.id} className="flex flex-col items-center gap-1 w-16">
                            <img src={item.image_url} alt={item.name} title={item.name}
                              className="w-12 h-12 rounded-lg border border-lol-border" />
                            <span className="text-[10px] text-lol-text-sub text-center leading-tight line-clamp-2">{item.name}</span>
                            <span className="text-[10px] text-lol-accent">{item.gold_total}G</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-lol-text-sub mb-3">推奨ルーン</p>
                      <div className="flex gap-4">
                        {[
                          { rune: builds.rune_primary,   label: 'プライマリ' },
                          { rune: builds.rune_secondary, label: 'セカンダリ' },
                        ].map(({ rune, label }) => (
                          <div key={label} className="flex items-center gap-2">
                            {rune.icon && (
                              <img src={`https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`}
                                alt={rune.name} className="w-8 h-8" />
                            )}
                            <div>
                              <p className="text-xs text-lol-text">{rune.name}</p>
                              <p className="text-[10px] text-lol-text-sub">{label}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-lol-text-sub">
                      ※ Data Dragon 公式データを元にした推奨です。実際のマッチ統計ではありません。
                    </p>
                  </div>
                )}
              </Card>
            )}

            {/* 統計タブ */}
            {activeTab === 'stats' && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-lg text-lol-text">ポジション別統計</h2>
                  <div className="flex gap-1.5">
                    {RANK_OPTIONS.map(({ value, label }) => (
                      <button key={value} onClick={() => setRank(value)}
                        className={[
                          'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                          rank === value
                            ? 'bg-lol-accent border-lol-accent text-lol-bg font-bold'
                            : 'border-lol-border text-lol-text-sub hover:border-lol-accent hover:text-lol-accent',
                        ].join(' ')}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {statsLoading && <div className="h-48 bg-lol-bg rounded-lg animate-pulse" />}

                {!statsLoading && posStats && posStats.length > 0 && (
                  <div className="space-y-6">
                    {/* ピック率バーチャート */}
                    <div>
                      <p className="text-xs text-lol-text-sub mb-3">ポジション別ピック率</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={posStats.map(p => ({
                          name: POSITION_LABELS[p.position] ?? p.position,
                          'ピック率': Number((p.pick_rate * 100).toFixed(2)),
                        }))} barCategoryGap="30%">
                          <XAxis dataKey="name" tick={{ fill: '#8a9bb5', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#8a9bb5', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" width={36} />
                          <Tooltip
                            contentStyle={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, fontSize: 12 }}
                            formatter={(val: number) => [`${val}%`, 'ピック率']}
                          />
                          <Bar dataKey="ピック率" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* ポジション別数値テーブル */}
                    <div className="grid gap-2">
                      {posStats.map((p) => (
                        <div key={p.position} className="flex items-center gap-4 bg-lol-bg rounded-lg px-4 py-2.5 text-sm">
                          <span className="w-20 text-lol-text-sub text-xs shrink-0">
                            {POSITION_LABELS[p.position] ?? p.position}
                          </span>
                          <div>
                            <p className="text-[10px] text-lol-text-sub">ピック率</p>
                            <p className="text-lol-text font-bold">{(p.pick_rate * 100).toFixed(2)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-lol-text-sub">
                      データソース: Meraki Analytics（最新パッチ・ピック率のみ）
                    </p>
                  </div>
                )}

                {!statsLoading && (!posStats || posStats.length === 0) && (
                  <p className="text-lol-text-sub text-sm text-center py-8">
                    統計データが見つかりませんでした。
                  </p>
                )}
              </Card>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-lol-border mt-20 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-lol-text-sub">
          <p>force.gg は Riot Games が公認したサービスではありません。</p>
        </div>
      </footer>
    </div>
  )
}

export default ChampionDetailPage
