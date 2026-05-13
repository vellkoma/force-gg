import { useEffect, useState } from 'react'
import { useLcu } from '../context/LcuContext'
import { dd } from '../utils/ddragon'
import type { GameflowPhase } from '../../../types/lcu'
import type { FavoriteChampion } from '../../../preload/index.d'

const PHASE_LABELS: Record<GameflowPhase, string> = {
  None: 'アイドル',
  Lobby: 'ロビー',
  Matchmaking: 'マッチング中',
  ReadyCheck: 'マッチ承認',
  ChampSelect: 'チャンピオン選択中',
  InProgress: 'ゲーム中',
  WaitingForStats: '結果待ち',
  PreEndOfGame: '試合終了',
  EndOfGame: '結果画面',
  Reconnect: '再接続',
}

const PHASE_COLORS: Record<GameflowPhase, string> = {
  None: 'text-gray-400',
  Lobby: 'text-blue-400',
  Matchmaking: 'text-yellow-400',
  ReadyCheck: 'text-orange-400',
  ChampSelect: 'text-green-400',
  InProgress: 'text-red-400',
  WaitingForStats: 'text-purple-400',
  PreEndOfGame: 'text-purple-400',
  EndOfGame: 'text-gray-300',
  Reconnect: 'text-red-500',
}

export function DesktopHomePage(): JSX.Element {
  const { isConnected, isConnecting, summoner, champSelect, gameflowPhase, connect } = useLcu()
  const [favorites, setFavorites] = useState<FavoriteChampion[]>([])

  useEffect(() => {
    window.electronAPI.favorites.list().then(setFavorites)
  }, [])

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* LCU 接続ステータス */}
      <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-red-500'
              }`}
            />
            <div>
              <p className="font-medium">
                {isConnected ? 'LoLクライアントに接続中' : 'LoLクライアント未接続'}
              </p>
              <p className="text-sm text-gray-400 mt-0.5">
                {isConnected
                  ? 'チャンピオン選択画面でオーバーレイが表示されます'
                  : 'LoLを起動してから接続してください'}
              </p>
            </div>
          </div>
          {!isConnected && (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-4 py-2 bg-[#c89b3c] hover:bg-[#d4a94a] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded text-sm transition-colors"
            >
              {isConnecting ? '接続中...' : 'LoLクライアントに接続'}
            </button>
          )}
        </div>
      </section>

      {/* サモナー情報 */}
      {isConnected && summoner && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            サモナー情報
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#1e2a3a] overflow-hidden border-2 border-[#c89b3c]">
              <img
                src={dd.profileIcon(summoner.profileIconId)}
                alt="プロフィールアイコン"
                className="w-full h-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <div>
              <p className="text-xl font-bold text-[#c89b3c]">{summoner.displayName}</p>
              <p className="text-sm text-gray-400">レベル {summoner.summonerLevel}</p>
            </div>
          </div>
        </section>
      )}

      {/* ゲームフローフェーズ */}
      {isConnected && gameflowPhase && gameflowPhase !== 'None' && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            現在の状態
          </h2>
          <p className={`text-2xl font-bold ${PHASE_COLORS[gameflowPhase]}`}>
            {PHASE_LABELS[gameflowPhase]}
          </p>

          {gameflowPhase === 'ChampSelect' && champSelect && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">
                {champSelect.timer.phase} — 残り{' '}
                {Math.ceil(champSelect.timer.adjustedTimeLeftInPhase / 1000)}秒
              </p>
              <div className="grid grid-cols-5 gap-2">
                {champSelect.myTeam.map((player) => (
                  <div
                    key={player.cellId}
                    className="aspect-square bg-[#1e2a3a] rounded border border-[#2a3a4a] overflow-hidden flex items-center justify-center"
                  >
                    {player.championId > 0 ? (
                      <img
                        src={dd.championIcon(String(player.championId))}
                        alt={`Champion ${player.championId}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-600 text-xs">?</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* お気に入りチャンピオン */}
      {favorites.length > 0 && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            お気に入りチャンピオン
          </h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map((fav) => (
              <div
                key={fav.championId}
                className="flex items-center gap-2 bg-[#1e2a3a] px-3 py-2 rounded border border-[#2a3a4a]"
              >
                <span className="text-sm">{fav.championName}</span>
                <button
                  onClick={async () => {
                    await window.electronAPI.favorites.remove(fav.championId)
                    setFavorites((prev) => prev.filter((f) => f.championId !== fav.championId))
                  }}
                  className="text-gray-500 hover:text-red-400 transition-colors text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 未接続ガイド */}
      {!isConnected && !isConnecting && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-8 text-center">
          <div className="text-5xl mb-4">⚔️</div>
          <h2 className="text-lg font-semibold mb-2">LoLクライアントが検出されません</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            League of Legends を起動してから
            <br />
            「LoLクライアントに接続」ボタンを押してください。
            <br />
            <span className="text-[#c89b3c]">チャンピオン選択画面</span>
            になると自動的にオーバーレイが表示されます。
          </p>
        </section>
      )}
    </div>
  )
}

export default DesktopHomePage
