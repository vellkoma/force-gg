import { type FC, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useChampions } from '@/hooks/useChampions'
import { ChampionGrid } from '@/components/champions/ChampionGrid'
import type { ChampionTag } from '@/types/champion'
import { CHAMPION_TAG_LABELS } from '@/types/champion'

// ロールフィルターの選択肢
type RoleFilter = 'ALL' | ChampionTag

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'ALL',       label: '全て' },
  { value: 'Fighter',   label: CHAMPION_TAG_LABELS.Fighter },
  { value: 'Tank',      label: CHAMPION_TAG_LABELS.Tank },
  { value: 'Mage',      label: CHAMPION_TAG_LABELS.Mage },
  { value: 'Assassin',  label: CHAMPION_TAG_LABELS.Assassin },
  { value: 'Marksman',  label: CHAMPION_TAG_LABELS.Marksman },
  { value: 'Support',   label: CHAMPION_TAG_LABELS.Support },
]

const ChampionsPage: FC = () => {
  const { data, isLoading, error } = useChampions()

  const [searchText, setSearchText]   = useState('')
  const [activeRole, setActiveRole]   = useState<RoleFilter>('ALL')

  // フロントエンド側でフィルタリング
  const filtered = useMemo(() => {
    if (!data?.champions) return []

    return data.champions.filter((c) => {
      const matchesSearch =
        searchText.trim() === '' ||
        c.name.includes(searchText.trim()) ||
        c.title.includes(searchText.trim()) ||
        c.id.toLowerCase().includes(searchText.trim().toLowerCase())

      const matchesRole =
        activeRole === 'ALL' || c.tags.includes(activeRole as ChampionTag)

      return matchesSearch && matchesRole
    })
  }, [data?.champions, searchText, activeRole])

  return (
    <div className="min-h-screen bg-lol-bg">
      {/* ナビゲーションバー */}
      <nav className="border-b border-lol-border bg-lol-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            to="/"
            className="font-display font-bold text-xl text-lol-accent tracking-wide
                       hover:text-lol-text transition-colors"
          >
            LoL Stats JP
          </Link>
          <span className="text-lol-border" aria-hidden="true">/</span>
          <span className="text-sm text-lol-text-sub">チャンピオン一覧</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* ページヘッダー */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display font-bold text-3xl text-lol-text">
              チャンピオン一覧
            </h1>
            {/* チャンピオン数バッジ */}
            {!isLoading && data && (
              <span className="text-sm text-lol-text-sub font-sans">
                {filtered.length.toLocaleString('ja-JP')} チャンピオン
                {activeRole !== 'ALL' || searchText
                  ? ` / 全 ${data.total.toLocaleString('ja-JP')}`
                  : ''}
              </span>
            )}
          </div>
          <p className="text-lol-text-sub text-sm mt-1">
            最新パッチ {data?.version ?? '—'} のチャンピオンデータ
          </p>
        </div>

        {/* 検索バー + ロールフィルター */}
        <div className="flex flex-col gap-3 mb-6">
          {/* 検索バー */}
          <div className="relative max-w-md">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-lol-text-sub text-base pointer-events-none"
              aria-hidden="true"
            >
              {/* 検索アイコン（SVG） */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="チャンピオン名で検索..."
              aria-label="チャンピオン名で検索"
              className="w-full bg-lol-card border border-lol-border rounded-xl
                         pl-9 pr-4 py-2.5 text-sm text-lol-text placeholder:text-lol-text-sub
                         focus:outline-none focus:border-lol-accent focus:ring-1 focus:ring-lol-accent
                         transition-colors"
            />
          </div>

          {/* ロールフィルターボタン */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="ロールで絞り込む">
            {ROLE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setActiveRole(value)}
                aria-pressed={activeRole === value}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
                  activeRole === value
                    ? 'bg-lol-accent border-lol-accent text-lol-bg font-bold'
                    : 'border-lol-border text-lol-text-sub hover:border-lol-accent hover:text-lol-accent',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* チャンピオングリッド */}
        <ChampionGrid
          champions={filtered}
          isLoading={isLoading}
          error={error as Error | null}
        />
      </main>
    </div>
  )
}

export default ChampionsPage
