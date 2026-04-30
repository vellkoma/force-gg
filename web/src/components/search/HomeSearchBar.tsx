import { useState, useRef, useEffect, type FC, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChampions } from '@/hooks/useChampions'
import type { ChampionListItem } from '@/types/champion'

const REGIONS = ['JP1', 'KR', 'NA1', 'EUW1', 'EUNE1', 'BR1', 'OC1', 'TR1', 'RU'] as const
type Region = typeof REGIONS[number]

const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn'

export const HomeSearchBar: FC = () => {
  const navigate = useNavigate()
  const { data } = useChampions()

  const [region, setRegion]     = useState<Region>('JP1')
  const [gameName, setGameName] = useState('')
  const [tagLine, setTagLine]   = useState('')
  const [open, setOpen]         = useState(false)
  const [activeIndex, setActive] = useState(-1)
  const [error, setError]       = useState('')

  const containerRef = useRef<HTMLDivElement>(null)

  // チャンピオン候補（最大5件）
  const championMatches: ChampionListItem[] = gameName.trim().length > 0 && data?.champions
    ? data.champions
        .filter(c =>
          c.name.includes(gameName.trim()) ||
          c.id.toLowerCase().startsWith(gameName.trim().toLowerCase()),
        )
        .slice(0, 5)
    : []

  const showSummonerRow = gameName.trim().length > 0
  const totalItems = championMatches.length + (showSummonerRow ? 1 : 0)

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setActive(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const goChampion = (c: ChampionListItem) => {
    navigate(`/champions/${c.id}`)
    setOpen(false)
    setGameName('')
    setError('')
  }

  const goSummoner = () => {
    const name = gameName.trim()
    const tag  = tagLine.trim() || region
    if (!name) { setError('ゲーム名を入力してください'); return }
    setError('')
    setOpen(false)
    navigate(
      `/summoner/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?region=${region}`,
    )
  }

  const handleGameNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); return }
    if (!open || totalItems === 0) {
      if (e.key === 'Enter') goSummoner()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (i + 1) % totalItems)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (i - 1 + totalItems) % totalItems)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < championMatches.length) {
        goChampion(championMatches[activeIndex])
      } else {
        goSummoner()
      }
    }
  }

  const iconUrl = (c: ChampionListItem) =>
    data?.version ? `${DDRAGON}/${data.version}/img/champion/${c.id}.png` : ''

  const summonerLabel = `${gameName.trim()}#${tagLine.trim() || region}`

  const inputBase = [
    'bg-lol-card border text-lol-text placeholder-lol-text-sub text-base',
    'outline-none transition-colors duration-200 py-3',
    error
      ? 'border-lol-error focus:border-lol-error focus:ring-1 focus:ring-lol-error/40'
      : 'border-lol-border hover:border-lol-border-hover focus:border-lol-accent focus:ring-1 focus:ring-lol-accent/40',
  ].join(' ')

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* 入力行: [リージョン▼] [ゲーム名] [#タグ] [検索] */}
      <div className="flex gap-2">

        {/* リージョン選択（左端） */}
        <select
          value={region}
          onChange={e => setRegion(e.target.value as Region)}
          aria-label="リージョンを選択"
          className="bg-lol-card border border-lol-border text-lol-text text-sm font-bold rounded-xl px-3 outline-none focus:border-lol-accent cursor-pointer transition-colors shrink-0"
        >
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* ゲーム名入力 */}
        <input
          type="text"
          value={gameName}
          onChange={e => {
            setGameName(e.target.value)
            setError('')
            setOpen(e.target.value.trim().length > 0)
            setActive(-1)
          }}
          onFocus={() => { if (gameName.trim()) setOpen(true) }}
          onKeyDown={handleGameNameKeyDown}
          placeholder="サモナー名 / チャンピオン名"
          aria-label="サモナー名またはチャンピオン名を入力"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`flex-1 rounded-xl px-4 ${inputBase}`}
        />

        {/* タグライン入力（#なしで入力） */}
        <div className="flex items-center shrink-0">
          <span className="text-lol-text-sub font-bold text-lg select-none pr-1">#</span>
          <input
            type="text"
            value={tagLine}
            onChange={e => { setTagLine(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') goSummoner() }}
            placeholder={region}
            aria-label="タグラインを入力"
            className={`w-20 rounded-xl px-3 ${inputBase}`}
          />
        </div>

        {/* 検索ボタン（サモナー検索） */}
        <button
          type="button"
          onClick={goSummoner}
          className="shrink-0 px-6 py-3 bg-lol-accent text-lol-bg font-bold rounded-xl hover:brightness-110 transition-all duration-200"
        >
          検索
        </button>
      </div>

      {/* バリデーションエラー */}
      {error && (
        <p role="alert" className="mt-2 text-sm text-lol-error text-left">{error}</p>
      )}

      {/* サジェストドロップダウン */}
      {open && totalItems > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 bg-lol-card border border-lol-border rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          {/* チャンピオン候補 */}
          {championMatches.length > 0 && (
            <>
              <p className="px-4 py-2 text-xs font-bold text-lol-text-sub uppercase tracking-widest border-b border-lol-border">
                チャンピオン
              </p>
              {championMatches.map((c, i) => (
                <button
                  key={c.id}
                  role="option"
                  aria-selected={activeIndex === i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => goChampion(c)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    activeIndex === i ? 'bg-lol-accent/10' : 'hover:bg-white/5'
                  }`}
                >
                  {iconUrl(c) && (
                    <img src={iconUrl(c)} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-lol-text">{c.name}</p>
                    <p className="text-xs text-lol-text-sub">{c.title}</p>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* サモナー候補 */}
          {showSummonerRow && (
            <>
              <p className={`px-4 py-2 text-xs font-bold text-lol-text-sub uppercase tracking-widest ${
                championMatches.length > 0 ? 'border-t border-lol-border' : ''
              }`}>
                サモナー
              </p>
              <button
                role="option"
                aria-selected={activeIndex === championMatches.length}
                onMouseEnter={() => setActive(championMatches.length)}
                onClick={goSummoner}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  activeIndex === championMatches.length ? 'bg-lol-accent/10' : 'hover:bg-white/5'
                }`}
              >
                <span className="text-lg shrink-0 text-lol-text-sub" aria-hidden="true">🔍</span>
                <div>
                  <p className="text-sm font-bold text-lol-text">「{summonerLabel}」を検索</p>
                  <p className="text-xs text-lol-text-sub">{region} のサモナーを検索</p>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
