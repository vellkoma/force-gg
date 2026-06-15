import { useState, useEffect } from 'react'
import { useChampionMap } from '../hooks/useChampionMap'
import { dd } from '../utils/ddragon'

interface MasteryEntry {
  championId: number
  championPoints: number
  championLevel: number
  lastPlayTime: number
}

function levelStyle(level: number) {
  if (level >= 7) return { bg: 'bg-[#c89b3c]/20 border border-[#c89b3c]/50', text: 'text-[#c89b3c]', label: `Lv.${level}` }
  if (level === 6) return { bg: 'bg-purple-900/30 border border-purple-700/50', text: 'text-purple-400', label: 'Lv.6' }
  if (level === 5) return { bg: 'bg-red-900/30 border border-red-700/50', text: 'text-red-400', label: 'Lv.5' }
  if (level === 4) return { bg: 'bg-blue-900/20 border border-blue-800/40', text: 'text-blue-400', label: 'Lv.4' }
  return { bg: 'bg-[#0a0e1a] border border-[#1e2a3a]', text: 'text-gray-500', label: `Lv.${level}` }
}

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms
  const days = Math.floor(diff / 86400_000)
  if (days === 0) return '今日プレイ'
  if (days < 30) return `${days}日前にプレイ`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}ヶ月前にプレイ`
  return `${Math.floor(months / 12)}年前にプレイ`
}

export function MasteryPage(): JSX.Element {
  const championMap = useChampionMap()
  const [list, setList] = useState<MasteryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState<number | null>(null)

  useEffect(() => {
    window.electronAPI.lcu.getMasteryList().then((data) => {
      if (data) {
        const sorted = [...data].sort((a, b) => b.championPoints - a.championPoints)
        setList(sorted)
      }
      setLoading(false)
    })
  }, [])

  const totalScore = list.reduce((s, m) => s + m.championPoints, 0)

  const filtered = list.filter((m) => {
    const name = (championMap.get(m.championId) ?? '').toLowerCase()
    const matchSearch = search === '' || name.includes(search.toLowerCase())
    const matchLevel =
      filterLevel === null ||
      (filterLevel === 7 ? m.championLevel >= 7 : m.championLevel === filterLevel)
    return matchSearch && matchLevel
  })

  const levelCounts = [
    { lv: 7, label: 'Lv.7~', count: list.filter((m) => m.championLevel >= 7).length },
    { lv: 6, label: 'Lv.6',  count: list.filter((m) => m.championLevel === 6).length },
    { lv: 5, label: 'Lv.5',  count: list.filter((m) => m.championLevel === 5).length },
    { lv: 4, label: 'Lv.4',  count: list.filter((m) => m.championLevel === 4).length },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#c89b3c]">マスタリー</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            合計 {totalScore.toLocaleString()} pts · {list.length} チャンピオン
          </p>
        </div>
        {/* レベルフィルター */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterLevel(null)}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${filterLevel === null ? 'bg-[#c89b3c] text-black font-semibold' : 'bg-[#0f1923] border border-[#1e2a3a] text-gray-400 hover:text-white'}`}
          >
            すべて
          </button>
          {levelCounts.map(({ lv, label, count }) => {
            const s = levelStyle(lv)
            return (
              <button
                key={lv}
                onClick={() => setFilterLevel(filterLevel === lv ? null : lv)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${filterLevel === lv ? `${s.bg} ${s.text} font-semibold` : 'bg-[#0f1923] border border-[#1e2a3a] text-gray-400 hover:text-white'}`}
              >
                {label} <span className="opacity-60">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 検索 */}
      <input
        type="text"
        placeholder="チャンピオン名で検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 px-3 py-2 bg-[#0f1923] border border-[#1e2a3a] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#c89b3c]/50"
      />

      {/* リスト */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#c89b3c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {filtered.map((m, i) => {
            const name = championMap.get(m.championId) ?? ''
            const s = levelStyle(m.championLevel)
            const rank = list.indexOf(m) + 1
            return (
              <div
                key={m.championId}
                className={`flex items-center gap-2 p-2 rounded-lg ${s.bg} relative`}
              >
                {rank <= 3 && (
                  <span className="absolute -top-1.5 -left-1.5 text-xs">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                  </span>
                )}
                <img
                  src={dd.championIcon(name)}
                  alt={name}
                  className="w-8 h-8 rounded-full object-cover border border-[#2a3a4a] shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] font-semibold text-white truncate">{name || `#${m.championId}`}</p>
                    <span className={`text-[9px] font-bold shrink-0 ${s.text}`}>{s.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-300 tabular-nums">{(m.championPoints / 1000).toFixed(1)}k</p>
                  <p className="text-[8px] text-gray-500 truncate">{formatTimeAgo(m.lastPlayTime)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-gray-500 py-12">該当するチャンピオンがありません</p>
      )}
    </div>
  )
}

export default MasteryPage
