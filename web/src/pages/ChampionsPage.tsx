import { type FC, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useChampions } from '@/hooks/useChampions'
import { ChampionGrid } from '@/components/champions/ChampionGrid'
import type { ChampionTag } from '@/types/champion'
import { CHAMPION_TAG_LABELS } from '@/types/champion'
import { AdBanner } from '@/components/ads/AdBanner'

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

const VALID_ROLES = new Set<string>(['ALL', 'Fighter', 'Tank', 'Mage', 'Assassin', 'Marksman', 'Support'])

const ChampionsPage: FC = () => {
  const { data, isLoading, error } = useChampions()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawRole   = searchParams.get('role') ?? 'ALL'
  const activeRole: RoleFilter = VALID_ROLES.has(rawRole) ? (rawRole as RoleFilter) : 'ALL'
  const searchText = searchParams.get('q') ?? ''

  const setActiveRole = (role: RoleFilter) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (role === 'ALL') next.delete('role')
      else next.set('role', role)
      return next
    }, { replace: true })
  }

  const setSearchText = (text: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (text.trim() === '') next.delete('q')
      else next.set('q', text)
      return next
    }, { replace: true })
  }

  useEffect(() => {
    document.title = 'チャンピオン分析 | force.gg'
    return () => { document.title = 'force.gg' }
  }, [])

  const filtered = useMemo(() => {
    if (!data?.champions) return []
    return data.champions.filter((c) => {
      const matchesSearch =
        searchText.trim() === '' ||
        c.name.includes(searchText.trim()) ||
        c.title.includes(searchText.trim()) ||
        c.id.toLowerCase().includes(searchText.trim().toLowerCase())
      const matchesRole = activeRole === 'ALL' || c.tags.includes(activeRole as ChampionTag)
      return matchesSearch && matchesRole
    })
  }, [data?.champions, searchText, activeRole])

  return (
    <div>
      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* ヘッダー + 検索 + フィルター（1行にまとめる） */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* タイトル */}
          <div className="flex items-baseline gap-2 shrink-0">
            <h1 className="font-display font-bold text-xl text-lol-text">チャンピオン分析</h1>
            {!isLoading && data && (
              <span className="text-xs text-lol-text-sub">
                {filtered.length}{activeRole !== 'ALL' || searchText ? ` / ${data.total}` : ''}体
              </span>
            )}
          </div>

          {/* 検索バー */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <svg
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-lol-text-sub pointer-events-none"
            >
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="チャンピオン名で検索"
              aria-label="チャンピオン名で検索"
              className="w-full bg-lol-card border border-lol-border rounded-lg pl-9 pr-3 py-2 text-sm text-lol-text placeholder:text-lol-text-sub focus:outline-none focus:border-lol-accent focus:ring-1 focus:ring-lol-accent transition-colors"
            />
          </div>

          {/* ロールフィルター */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="ロールで絞り込む">
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

          {/* パッチバージョン（右端） */}
          {data?.version && (
            <span className="ml-auto text-xs text-lol-text-sub shrink-0 hidden sm:block">
              パッチ {data.version}
            </span>
          )}
        </div>

        {/* 広告 */}
        <AdBanner slot="champions-top" format="horizontal" />

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
