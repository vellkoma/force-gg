/**
 * チャンピオン選択画面オーバーレイ（強化版）
 *
 * LoLのチャンピオン選択中に表示される縦長パネル。
 * チャンピオンアイコン・名前・BAN情報・タイマーを表示する。
 */

import { useState, useEffect } from 'react'
import type { ChampSelectSession, ChampSelectPlayer } from '../../../types/lcu'
import { useChampionMap } from '../hooks/useChampionMap'
import { dd } from '../utils/ddragon'

const POSITION_LABELS: Record<string, string> = {
  TOP: 'TOP',
  JUNGLE: 'JG',
  MIDDLE: 'MID',
  BOTTOM: 'BOT',
  UTILITY: 'SUP',
}

const PHASE_LABEL: Record<string, string> = {
  PLANNING:  'インテント',
  BAN_PICK:  'BAN / PICK',
  FINALIZATION: '確定中',
  GAME_STARTING: 'ゲーム開始',
}

// チャンピオン選択状態（未選択 / ホバー / 確定）
type SlotState = 'empty' | 'hover' | 'picked' | 'banned'

function getSlotState(player: ChampSelectPlayer): SlotState {
  if (player.championPickIntent > 0 && player.championId === 0) return 'hover'
  if (player.championId > 0) return 'picked'
  return 'empty'
}

