import { type FC, useMemo, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useChampions, useAllChampionStats, useAvailablePatches, useRankQuality } from '@/hooks/useChampions'
import { formatPatch } from '@/utils/patch'
import { TierList, type TierSortBy } from '@/components/champions/TierList'
import { ChampionAnalysisPanel } from '@/components/champions/ChampionAnalysisPanel'
import type { ChampionTag } from '@/types/champion'
import { CHAMPION_TAG_LABELS } from '@/types/champion'
import { AdBanner } from '@/components/ads/AdBanner'

type RoleFilter = 'ALL' | ChampionTag
type ViewMode   = 'grid' | 'tier'

// 50音行マッピング（カタカナ対応）
function getKanaRow(name: string): string {
  const c = name[0] ?? ''
  if ('アイウエオァィゥェォ'.includes(c)) return 'ア'
  if ('カキクケコガギグゲゴヵヶ'.includes(c)) return 'カ'
  if ('サシスセソザジズゼゾ'.includes(c)) return 'サ'
  if ('タチツテトダヂヅデドッ'.includes(c)) return 'タ'
  if ('ナニヌネノ'.includes(c)) return 'ナ'
  if ('ハヒフヘホバビブベボパピプペポ'.includes(c)) return 'ハ'
  if ('マミムメモ'.includes(c)) return 'マ'
  if ('ヤユヨャュョ'.includes(c)) return 'ヤ'
  if ('ラリルレロ'.includes(c)) return 'ラ'
  if ('ワヲン'.includes(c)) return 'ワ'
  return '他'
}

const KANA_ROWS = ['ア', 'カ', 'サ', 'タ', 'ナ', 'ハ', 'マ', 'ヤ', 'ラ', 'ワ', '他'] as const

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'ALL',       label: '全て' },
  { value: 'Fighter',   label: CHAMPION_TAG_LABELS.Fighter },
  { value: 'Tank',      label: CHAMPION_TAG_LABELS.Tank },
  { value: 'Mage',      label: CHAMPION_TAG_LABELS.Mage },
  { value: 'Assassin',  label: CHAMPION_TAG_LABELS.Assassin },
  { value: 'Marksman',  label: CHAMPION_TAG_LABELS.Marksman },
  { value: 'Support',   label: CHAMPION_TAG_LABELS.Support },
]

const RANK_OPTIONS = [
  { value: 'CHALLENGER',  label: 'チャレンジャー' },
  { value: 'GRANDMASTER', label: 'グランドマスター' },
  { value: 'MASTER',      label: 'マスター' },
  { value: 'DIAMOND',     label: 'ダイヤモンド' },
  { value: 'EMERALD',     label: 'エメラルド' },
  { value: 'PLATINUM',    label: 'プラチナ' },
  { value: 'GOLD',        label: 'ゴールド' },
  { value: 'SILVER',      label: 'シルバー' },
  { value: 'BRONZE',      label: 'ブロンズ' },
  { value: 'IRON',        label: 'アイアン' },
]

const POSITION_OPTIONS = [
  { value: 'ALL',     label: '全て' },
  { value: 'TOP',     label: 'TOP' },
  { value: 'JUNGLE',  label: 'JG' },
  { value: 'MID',     label: 'MID' },
  { value: 'ADC',     label: 'ADC' },
  { value: 'SUPPORT', label: 'SUP' },
]

const SORT_OPTIONS: { value: TierSortBy; label: string }[] = [
  { value: 'win_rate',  label: '勝率順' },
  { value: 'pick_rate', label: 'ピック率順' },
  { value: 'ban_rate',  label: 'BAN率順' },
]

const VALID_ROLES = new Set<string>(['ALL', 'Fighter', 'Tank', 'Mage', 'Assassin', 'Marksman', 'Support'])
const VALID_POSITIONS = new Set<string>(['ALL', 'TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'])
const VALID_SORTS = new Set<string>(['win_rate', 'pick_rate', 'ban_rate'])

