/**
 * チャンピオン選択ページ（メインウィンドウ内表示）
 *
 * ChampSelect フェーズ中にメイン画面で表示される。
 * 青チーム（左）・BAN（上部中央）・赤チーム（右）の3カラムレイアウト。
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChampSelectSession, ChampSelectPlayer } from '../../../types/lcu'
import { useChampionMap } from '../hooks/useChampionMap'
import { useLcu } from '../context/LcuContext'
import { dd } from '../utils/ddragon'

const POSITION_LABELS: Record<string, string> = {
  TOP: 'TOP',
  JUNGLE: 'JG',
  MIDDLE: 'MID',
  BOTTOM: 'BOT',
  UTILITY: 'SUP',
}

const PHASE_LABEL: Record<string, string> = {
  PLANNING:     'インテント',
  BAN_PICK:     'BAN / PICK',
  FINALIZATION: '確定中',
  GAME_STARTING:'ゲーム開始',
}

// ------------------------------------
// チャンピオンアイコン
// ------------------------------------
function ChampIcon({
  championId,
  hoverChampionId = 0,
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
  const id = championId > 0 ? championId : hoverChampionId
  const name = championMap.get(id) ?? ''
  const src = name ? dd.championIcon(name) : null
  const sz = size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-8 h-8' : 'w-11 h-11'
  const opacity = dimmed ? 'opacity-30' : championId === 0 && hoverChampionId > 0 ? 'opacity-55' : ''

  return (
    <div className={`${sz} rounded-md bg-[#1a2433] overflow-hidden shrink-0 ${opacity}`}>
      {src
        ? <img src={src} alt={name} className="w-full h-full object-cover" />
        : <span className="w-full h-full flex items-center justify-center text-[#2a3a4a] text-xs">?</span>
      }
    </div>
  )
}

// ------------------------------------
// プレイヤー行
// ------------------------------------
function PlayerCard({
  player,
  championMap,
  isLocal,
  align,
}: {
  player: ChampSelectPlayer
  championMap: Map<number, string>
  isLocal: boolean
  align: 'left' | 'right'
}) {
  const hasChamp = player.championId > 0
  const isHover = !hasChamp && player.championPickIntent > 0
  const name = championMap.get(player.championId || player.championPickIntent) ?? (hasChamp || isHover ? '…' : '未選択')
  const posLabel = POSITION_LABELS[player.assignedPosition]

  const row = (
    <>
      <ChampIcon
        championId={player.championId}
        hoverChampionId={player.championPickIntent}
        championMap={championMap}
        dimmed={!hasChamp && !isHover}
      />
      <div className={`flex-1 min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
        {posLabel && (
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              align === 'left'
                ? 'bg-blue-900/40 text-blue-300'
                : 'bg-red-900/40 text-red-300'
            }`}
          >
            {posLabel}
          </span>
        )}
        <p
          className={`text-[13px] font-medium mt-0.5 truncate ${
            hasChamp ? 'text-gray-100' : isHover ? 'text-gray-400' : 'text-[#2a3a4a]'
          }`}
        >
          {name}
        </p>
        {isLocal && (
          <p className="text-[10px] text-[#c89b3c]">あなた</p>
        )}
      </div>
    </>
  )

  const border = isLocal
    ? (align === 'left' ? 'border-blue-500/50' : 'border-red-500/50')
    : (align === 'left' ? 'border-blue-900/40' : 'border-red-900/40')

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
        isLocal ? 'bg-[#1a2a3a]' : 'bg-[#0d1520]'
      } ${border} ${align === 'right' ? 'flex-row-reverse' : ''}`}
    >
      {row}
    </div>
  )
}

// ------------------------------------
// BANアイコン（×マーク付き）
// ------------------------------------
function BanIcon({ championId, championMap }: { championId: number; championMap: Map<number, string> }) {
  const name = championMap.get(championId) ?? ''
  const src = name ? dd.championIcon(name) : null

  return (
    <div className="relative w-8 h-8 rounded bg-[#1a2433] overflow-hidden shrink-0">
      {src
        ? <img src={src} alt={name} className="w-full h-full object-cover opacity-50 grayscale" />
        : <div className="w-full h-full bg-[#1a2433]" />
      }
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-full h-0.5 bg-red-500/80 rotate-45" />
        <div className="absolute w-full h-0.5 bg-red-500/80 -rotate-45" />
      </div>
    </div>
  )
}

// ------------------------------------
// メインページ
// ------------------------------------
export function ChampSelectPage(): JSX.Element {
  const navigate = useNavigate()
  const { champSelect, gameflowPhase } = useLcu()
  const [session, setSession] = useState<ChampSelectSession | null>(champSelect)
  const [timeLeft, setTimeLeft] = useState(0)
  const championMap = useChampionMap()

  // LcuContext の champSelect を優先して使用（ポーリングで更新される）
  useEffect(() => {
    if (champSelect) {
      setSession(champSelect)
      setTimeLeft(Math.ceil(champSelect.timer.adjustedTimeLeftInPhase / 1000))
    }
  }, [champSelect])

  // イベント購読（より細かいリアルタイム更新）
  useEffect(() => {
    const handler = (data: unknown) => {
      const s = data as ChampSelectSession
      setSession(s)
      setTimeLeft(Math.ceil(s.timer.adjustedTimeLeftInPhase / 1000))
    }
    window.electronAPI.on('lcu:champSelectUpdate', handler)
    return () => { window.electronAPI.off('lcu:champSelectUpdate') }
  }, [])

  // フェーズが終わったらホームに戻る
  useEffect(() => {
    if (gameflowPhase !== null && gameflowPhase !== 'ChampSelect') {
      navigate('/', { replace: true })
    }
  }, [gameflowPhase, navigate])

  // カウントダウン
  useEffect(() => {
    if (timeLeft <= 0) return
    const t = setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000)
    return () => clearInterval(t)
  }, [timeLeft])

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        チャンピオン選択情報を取得中...
      </div>
    )
  }

  const localCellId = session.localPlayerCellId
  const phase = PHASE_LABEL[session.timer.phase] ?? session.timer.phase
  const isUrgent = timeLeft > 0 && timeLeft <= 10

  const myBans = session.bans?.myTeamBans?.filter(Boolean) ?? []
  const theirBans = session.bans?.theirTeamBans?.filter(Boolean) ?? []

  return (
    <div className="flex flex-col h-full select-none">
      {/* ヘッダー: フェーズ + タイマー */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1e2a3a] bg-[#060a11] shrink-0">
        <p className="text-xs text-gray-500 uppercase tracking-widest">{phase}</p>
        <div
          className={`text-2xl font-bold tabular-nums ${
            isUrgent ? 'text-red-400 animate-pulse' : 'text-white'
          }`}
        >
          {timeLeft > 0 ? `${timeLeft}s` : '—'}
        </div>
        <p className="text-xs text-gray-500">チャンピオン選択</p>
      </div>

      {/* BANアイコン（両チーム） */}
      {(myBans.length > 0 || theirBans.length > 0) && (
        <div className="flex items-center justify-between px-6 py-2 bg-[#080c14] border-b border-[#1e2a3a] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-blue-400 uppercase tracking-wider mr-1">BAN</span>
            {myBans.map((id, i) => <BanIcon key={i} championId={id} championMap={championMap} />)}
          </div>
          <div className="flex items-center gap-1.5">
            {theirBans.map((id, i) => <BanIcon key={i} championId={id} championMap={championMap} />)}
            <span className="text-[10px] text-red-400 uppercase tracking-wider ml-1">BAN</span>
          </div>
        </div>
      )}

      {/* メインコンテンツ: 青チーム / 赤チーム */}
      <div className="flex flex-1 min-h-0 gap-4 px-6 py-4">
        {/* 青チーム（左） */}
        <div className="flex-1 flex flex-col gap-2">
          <h2 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">
            味方チーム
          </h2>
          {session.myTeam.map((player) => (
            <PlayerCard
              key={player.cellId}
              player={player}
              championMap={championMap}
              isLocal={player.cellId === localCellId}
              align="left"
            />
          ))}
        </div>

        {/* セパレーター */}
        <div className="w-px bg-[#1e2a3a] shrink-0 self-stretch" />

        {/* 赤チーム（右） */}
        <div className="flex-1 flex flex-col gap-2">
          <h2 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1 text-right">
            敵チーム
          </h2>
          {session.theirTeam.map((player) => (
            <PlayerCard
              key={player.cellId}
              player={player}
              championMap={championMap}
              isLocal={false}
              align="right"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ChampSelectPage