function ChampIcon({
  championId,
  hoverChampionId,
  championMap,
  size = 'md',
  dimmed = false,
}: {
  championId: number
  hoverChampionId?: number
  championMap: Map<number, string>
  size?: 'sm' | 'md' | 'lg'
  dimmed?: boolean
}) {
  const effectiveId = championId > 0 ? championId : (hoverChampionId ?? 0)
  const name = championMap.get(effectiveId) ?? ''
  const iconUrl = name ? dd.championIcon(name) : null
  const sizeClass = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'

  return (
    <div
      className={`${sizeClass} rounded bg-[#1e2a3a] flex items-center justify-center overflow-hidden shrink-0 ${
        dimmed ? 'opacity-40 grayscale' : ''
      } ${hoverChampionId && championId === 0 ? 'opacity-60' : ''}`}
    >
      {iconUrl ? (
        <img src={iconUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-gray-600 text-[9px]">?</span>
      )}
    </div>
  )
}

function PlayerRow({
  player,
  championMap,
  isLocal = false,
  teamColor,
}: {
  player: ChampSelectPlayer
  championMap: Map<number, string>
  isLocal?: boolean
  teamColor: 'blue' | 'red'
}) {
  const state = getSlotState(player)
  const champName = championMap.get(player.championId) ?? (state === 'hover' ? '…' : '未選択')
  const posLabel = POSITION_LABELS[player.assignedPosition]
  const borderColor = teamColor === 'blue' ? 'border-blue-900' : 'border-red-900'
  const localBorder = isLocal
    ? (teamColor === 'blue' ? 'border-blue-500/60' : 'border-red-500/60')
    : borderColor

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded border ${
        isLocal ? `bg-[#1a2a3a] ${localBorder}` : `bg-[#0d1520] ${borderColor}`
      }`}
    >
      <ChampIcon
        championId={player.championId}
        hoverChampionId={player.championPickIntent}
        championMap={championMap}
        dimmed={state === 'empty'}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {posLabel && (
            <span
              className={`text-[9px] font-bold px-1 rounded ${
                teamColor === 'blue'
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-red-900/50 text-red-300'
              }`}
            >
              {posLabel}
            </span>
          )}
          {isLocal && (
            <span className="text-[9px] text-[#c89b3c]">あなた</span>
          )}
        </div>
        <p
          className={`text-xs truncate mt-0.5 ${
            state === 'empty' ? 'text-gray-600' : 'text-gray-200'
          }`}
        >
          {champName}
        </p>
      </div>
    </div>
  )
}

function BanRow({
  championId,
  championMap,
}: {
  championId: number
  championMap: Map<number, string>
}) {
  if (championId <= 0) return null
  const name = championMap.get(championId) ?? ''
  return (
    <div className="relative shrink-0">
      <ChampIcon championId={championId} championMap={championMap} size="sm" />
      {/* ✕ マーク */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-0.5 bg-red-500/80 rotate-45 absolute" />
        <div className="w-full h-0.5 bg-red-500/80 -rotate-45 absolute" />
      </div>
      <div className="absolute inset-0 bg-black/50 rounded" />
    </div>
  )
}

export function OverlayPage(): JSX.Element {
  const [session, setSession] = useState<ChampSelectSession | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const championMap = useChampionMap()

  useEffect(() => {
    const handler = (data: unknown) => {
      const s = data as ChampSelectSession
      setSession(s)
      setTimeLeft(Math.ceil(s.timer.adjustedTimeLeftInPhase / 1000))
    }
    window.electronAPI.on('lcu:champSelectUpdate', handler)
    window.electronAPI.lcu.getChampSelect().then((data) => {
      if (data) {
        setSession(data)
        setTimeLeft(Math.ceil(data.timer.adjustedTimeLeftInPhase / 1000))
      }
    })
    return () => { window.electronAPI.off('lcu:champSelectUpdate') }
  }, [])

  useEffect(() => {
    if (timeLeft <= 0) return
    const t = setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000)
    return () => clearInterval(t)
  }, [timeLeft])

  if (!session) {
    return (
      <div className="w-full h-screen bg-black/80 flex items-center justify-center">
        <p className="text-gray-500 text-xs">チャンピオン選択を待機中...</p>
      </div>
    )
  }

  const localPlayer = session.myTeam.find((p) => p.cellId === session.localPlayerCellId)
  const phase = PHASE_LABEL[session.timer.phase] ?? session.timer.phase
  const isUrgent = timeLeft > 0 && timeLeft <= 10

  // BAN済みチャンピオン
  const myBans = session.bans?.myTeamBans ?? []
  const theirBans = session.bans?.theirTeamBans ?? []

  return (
    <div className="w-full h-screen bg-[#050a12]/90 text-white flex flex-col overflow-hidden select-none text-sm">
      {/* ヘッダー */}
      <div className="bg-[#0a0e1a]/95 border-b border-[#1e2a3a] px-3 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[#c89b3c] text-[11px] font-bold tracking-wide">force.gg</span>
          <span className="text-gray-600 text-[10px]">|</span>
          <span className="text-gray-400 text-[10px]">{phase}</span>
        </div>
        <div
          className={`text-base font-bold tabular-nums ${
            isUrgent ? 'text-red-400 animate-pulse' : 'text-white'
          }`}
        >
          {timeLeft > 0 ? `${timeLeft}s` : '—'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
        {/* 味方チーム */}
        <section>
          <h3 className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-1.5 px-1">
            味方チーム
          </h3>
          <div className="space-y-1">
            {session.myTeam.map((player) => (
              <PlayerRow
                key={player.cellId}
                player={player}
                championMap={championMap}
                isLocal={player.cellId === session.localPlayerCellId}
                teamColor="blue"
              />
            ))}
          </div>
          {/* 味方BAN */}
          {myBans.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1 px-1">
              <span className="text-[9px] text-gray-600 mr-0.5">BAN</span>
              {myBans.map((id, i) => (
                <BanRow key={i} championId={id} championMap={championMap} />
              ))}
            </div>
          )}
        </section>

        <div className="border-t border-[#1e2a3a]" />

        {/* 敵チーム */}
        <section>
          <h3 className="text-[9px] text-red-400 font-bold uppercase tracking-widest mb-1.5 px-1">
            敵チーム
          </h3>
          <div className="space-y-1">
            {session.theirTeam.map((player) => (
              <PlayerRow
                key={player.cellId}
                player={player}
                championMap={championMap}
                isLocal={false}
                teamColor="red"
              />
            ))}
          </div>
          {/* 敵BAN */}
          {theirBans.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1 px-1">
              <span className="text-[9px] text-gray-600 mr-0.5">BAN</span>
              {theirBans.map((id, i) => (
                <BanRow key={i} championId={id} championMap={championMap} />
              ))}
            </div>
          )}
        </section>

        {/* 自分のポジション情報 */}
        {localPlayer?.assignedPosition && (
          <section className="bg-[#0f1923] rounded border border-[#1e2a3a] p-2.5">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">あなたのポジション</p>
            <p className="text-sm font-bold text-[#c89b3c]">
              {POSITION_LABELS[localPlayer.assignedPosition] ?? localPlayer.assignedPosition}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

export default OverlayPage
