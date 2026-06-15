import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLcu } from '../context/LcuContext'
import {
  useMatchHistory,
  getQueueLabel,
  formatDuration,
  formatTimeAgo,
  type MatchDetail,
  type ParticipantStats,
} from '../hooks/useMatchHistory'
import { useChampionMap } from '../hooks/useChampionMap'
import { dd } from '../utils/ddragon'

// ARAM フィルター: 450（ARAM）+ 2400（メイヘム）をまとめて表示
const ARAM_QUEUE_IDS = new Set([450, 900, 1010, 1900, 2400])

const QUEUE_FILTERS = [
  { label: 'すべて', apiQueue: undefined as number | undefined, displayQueues: undefined as Set<number> | undefined },
  { label: 'ランク', apiQueue: 420, displayQueues: undefined },
  { label: 'フレックス', apiQueue: 440, displayQueues: undefined },
  { label: 'ARAM', apiQueue: undefined, displayQueues: ARAM_QUEUE_IDS },
  { label: 'ノーマル', apiQueue: 400, displayQueues: undefined },
]

function ItemIcon({ id }: { id: number }) {
  const url = dd.itemIcon(id)
  if (!url) return <div className="w-7 h-7 bg-[#0a0e1a] rounded border border-[#1e2a3a]" />
  return (
    <img
      src={url}
      alt={`item ${id}`}
      className="w-7 h-7 rounded border border-[#1e2a3a] object-cover"
      onError={(e) => {
        ;(e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

function MatchCard({
  match,
  myPuuid,
}: {
  match: MatchDetail
  myPuuid: string
}) {
  const navigate = useNavigate()
  const me: ParticipantStats | undefined =
    match.my_stats ?? match.participants.find((p) => p.puuid === myPuuid)

  if (!me) return null

  const win = me.win
  const kda = me.deaths === 0 ? (me.kills + me.assists).toFixed(0) + ':1' : ((me.kills + me.assists) / me.deaths).toFixed(2)
  const dpm = Math.round(me.total_damage_dealt_to_champions / (match.info.game_duration / 60))
  const items = [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5]

  return (
    <button
      onClick={() =>
        navigate(`/matches/${match.info.match_id}`, {
          state: { match, myPuuid },
        })
      }
      className={`w-full text-left bg-[#0f1923] rounded-lg border ${
        win ? 'border-blue-800/60' : 'border-red-900/60'
      } hover:border-[#c89b3c]/50 transition-colors p-4`}
    >
      <div className="flex items-center gap-4">
        {/* チャンピオンアイコン */}
        <div className="relative shrink-0">
          <img
            src={dd.championIcon(me.champion_name)}
            alt={me.champion_name}
            className="w-14 h-14 rounded-full border-2 border-[#1e2a3a] object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = ''
            }}
          />
          <span className="absolute -bottom-1 -right-1 bg-[#0a0e1a] text-xs px-1 rounded border border-[#1e2a3a]">
            {me.champ_level}
          </span>
        </div>

        {/* 結果・モード・時刻 */}
        <div className="shrink-0">
          <p className={`text-sm font-bold ${win ? 'text-blue-400' : 'text-red-400'}`}>
            {win ? '勝利' : '敗北'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{getQueueLabel(match.info.queue_id)}</p>
          <p className="text-xs text-gray-500">
            {formatDuration(match.info.game_duration)} ·{' '}
            {formatTimeAgo(match.info.game_end_timestamp)}
          </p>
        </div>

        {/* KDA・CS */}
        <div className="shrink-0">
          <p className="text-sm font-semibold">
            {me.kills}/{me.deaths}/{me.assists}
          </p>
          <p className="text-xs text-gray-400">KDA {kda}</p>
          <p className="text-xs text-gray-500">CS {me.cs}</p>
        </div>

        {/* ダメージ */}
        <div className="shrink-0 hidden sm:block">
          <p className="text-sm font-semibold">{dpm.toLocaleString()}</p>
          <p className="text-xs text-gray-400">DPM</p>
        </div>

        {/* アイテム */}
        <div className="flex gap-0.5 ml-auto">
          {items.map((id, i) => (
            <ItemIcon key={i} id={id} />
          ))}
          <ItemIcon id={me.item6} />
        </div>
      </div>
    </button>
  )
}

export function MatchHistoryPage(): JSX.Element {
  const { isConnected, summoner } = useLcu()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedFilter = QUEUE_FILTERS[selectedIndex]
  const championMap = useChampionMap()

  const { matches, loading, error, reload } = useMatchHistory(
    summoner ?? null,
    selectedFilter.apiQueue,
    championMap
  )

  // ARAM フィルターはクライアント側でメイヘムも含めて絞り込む
  const displayMatches = selectedFilter.displayQueues
    ? matches.filter((m) => selectedFilter.displayQueues!.has(m.info.queue_id))
    : matches

  if (!isConnected || !summoner) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-[#c89b3c] mb-6">マッチ履歴</h1>
        <div className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-8 text-center">
          <p className="text-gray-400">LoLクライアントに接続するとマッチ履歴が表示されます。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#c89b3c]">マッチ履歴</h1>
          <p className="text-sm text-gray-400 mt-0.5">{summoner.displayName}</p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-white border border-[#1e2a3a] hover:border-[#c89b3c]/50 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
        >
          更新
        </button>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {QUEUE_FILTERS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setSelectedIndex(i)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              selectedIndex === i
                ? 'bg-[#c89b3c] text-black font-semibold'
                : 'bg-[#0f1923] border border-[#1e2a3a] text-gray-400 hover:text-white hover:border-[#c89b3c]/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#c89b3c] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && displayMatches.length === 0 && (
        <div className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-8 text-center text-gray-400 text-sm">
          マッチ履歴が見つかりませんでした。
        </div>
      )}

      {!loading && displayMatches.length > 0 && (
        <div className="space-y-2">
          {displayMatches.map((match) => (
            <MatchCard key={match.info.match_id} match={match} myPuuid={summoner.puuid} />
          ))}
        </div>
      )}
    </div>
  )
}

export default MatchHistoryPage
