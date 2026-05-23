import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLcu } from '../context/LcuContext'
import { useChampionMap } from '../hooks/useChampionMap'
import {
  useMatchHistory,
  getQueueLabel,
  formatDuration,
  formatTimeAgo,
  type MatchDetail,
  type ParticipantStats,
} from '../hooks/useMatchHistory'
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

function MatchRow({ match, myPuuid }: { match: MatchDetail; myPuuid: string }) {
  const navigate = useNavigate()
  const me: ParticipantStats | undefined =
    match.my_stats ?? match.participants.find((p) => p.puuid === myPuuid)
  if (!me) return null

  const win = me.win
  const kda =
    me.deaths === 0
      ? `${me.kills + me.assists}:1`
      : ((me.kills + me.assists) / me.deaths).toFixed(2)

  return (
    <button
      onClick={() => navigate(`/matches/${match.info.match_id}`, { state: { match, myPuuid } })}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-2 bg-[#080c14] hover:bg-[#0f1923] transition-colors ${
        win ? 'border-blue-500' : 'border-red-600'
      }`}
    >
      {/* チャンピオンアイコン */}
      <div className="relative shrink-0">
        <img
          src={dd.championIcon(me.champion_name)}
          alt={me.champion_name}
          className="w-9 h-9 rounded-full object-cover border border-[#1e2a3a]"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <span className="absolute -bottom-0.5 -right-0.5 text-[9px] bg-[#0a0e1a] border border-[#1e2a3a] px-0.5 rounded leading-tight">
          {me.champ_level}
        </span>
      </div>

      {/* 結果 + モード */}
      <div className="w-16 shrink-0">
        <p className={`text-xs font-bold ${win ? 'text-blue-400' : 'text-red-400'}`}>
          {win ? '勝利' : '敗北'}
        </p>
        <p className="text-[10px] text-gray-500 truncate">{getQueueLabel(match.info.queue_id)}</p>
      </div>

      {/* KDA */}
      <div className="shrink-0">
        <p className="text-xs font-semibold tabular-nums">
          {me.kills}/{me.deaths}/{me.assists}
        </p>
        <p className="text-[10px] text-gray-500">KDA {kda}</p>
      </div>

      {/* 時刻 + 時間 */}
      <div className="ml-auto text-right shrink-0">
        <p className="text-[10px] text-gray-400">{formatTimeAgo(match.info.game_end_timestamp)}</p>
        <p className="text-[10px] text-gray-600">{formatDuration(match.info.game_duration)}</p>
      </div>
    </button>
  )
}

export function DesktopHomePage(): JSX.Element {
  const navigate = useNavigate()
  const { isConnected, isConnecting, summoner, champSelect, gameflowPhase, connect } = useLcu()
  const [favorites, setFavorites] = useState<FavoriteChampion[]>([])
  const championMap = useChampionMap()
  const { matches, loading: matchLoading, error: matchError, reload: reloadMatches } = useMatchHistory(
    isConnected && summoner ? summoner.puuid : null
  )

  useEffect(() => {
    window.electronAPI.favorites.list().then(setFavorites)
  }, [])

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* LCU 接続ステータス */}
      <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${
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
              {/* 現在の状態バッジ */}
              {isConnected && gameflowPhase && gameflowPhase !== 'None' && (
                <span
                  className={`inline-flex items-center gap-1 mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#1e2a3a] border border-[#2a3a4a] ${PHASE_COLORS[gameflowPhase]}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                  {PHASE_LABELS[gameflowPhase]}
                </span>
              )}
            </div>
          </div>
          {!isConnected && (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-4 py-2 bg-[#c89b3c] hover:bg-[#d4a94a] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded text-sm transition-colors shrink-0"
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

      {/* チャンピオン選択中のチームアイコン */}
      {isConnected && gameflowPhase === 'ChampSelect' && champSelect && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">味方チーム</h2>
            <span className="text-xs text-green-400">
              残り {Math.ceil(champSelect.timer.adjustedTimeLeftInPhase / 1000)}秒
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {champSelect.myTeam.map((player) => {
              const key = championMap.get(player.championId)
              return (
                <div
                  key={player.cellId}
                  className="aspect-square bg-[#1e2a3a] rounded border border-[#2a3a4a] overflow-hidden flex items-center justify-center"
                >
                  {player.championId > 0 && key ? (
                    <img src={dd.championIcon(key)} alt={key} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-600 text-xs">?</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 対戦履歴 */}
      {isConnected && summoner && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">直近の対戦履歴</h2>
            <button
              onClick={() => navigate('/matches')}
              className="text-[11px] text-[#c89b3c] hover:text-[#d4a94a] transition-colors"
            >
              すべて見る →
            </button>
          </div>

          {matchLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-xs">
              <div className="w-4 h-4 border-2 border-[#c89b3c] border-t-transparent rounded-full animate-spin" />
              読み込み中...
            </div>
          )}

          {!matchLoading && matchError && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-lg p-3">
              <span className="text-red-400 text-sm shrink-0">⚠</span>
              <div className="min-w-0">
                <p className="text-red-400 text-xs font-semibold">取得エラー</p>
                <p className="text-red-300/70 text-[11px] mt-0.5 break-all">{matchError}</p>
                <button
                  onClick={reloadMatches}
                  className="mt-2 text-[11px] text-[#c89b3c] hover:text-[#d4a94a] underline"
                >
                  再試行
                </button>
              </div>
            </div>
          )}

          {!matchLoading && !matchError && matches.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-xs text-gray-500">マッチ履歴が見つかりませんでした</p>
              <button
                onClick={reloadMatches}
                className="text-[11px] text-[#c89b3c] hover:text-[#d4a94a] underline"
              >
                再読み込み
              </button>
            </div>
          )}

          {!matchLoading && !matchError && matches.length > 0 && (
            <div className="space-y-1.5">
              {matches.slice(0, 5).map((match) => (
                <MatchRow key={match.info.match_id} match={match} myPuuid={summoner.puuid} />
              ))}
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
            {favorites.map((fav) => {
              const key = championMap.get(fav.championId)
              return (
                <div
                  key={fav.championId}
                  className="flex items-center gap-2 bg-[#1e2a3a] px-3 py-2 rounded border border-[#2a3a4a]"
                >
                  {key ? (
                    <img
                      src={dd.championIcon(key)}
                      alt={fav.championName}
                      className="w-6 h-6 rounded object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-[#2a3a4a]" />
                  )}
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
              )
            })}
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
