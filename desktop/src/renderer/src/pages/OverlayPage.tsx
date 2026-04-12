/**
 * チャンピオン選択画面オーバーレイ
 *
 * LoLのチャンピオン選択中に画面右端に表示される縦長パネル。
 * 敵チームの選択チャンピオンと統計情報を表示する。
 */

import { useState, useEffect } from 'react'
import type { ChampSelectSession, ChampSelectPlayer } from '../../../types/lcu'

// ポジションの日本語表示とアイコン
const POSITION_LABELS: Record<string, string> = {
  TOP: 'TOP',
  JUNGLE: 'JG',
  MIDDLE: 'MID',
  BOTTOM: 'BOT',
  UTILITY: 'SUP',
  '': '-'
}

interface ChampionCardProps {
  player: ChampSelectPlayer
  isLocalPlayer?: boolean
}

function ChampionCard({ player, isLocalPlayer = false }: ChampionCardProps): JSX.Element {
  const hasChampion = player.championId > 0

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded ${
        isLocalPlayer
          ? 'bg-[#1a2a3a] border border-[#c89b3c]/50'
          : 'bg-[#0f1923] border border-[#1e2a3a]'
      }`}
    >
      {/* チャンピオンアイコン */}
      <div className="w-10 h-10 rounded bg-[#1e2a3a] flex items-center justify-center flex-shrink-0 overflow-hidden">
        {hasChampion ? (
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${player.championId}.png`}
            alt={`Champion ${player.championId}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-600 text-[10px]">?</span>
        )}
      </div>

      {/* 情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span
            className={`text-[10px] font-bold px-1 rounded ${
              isLocalPlayer ? 'bg-[#c89b3c]/20 text-[#c89b3c]' : 'bg-[#1e2a3a] text-gray-400'
            }`}
          >
            {POSITION_LABELS[player.assignedPosition] ?? player.assignedPosition}
          </span>
          {isLocalPlayer && (
            <span className="text-[9px] text-[#c89b3c]">あなた</span>
          )}
        </div>
        <p className="text-xs text-gray-300 truncate mt-0.5">
          {hasChampion ? `ID: ${player.championId}` : '未選択'}
        </p>
      </div>
    </div>
  )
}

export function OverlayPage(): JSX.Element {
  const [session, setSession] = useState<ChampSelectSession | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)

  // メインプロセスからのチャンピオン選択更新を受け取る
  useEffect(() => {
    window.electronAPI.on('lcu:champSelectUpdate', (data: unknown) => {
      const newSession = data as ChampSelectSession
      setSession(newSession)
      setTimeLeft(Math.ceil(newSession.timer.adjustedTimeLeftInPhase / 1000))
    })

    // 初回データ取得
    window.electronAPI.lcu.getChampSelect().then((data) => {
      if (data) {
        setSession(data)
        setTimeLeft(Math.ceil(data.timer.adjustedTimeLeftInPhase / 1000))
      }
    })

    return () => {
      window.electronAPI.off('lcu:champSelectUpdate')
    }
  }, [])

  // タイマーカウントダウン
  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  if (!session) {
    return (
      <div className="w-full h-screen bg-black/80 flex items-center justify-center">
        <p className="text-gray-400 text-sm">チャンピオン選択を待機中...</p>
      </div>
    )
  }

  const localPlayer = session.myTeam.find(
    (p) => p.cellId === session.localPlayerCellId
  )

  return (
    <div className="w-full h-screen bg-black/85 text-white flex flex-col overflow-hidden select-none">
      {/* ヘッダー */}
      <div className="bg-[#0a0e1a]/90 border-b border-[#1e2a3a] px-3 py-2 flex items-center justify-between">
        <span className="text-[#c89b3c] text-xs font-bold">LoLガイド</span>
        <div className="text-right">
          <p className="text-[10px] text-gray-400">{session.timer.phase}</p>
          <p
            className={`text-sm font-bold tabular-nums ${
              timeLeft <= 10 ? 'text-red-400' : 'text-white'
            }`}
          >
            {timeLeft}s
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* 自チーム */}
        <section>
          <h3 className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1 px-1">
            味方チーム
          </h3>
          <div className="space-y-1">
            {session.myTeam.map((player) => (
              <ChampionCard
                key={player.cellId}
                player={player}
                isLocalPlayer={player.cellId === session.localPlayerCellId}
              />
            ))}
          </div>
        </section>

        {/* 区切り */}
        <div className="border-t border-[#1e2a3a]" />

        {/* 敵チーム */}
        <section>
          <h3 className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1 px-1">
            敵チーム
          </h3>
          <div className="space-y-1">
            {session.theirTeam.map((player) => (
              <ChampionCard key={player.cellId} player={player} />
            ))}
          </div>
        </section>

        {/* ヒント */}
        {localPlayer && localPlayer.assignedPosition && (
          <section className="bg-[#0f1923] rounded border border-[#1e2a3a] p-2">
            <p className="text-[10px] text-gray-400 mb-1">ポジション</p>
            <p className="text-sm font-bold text-[#c89b3c]">
              {POSITION_LABELS[localPlayer.assignedPosition] ?? localPlayer.assignedPosition}
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                // Webアプリのメタページへ遷移（実装時にURLを設定）
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 block"
            >
              メタを確認する →
            </a>
          </section>
        )}
      </div>
    </div>
  )
}

export default OverlayPage