const ChampionsPage: FC = () => {
  const { data, isLoading } = useChampions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedChampionId, setSelectedChampionId] = useState<string | null>(null)
  const [paneOpen, setPaneOpen] = useState(true)
  const [panePos, setPanePos] = useState<string>('ALL')
  const championListRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const rawRole   = searchParams.get('role') ?? 'ALL'
  const activeRole: RoleFilter = VALID_ROLES.has(rawRole) ? (rawRole as RoleFilter) : 'ALL'
  const searchText = searchParams.get('q') ?? ''
  const viewMode:  ViewMode = (searchParams.get('view') as ViewMode) ?? 'grid'
  const rank   = searchParams.get('rank') ?? 'CHALLENGER'
  const patch  = searchParams.get('patch') ?? undefined   // major.minor (例: "16.9")
  const hotfix = searchParams.get('hotfix') ?? undefined  // full version (例: "16.9.1") or undefined=すべて
  const rawPos = searchParams.get('pos') ?? 'ALL'
  const activePos = VALID_POSITIONS.has(rawPos) ? rawPos : 'ALL'
  const rawSort = searchParams.get('sort') ?? 'win_rate'
  const activeSort: TierSortBy = VALID_SORTS.has(rawSort) ? (rawSort as TierSortBy) : 'win_rate'

  const statsPosition = activePos !== 'ALL' ? activePos : undefined
  const { data: availablePatches = [] } = useAvailablePatches(rank)

  // パッチをmajor.minorでグループ化
  const patchGroups = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const p of availablePatches) {
      const parts = p.split('.')
      const key = `${parts[0]}.${parts[1]}`
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    }
    return groups
  }, [availablePatches])

  const patchKeys     = Object.keys(patchGroups).sort((a, b) => b.localeCompare(a))
  // 選択中のmajor.minor（未選択なら最新）
  const activePatch   = patch ?? patchKeys[0]
  // 選択中パッチのホットフィックス一覧（降順）
  const hotfixOptions = activePatch ? (patchGroups[activePatch] ?? []).sort((a, b) => b.localeCompare(a)) : []

  // hotfix指定あり → そのバージョン / なし → 選択major.minorの最新HF / なければundefined=最新全体
  const apiPatch = hotfix ?? (hotfixOptions.length > 0 ? hotfixOptions[0] : patch)
  const { data: statsData, isLoading: statsLoading } = useAllChampionStats(rank, apiPatch, statsPosition)
  const { data: rankQuality = [] } = useRankQuality()
  const [rankDropdownOpen, setRankDropdownOpen] = useState(false)
  const rankDropdownRef = useRef<HTMLDivElement>(null)

  const rankGamesMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rankQuality) m[r.rank] = r.total_games
    return m
  }, [rankQuality])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rankDropdownRef.current && !rankDropdownRef.current.contains(e.target as Node)) {
        setRankDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const setParam = (key: string, value: string, defaultVal?: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === defaultVal) next.delete(key)
      else next.set(key, value)
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

  // champion_id → best_position マップ（statsDataから生成）
  const bestPositionMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of statsData ?? []) m[s.champion_id] = s.best_position
    return m
  }, [statsData])

  // ポジション + ロール + 検索 を合わせたフィルタ済みリスト
  const filteredWithPos = useMemo(() => {
    if (panePos === 'ALL') return filtered
    return filtered.filter((c) => bestPositionMap[c.id] === panePos)
  }, [filtered, panePos, bestPositionMap])

  // あいうえお行でグループ化（日本語順ソート）
  const groupedChampions = useMemo(() => {
    const sorted = [...filteredWithPos].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    const groups: { row: string; items: typeof sorted }[] = []
    for (const row of KANA_ROWS) {
      const items = sorted.filter((c) => getKanaRow(c.name) === row)
      if (items.length > 0) groups.push({ row, items })
    }
    return groups
  }, [filteredWithPos])

  const existingRows = groupedChampions.map((g) => g.row)

  const scrollToRow = (row: string) => {
    const el = sectionRefs.current[row]
    const container = championListRef.current
    if (el && container) container.scrollTop = el.offsetTop - 8
  }

  return (
    <div>
      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* ヘッダー行 1: タイトル + モード切替（常に同じ内容で高さ固定） */}
        <div className="flex items-center gap-3 mb-2 h-9">
          <div className="flex items-baseline gap-2 shrink-0">
            <h1 className="font-display font-bold text-xl text-lol-text">チャンピオン分析</h1>
          </div>
          {/* 表示切替タブ */}
          <div className="flex rounded-lg border border-lol-border overflow-hidden text-xs shrink-0">
            {(['grid', 'tier'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setParam('view', mode, 'grid')}
                className={[
                  'px-3 py-1.5 transition-colors',
                  viewMode === mode
                    ? 'bg-lol-accent text-lol-bg font-bold'
                    : 'text-lol-text-sub hover:text-lol-accent',
                ].join(' ')}
              >
                {mode === 'grid' ? '一覧' : 'ティアリスト'}
              </button>
            ))}
          </div>
          {data?.version && (
            <span className="ml-auto text-xs text-lol-text-sub shrink-0 hidden sm:block">
              パッチ {formatPatch(data.version)}
            </span>
          )}
        </div>

        {/* ヘッダー行 2: ランク/パッチ + ポジション + ソート（常にレンダリングして高さを固定） */}
        <div className={`flex items-center gap-2 mb-3 h-8 ${viewMode !== 'tier' ? 'invisible pointer-events-none' : ''}`}>
          {/* ランクドロップダウン */}
          <div className="relative shrink-0" ref={rankDropdownRef}>
            <button
              onClick={() => setRankDropdownOpen((o) => !o)}
              className="flex items-center gap-1.5 bg-lol-card border border-lol-border rounded-lg px-3 py-1.5 text-xs text-lol-text focus:outline-none focus:border-lol-accent cursor-pointer min-w-[130px] justify-between"
            >
              <span className="flex items-center gap-1">
                {(rankGamesMap[rank] === undefined || rankGamesMap[rank] === 0) && (
                  <span className="text-red-500">⚠</span>
                )}
                {rankGamesMap[rank] !== undefined && rankGamesMap[rank] > 0 && rankGamesMap[rank] < 1000 && (
                  <span className="text-yellow-400">⚠</span>
                )}
                {RANK_OPTIONS.find((r) => r.value === rank)?.label ?? rank}
              </span>
              <svg className={`w-3 h-3 text-lol-text-sub transition-transform ${rankDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
            {rankDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-30 bg-lol-card border border-lol-border rounded-lg shadow-xl min-w-[180px]">
                {RANK_OPTIONS.map(({ value, label }, idx) => {
                  const games    = rankGamesMap[value]
                  const noData   = games === undefined || games === 0
                  const shortage = games !== undefined && games > 0 && games < 1000
                  const isFirst  = idx === 0
                  const isLast   = idx === RANK_OPTIONS.length - 1
                  return (
                    <button
                      key={value}
                      onClick={() => { setParam('rank', value, 'CHALLENGER'); setRankDropdownOpen(false) }}
                      className={[
                        'w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors',
                        isFirst ? 'rounded-t-lg' : '',
                        isLast  ? 'rounded-b-lg' : '',
                        value === rank
                          ? 'bg-lol-accent/20 text-lol-accent'
                          : 'text-lol-text hover:bg-lol-border/30',
                      ].join(' ')}
                    >
                      <span>{label}</span>
                      {(noData || shortage) && (
                        <span
                          className="relative group/tip ml-2 flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className={`text-[11px] font-bold ${noData ? 'text-red-500' : 'text-yellow-400'}`}>⚠</span>
                          <span className="pointer-events-none absolute left-full ml-2 hidden group-hover/tip:block whitespace-nowrap bg-lol-bg border border-lol-border rounded-lg px-2.5 py-2 text-[11px] text-lol-text-sub shadow-xl z-50">
                            {noData ? '試合数が0件です' : '試合数が1000件以下です'}
                          </span>
                        </span>
                      )}
                      {games !== undefined && !noData && !shortage && (
                        <span className="text-lol-text-sub text-[10px] ml-2">{games.toLocaleString()}試合</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* パッチセレクター */}
          {patchKeys.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={activePatch ?? ''}
                onChange={(e) => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    if (e.target.value) next.set('patch', e.target.value)
                    else next.delete('patch')
                    next.delete('hotfix')
                    return next
                  }, { replace: true })
                }}
                className="bg-lol-card border border-lol-border rounded-lg px-3 py-1.5 text-xs text-lol-text focus:outline-none focus:border-lol-accent cursor-pointer"
              >
                {patchKeys.map((p) => (
                  <option key={p} value={p}>{formatPatch(p)}</option>
                ))}
              </select>
              {hotfixOptions.length > 1 && (
                <select
                  value={hotfix ?? ''}
                  onChange={(e) => setParam('hotfix', e.target.value, '')}
                  className="bg-lol-card border border-lol-border rounded-lg px-3 py-1.5 text-xs text-lol-text focus:outline-none focus:border-lol-accent cursor-pointer"
                >
                  <option value="">すべて</option>
                  {hotfixOptions.map((h) => {
                    const parts = h.split('.')
                    const hfNum = parts[2] ?? '1'
                    return <option key={h} value={h}>HF {hfNum}</option>
                  })}
                </select>
              )}
            </div>
          )}

          {/* 区切り */}
          <div className="w-px h-5 bg-lol-border mx-1 shrink-0" />

          {/* ポジションフィルター */}
          <div className="flex gap-1">
            {POSITION_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => setParam('pos', value, 'ALL')}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
                  activePos === value
                    ? 'bg-lol-accent border-lol-accent text-lol-bg font-bold'
                    : 'border-lol-border text-lol-text-sub hover:border-lol-accent hover:text-lol-accent',
                ].join(' ')}>
                {label}
              </button>
            ))}
          </div>

          {/* ソートボタン */}
          <div className="flex gap-1 ml-auto">
            {SORT_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => setParam('sort', value, 'win_rate')}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150',
                  activeSort === value
                    ? 'bg-lol-accent border-lol-accent text-lol-bg font-bold'
                    : 'border-lol-border text-lol-text-sub hover:border-lol-accent hover:text-lol-accent',
                ].join(' ')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        {viewMode === 'grid' ? (
          <>
            {/* レール広告（2xl以上で左右に表示） */}
            <div className="fixed left-0 top-14 bottom-0 w-40 hidden 2xl:flex flex-col items-center pt-6 z-20">
              <AdBanner slot="left-rail" format="vertical" noMargin />
            </div>
            <div className="fixed right-0 top-14 bottom-0 w-40 hidden 2xl:flex flex-col items-center pt-6 z-20">
              <AdBanner slot="right-rail" format="vertical" noMargin />
            </div>

            <div className="flex items-start gap-0">
              {/* サイドペイン本体（幅アニメーション） */}
              <div
                className={[
                  'shrink-0 self-start sticky overflow-hidden transition-[width] duration-300 ease-in-out',
                  paneOpen ? 'w-64' : 'w-0',
                ].join(' ')}
                style={{ top: '64px', height: 'calc(100vh - 72px)' }}
              >
                <div className="w-64 h-full flex flex-col border border-lol-border rounded-xl bg-lol-card overflow-hidden">
                  {/* 検索 + ロールフィルター */}
                  <div className="p-3 border-b border-lol-border shrink-0">
                    {/* 検索ボックス */}
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                        className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-lol-text-sub pointer-events-none">
                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                      </svg>
                      <input
                        type="search"
                        value={searchText}
                        onChange={(e) => setParam('q', e.target.value, '')}
                        placeholder="検索"
                        aria-label="チャンピオン名で検索"
                        className="w-full bg-lol-bg border border-lol-border rounded-lg pl-8 pr-2 py-1.5 text-sm text-lol-text placeholder:text-lol-text-sub focus:outline-none focus:border-lol-accent transition-colors"
                      />
                    </div>

                    {/* クラスフィルター */}
                    <div className="flex flex-wrap gap-1 mt-2" role="group" aria-label="クラスで絞り込む">
                      {ROLE_FILTERS.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setParam('role', value, 'ALL')}
                          aria-pressed={activeRole === value}
                          className={[
                            'px-2 py-0.5 rounded text-xs font-medium border transition-all duration-150',
                            activeRole === value
                              ? 'bg-lol-accent border-lol-accent text-lol-bg font-bold'
                              : 'border-lol-border text-lol-text-sub hover:border-lol-accent hover:text-lol-accent',
                          ].join(' ')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* ポジションフィルター */}
                    <div className="flex gap-1 mt-1.5" role="group" aria-label="ポジションで絞り込む">
                      {[
                        { value: 'ALL',     label: '全て' },
                        { value: 'TOP',     label: 'TOP' },
                        { value: 'JUNGLE',  label: 'JG' },
                        { value: 'MID',     label: 'MID' },
                        { value: 'ADC',     label: 'ADC' },
                        { value: 'SUPPORT', label: 'SUP' },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setPanePos(value)}
                          aria-pressed={panePos === value}
                          className={[
                            'flex-1 py-0.5 rounded text-xs font-medium border transition-all duration-150',
                            panePos === value
                              ? 'bg-lol-accent/20 border-lol-accent text-lol-accent font-bold'
                              : 'border-lol-border text-lol-text-sub hover:border-lol-accent hover:text-lol-accent',
                          ].join(' ')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* インデックス + アイコングリッド */}
                  <div className="flex flex-1 overflow-hidden">
                    {/* あいうえお行インデックス */}
                    <div className="w-7 shrink-0 flex flex-col items-center py-2 gap-0.5 border-r border-lol-border/40 bg-lol-bg/20 overflow-y-auto">
                      {isLoading
                        ? null
                        : existingRows.map((row) => (
                            <button
                              key={row}
                              onClick={() => scrollToRow(row)}
                              className="w-full text-center text-[11px] font-bold text-lol-text-sub hover:text-lol-accent py-0.5 transition-colors leading-tight"
                            >
                              {row}
                            </button>
                          ))}
                    </div>

                    {/* チャンピオンアイコングリッド（あいうえお行別） */}
                    <div ref={championListRef} className="flex-1 overflow-y-auto p-1.5">
                      {isLoading
                        ? <div className="grid grid-cols-5 gap-1 p-1">
                            {Array.from({ length: 20 }).map((_, i) => (
                              <div key={i} className="aspect-square rounded animate-pulse bg-lol-border/30" />
                            ))}
                          </div>
                        : groupedChampions.map(({ row, items }) => (
                            <div
                              key={row}
                              ref={(el) => { sectionRefs.current[row] = el }}
                            >
                              <p className="text-[11px] font-bold text-lol-text-sub/70 mt-2 mb-1 first:mt-0 px-0.5">
                                {row}行
                              </p>
                              <div className="grid grid-cols-5 gap-1">
                                {items.map((champ) => (
                                  <button
                                    key={champ.id}
                                    onClick={() => setSelectedChampionId(champ.id)}
                                    title={champ.name}
                                    className={[
                                      'rounded overflow-hidden border-2 transition-all duration-150',
                                      selectedChampionId === champ.id
                                        ? 'border-lol-accent scale-105'
                                        : 'border-transparent hover:border-lol-border',
                                    ].join(' ')}
                                  >
                                    <img
                                      src={champ.image_url}
                                      alt={champ.name}
                                      className="w-full aspect-square object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                    </div>
                  </div>

                  {/* フッター: 件数 */}
                  <div className="px-2 py-1.5 border-t border-lol-border shrink-0 text-xs text-lol-text-sub">
                    {filteredWithPos.length}体{activeRole !== 'ALL' || panePos !== 'ALL' || searchText ? ` / ${data?.total ?? 0}体` : ''}
                  </div>
                </div>
              </div>

              {/* トグルボタン（常に表示、ペインの右端に吸着） */}
              <div className="self-start sticky shrink-0 z-10" style={{ top: '64px' }}>
                <button
                  onClick={() => setPaneOpen((o) => !o)}
                  aria-label={paneOpen ? 'サイドペインを閉じる' : 'サイドペインを開く'}
                  className="flex items-center justify-center w-5 h-12 mt-3 rounded-r-lg bg-lol-card border border-l-0 border-lol-border text-lol-text-sub hover:text-lol-accent hover:border-lol-accent transition-colors"
                >
                  <svg
                    className={`w-3 h-3 transition-transform duration-300 ${paneOpen ? '' : 'rotate-180'}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              </div>

              {/* メインコンテンツ（自然フロー） */}
              <div className="flex-1 min-w-0 pl-4">
                {selectedChampionId && data ? (
                  <ChampionAnalysisPanel
                    championId={selectedChampionId}
                    champions={data.champions}
                    ddragonVersion={data.version}
                  />
                ) : (
                  <div className="flex items-center justify-center h-48 text-lol-text-sub text-sm">
                    左のリストからチャンピオンを選択してください
                  </div>
                )}
              </div>
            </div>
          </>

        ) : (
          <div className="mt-4">
            <AdBanner slot="champions-top" format="horizontal" noMargin />
            <div className="mb-4" />
            {statsLoading || isLoading ? (
              <div className="space-y-3">
                {['S+', 'S', 'A', 'B', 'C'].map((t) => (
                  <div key={t} className="h-16 bg-lol-card border border-lol-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : statsData && data ? (
              <TierList stats={statsData} champions={data.champions} sortBy={activeSort} />
            ) : (
              <p className="text-lol-text-sub text-sm text-center py-12">統計データを取得できませんでした。</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default ChampionsPage
