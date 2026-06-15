import { useLocation, useParams } from 'react-router-dom'
import { dd } from '../utils/ddragon'
import {
  formatDuration,
  getQueueLabel,
  formatTimeAgo,
  type MatchDetail,
  type ParticipantStats,
} from '../hooks/useMatchHistory'

const POSITION_LABELS: Record<string, string> = {
  TOP: 'TOP',
  JUNGLE: 'JG',
  MIDDLE: 'MID',
  BOTTOM: 'ADC',
  UTILITY: 'SUP',
  INVALID: '?',
}

function ItemIcon({ id }: { id: number }) {
  const url = dd.itemIcon(id)
  if (!url) return <div className="w-6 h-6 bg-[#0a0e1a] rounded border border-[#1e2a3a]" />
  return (
    <img
      src={url}
      alt={`item ${id}`}
      className="w-6 h-6 rounded border border-[#1e2a3a] object-cover"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).replaceWith(
          Object.assign(document.createElement('div'), {
            className: 'w-6 h-6 bg-[#0a0e1a] rounded border border-[#1e2a3a]',
          })
        )
      }}
    />
  )
}

function DamageBar({
  value,
  max,
  win,
}: {
  value: number
  max: number
  win: boolean
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-300 w-14 text-right">
        {(value / 1000).toFixed(1)}k
      </span>
      <div className="w-20 bg-[#0a0e1a] rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${win ? 'bg-blue-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SpellIcon({ id }: { id: number }) {
  const url = dd.spellIconById(id)
  if (!url) return <div className="w-4 h-4 bg-[#0a0e1a] rounded border border-[#1e2a3a]" />
  return (
    <img
      src={url}
      alt={`spell ${id}`}
      className="w-4 h-4 rounded object-cover"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

function PlayerRow({
  p,
  maxDamage,
  isMe,
}: {
  p: ParticipantStats
  maxDamage: number
  isMe: boolean
}) {
  const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6]
  const kda =
    p.deaths === 0
      ? `${(p.kills + p.assists)}:1`
      : ((p.kills + p.assists) / p.deaths).toFixed(2)
  const posLabel = POSITION_LABELS[p.individual_position]

  return (
    <tr className={`border-t border-[#1e2a3a] ${isMe ? 'bg-[#c89b3c]/5' : ''}`}>
      {/* チャンピオン */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <img
              src={dd.championIcon(p.champion_name)}
              alt={p.champion_name}
              className="w-8 h-8 rounded-full object-cover border border-[#2a3a4a]"
            />
            <span className="absolute -bottom-1 -right-1 text-[9px] bg-[#0a0e1a] px-0.5 rounded border border-[#1e2a3a] text-gray-300">
              {p.champ_level}
            </span>
          </div>
          {/* スペルアイコン */}
          <div className="flex flex-col gap-0.5">
            <SpellIcon id={p.summoner1_id} />
            <SpellIcon id={p.summoner2_id} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-200 truncate max-w-[80px]">
              {p.riot_id_game_name || p.champion_name}
              {isMe && <span className="ml-1 text-[#c89b3c]">★</span>}
            </p>
            {posLabel && (
              <p className="text-[10px] text-gray-500">{posLabel}</p>
            )}
          </div>
        </div>
      </td>

      {/* KDA */}
      <td className="py-2 px-3 text-center">
        <p className="text-xs font-medium">
          {p.kills}/{p.deaths}/{p.assists}
        </p>
        <p className="text-[10px] text-gray-400">{kda}</p>
      </td>

      {/* CS */}
      <td className="py-2 px-3 text-center">
        <p className="text-xs">{p.cs}</p>
      </td>

      {/* ダメージ */}
      <td className="py-2 px-3">
        <DamageBar value={p.total_damage_dealt_to_champions} max={maxDamage} win={p.win} />
      </td>

      {/* アイテム */}
      <td className="py-2 px-3">
        <div className="flex gap-0.5 flex-wrap">
          {items.map((id, i) => (
            <ItemIcon key={i} id={id} />
          ))}
        </div>
      </td>
    </tr>
  )
}

function TeamTable({
  players,
  myPuuid,
  win,
}: {
  players: ParticipantStats[]
  myPuuid: string
  win: boolean
}) {
  const maxDamage = Math.max(...players.map((p) => p.total_damage_dealt_to_champions), 1)

  return (
    <div
      className={`rounded-lg border ${
        win ? 'border-blue-800/60' : 'border-red-900/60'
      } overflow-hidden`}
    >
      <div
        className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${
          win
            ? 'bg-blue-900/30 text-blue-300'
            : 'bg-red-900/30 text-red-400'
        }`}
      >
        {win ? '勝利チーム (Blue)' : '敗北チーム (Red)'}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] text-gray-500 uppercase">
            <th className="py-1.5 px-3 text-left font-normal">チャンピオン</th>
            <th className="py-1.5 px-3 text-center font-normal">KDA</th>
            <th className="py-1.5 px-3 text-center font-normal">CS</th>
            <th className="py-1.5 px-3 text-left font-normal">ダメージ</th>
            <th className="py-1.5 px-3 text-left font-normal">アイテム</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <PlayerRow key={p.puuid} p={p} maxDamage={maxDamage} isMe={p.puuid === myPuuid} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function MatchDetailPage(): JSX.Element {
  const { matchId } = useParams<{ matchId: string }>()
  const location = useLocation()
  const state = location.state as { match: MatchDetail; myPuuid: string } | null

  if (!state?.match) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-gray-400">マッチデータが見つかりません。（ID: {matchId}）</p>
      </div>
    )
  }

  const { match, myPuuid } = state
  const blueTeam = match.participants.filter((p) => p.team_id === 100)
  const redTeam = match.participants.filter((p) => p.team_id === 200)
  const blueWin = blueTeam[0]?.win ?? false

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div>
          <h1 className="text-lg font-bold text-[#c89b3c]">マッチ詳細</h1>
          <p className="text-xs text-gray-400">
            {getQueueLabel(match.info.queue_id)} ·{' '}
            {formatDuration(match.info.game_duration)} ·{' '}
            {formatTimeAgo(match.info.game_end_timestamp)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <TeamTable players={blueTeam} myPuuid={myPuuid} win={blueWin} />
        <TeamTable players={redTeam} myPuuid={myPuuid} win={!blueWin} />
      </div>
    </div>
  )
}

export default MatchDetailPage
