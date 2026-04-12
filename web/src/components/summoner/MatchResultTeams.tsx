import type { FC } from 'react'
import type { ParticipantStats } from '@/types/match'
import { useChampions } from '@/hooks/useChampions'

const DDRAGON_BASE = (version: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img`

function fmtGold(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

function calcKdaRatio(kills: number, deaths: number, assists: number): string {
  if (deaths === 0) return 'Perfect'
  return ((kills + assists) / deaths).toFixed(2)
}

// アイテムアイコン（小）
const MiniItem: FC<{ itemId: number; version: string }> = ({ itemId, version }) => {
  if (itemId === 0) return <div className="w-5 h-5 rounded bg-lol-bg border border-lol-border/30" />
  return (
    <img
      src={`${DDRAGON_BASE(version)}/item/${itemId}.png`}
      alt=""
      className="w-5 h-5 rounded border border-lol-border/30 bg-lol-bg object-cover"
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
}

// 1プレイヤー行
const PlayerRow: FC<{
  p: ParticipantStats
  version: string
  isSelf: boolean
  flip: boolean
  isVisible: boolean
  plotColor: string
  onToggle: (id: number) => void
}> = ({ p, version, isSelf, flip, isVisible, plotColor, onToggle }) => {
  const displayName = p.riot_id_game_name || p.champion_name
  const tagLine     = p.riot_id_tag_line
  const kda         = calcKdaRatio(p.kills, p.deaths, p.assists)
  const items       = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5]

  return (
    <button
      type="button"
      onClick={() => onToggle(p.participant_id)}
      className={[
        'w-full flex items-center gap-1.5 py-1 px-2 rounded transition-all duration-150',
        'focus:outline-none hover:bg-lol-border/10',
        isSelf ? 'bg-lol-accent/5' : '',
        !isVisible ? 'opacity-40' : '',
        flip ? 'flex-row-reverse' : '',
      ].join(' ')}
    >
      {/* グラフ色インジケーター */}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: isVisible ? plotColor : '#4a5568' }}
      />

      {/* チャンピオンアイコン + レベルバッジ */}
      <div className="relative shrink-0">
        <img
          src={`${DDRAGON_BASE(version)}/champion/${p.champion_name}.png`}
          alt={p.champion_name}
          className={`w-8 h-8 rounded-full border object-cover bg-lol-bg ${
            isSelf ? 'border-lol-accent' : 'border-lol-border/50'
          }`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '' }}
        />
        <span className="absolute -bottom-1 -right-1 text-[9px] bg-lol-bg border border-lol-border/50 rounded px-0.5 text-lol-text-sub leading-tight">
          {p.champ_level}
        </span>
      </div>

      {/* 名前(タグ) + KDA */}
      <div className={`flex-1 min-w-0 ${flip ? 'text-right' : ''}`}>
        <p className={`text-[11px] truncate leading-tight ${isSelf ? 'text-lol-accent font-bold' : 'text-lol-text-body'}`}>
          {displayName}
          {tagLine && (
            <span className="text-lol-text-sub font-normal ml-0.5">({tagLine})</span>
          )}
        </p>
        <p className="text-[10px] text-lol-text-sub leading-tight">
          <span className="text-lol-text-body">{p.kills}/{p.deaths}/{p.assists}</span>
          <span className="ml-1">KDA <span className="text-lol-accent">{kda}</span></span>
        </p>
      </div>

      {/* アイテム（6スロット） */}
      <div className={`flex gap-0.5 ${flip ? 'flex-row-reverse' : ''}`}>
        {items.map((id, i) => (
          <MiniItem key={i} itemId={id} version={version} />
        ))}
      </div>

      {/* Gold / CS */}
      <div className={`text-[10px] leading-tight shrink-0 ${flip ? 'text-left' : 'text-right'}`}>
        <p className="text-lol-accent font-bold">{fmtGold(p.gold_earned)}G</p>
        <p className="text-lol-text-sub">CS {p.cs}</p>
      </div>
    </button>
  )
}

interface Props {
  participants:  ParticipantStats[]
  myPuuid:       string
  myTeamId:      number
  visibleIds:    Set<number>
  plotColors:    Record<number, string>
  onToggle:      (participantId: number) => void
}

export const MatchResultTeams: FC<Props> = ({
  participants, myPuuid, myTeamId, visibleIds, plotColors, onToggle,
}) => {
  const { data: champData } = useChampions()
  const version = champData?.version ?? '15.8.1'

  const allies  = participants.filter((p) => p.team_id === myTeamId)
  const enemies = participants.filter((p) => p.team_id !== myTeamId)
  const allyWin = allies[0]?.win ?? false

  return (
    <div className="px-4 pt-4 pb-2">
      {/* チーム勝敗ヘッダー */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold font-display ${allyWin ? 'text-lol-success' : 'text-lol-error'}`}>
          {allyWin ? '勝利' : '敗北'} チーム
        </span>
        <span className="text-[10px] text-lol-text-sub">クリックでグラフ表示切替</span>
        <span className={`text-xs font-bold font-display ${allyWin ? 'text-lol-error' : 'text-lol-success'}`}>
          {allyWin ? '敗北' : '勝利'} チーム
        </span>
      </div>

      {/* 2カラムレイアウト */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          {allies.map((p) => (
            <PlayerRow
              key={p.puuid}
              p={p}
              version={version}
              isSelf={p.puuid === myPuuid}
              flip={false}
              isVisible={visibleIds.has(p.participant_id)}
              plotColor={plotColors[p.participant_id] ?? '#94a3b8'}
              onToggle={onToggle}
            />
          ))}
        </div>
        <div className="space-y-0.5">
          {enemies.map((p) => (
            <PlayerRow
              key={p.puuid}
              p={p}
              version={version}
              isSelf={false}
              flip={true}
              isVisible={visibleIds.has(p.participant_id)}
              plotColor={plotColors[p.participant_id] ?? '#94a3b8'}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
