import { type FC, useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale } from '@/hooks/useLocale'
import { LiveMatchPanel } from './LiveMatchPanel'

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? ''

// ─── 型定義 ────────────────────────────────────────────────
interface TeamTotals { kills: number; deaths: number; assists: number; gold: number }
interface PlayerSummary {
  player_name: string; team_id: number; team_name: string
  champion_name: string; champion_image: string
  kills: number; deaths: number; assists: number
  total_gold: number; damage_dealt: number
}
interface EsportsTeam {
  id: number; name: string; code: string; image: string
  result: { outcome: 'win' | 'loss'; gameWins: number } | null
  totals: TeamTotals | null
}
interface EsportsEvent {
  startTime: string; state: 'unstarted' | 'inProgress' | 'completed'; type: string
  blockName: string; league: { name: string }
  match: {
    id: string; teams: EsportsTeam[]
    strategy: { type: string; count: number }
    totalDuration: number
    summary: { top_kda: PlayerSummary | null; top_dmg: PlayerSummary | null }
  }
}
interface GamePlayer {
  game_id: number; player_name: string; team_id: number; team_name: string
  champion_name: string; champion_image: string
  kills: number; deaths: number; assists: number
  total_gold: number; damage_dealt: number
}
interface GameDetail {
  gameNumber: number; duration: number | null
  winnerSide: 'blue' | 'red' | null
  blueTeamName: string; redTeamName: string
  blueTeamGold: number; redTeamGold: number
  bluePlayers: GamePlayer[]; redPlayers: GamePlayer[]
}

// ─── API ─────────────────────────────────────────────────
interface ScheduleResponse {
  events: EsportsEvent[]
  syncing: boolean
}

async function fetchSchedule(leagueId: string, hlCode: string): Promise<ScheduleResponse> {
  const res = await fetch(`${API_BASE}/api/esports/schedule?leagueId=${leagueId}&hl=${hlCode}`)
  if (!res.ok) throw new Error('fetch failed')
  const json = await res.json()
  return {
    events:  (json.data?.schedule?.events ?? []).filter((e: EsportsEvent) => e.type === 'match'),
    syncing: json.syncing ?? false,
  }
}

async function fetchMatchDetail(matchId: string): Promise<GameDetail[]> {
  const res = await fetch(`${API_BASE}/api/esports/match/${matchId}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.games ?? []
}

// ─── ヘルパー ─────────────────────────────────────────────
const fmtDuration = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

const fmtGold = (g: number) =>
  g >= 1000 ? `${(g / 1000).toFixed(1)}k` : String(g)

const kda = (p: { kills: number; deaths: number; assists: number }) =>
  `${p.kills}/${p.deaths}/${p.assists}`

const kdaRatio = (p: { kills: number; deaths: number; assists: number }) =>
  ((p.kills + p.assists) / Math.max(p.deaths, 1)).toFixed(2)

// ─── プレイヤー行 ──────────────────────────────────────────
const PlayerRow: FC<{ p: GamePlayer; side: 'blue' | 'red'; isWinner: boolean }> = ({ p, side, isWinner }) => {
  const dmgPct = Math.min((p.damage_dealt / 50000) * 100, 100)
  const barColor = side === 'blue' ? 'bg-blue-500' : 'bg-red-500'
  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-b border-lol-border/20 last:border-0 ${isWinner ? 'bg-white/5' : 'opacity-70'}`}>
      <div className="w-8 h-8 rounded-full overflow-hidden bg-lol-border/30 shrink-0">
        {p.champion_image
          ? <img src={p.champion_image} alt={p.champion_name} className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          : <div className="w-full h-full flex items-center justify-center text-[9px] text-lol-text-sub">{p.champion_name.slice(0, 2)}</div>
        }
      </div>
      <div className="w-20 shrink-0">
        <p className="text-xs font-bold text-lol-text truncate">{p.player_name}</p>
        <p className="text-[10px] text-lol-text-sub truncate">{p.champion_name}</p>
      </div>
      <div className="w-16 text-center shrink-0">
        <p className="text-xs text-lol-text">{kda(p)}</p>
        <p className="text-[10px] text-lol-accent">{kdaRatio(p)} KDA</p>
      </div>
      <div className="w-12 text-right shrink-0">
        <p className="text-xs text-yellow-400">{fmtGold(p.total_gold)}</p>
        <p className="text-[10px] text-lol-text-sub">gold</p>
      </div>
      <div className="flex-1">
        <p className="text-[10px] text-lol-text-sub mb-0.5">{fmtGold(p.damage_dealt)}</p>
        <div className="h-1.5 bg-lol-border/30 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full`} style={{ width: `${dmgPct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── 試合詳細パネル ────────────────────────────────────────
const MatchDetail: FC<{ matchId: string }> = ({ matchId }) => {
  const [activeGame, setActiveGame] = useState(0)
  const { data: games, isLoading, isError } = useQuery({
    queryKey:  ['match-detail', matchId],
    queryFn:   () => fetchMatchDetail(matchId),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  if (isLoading) return (
    <div className="flex justify-center py-6">
      <div className="w-5 h-5 border-2 border-lol-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (isError || !games || games.length === 0) return (
    <div className="py-6 text-center">
      <p className="text-lol-text-sub text-xs">Leaguepediaにデータが未登録です</p>
      <p className="text-lol-text-sub/50 text-[10px] mt-1">試合後数日で更新されます</p>
    </div>
  )

  const game = games[activeGame]
  const isBlueWin = game.winnerSide === 'blue'
  const isRedWin  = game.winnerSide === 'red'

  return (
    <div className="border-t border-lol-border/40 bg-[#060d1a]">
      {games.length > 1 && (
        <div className="flex border-b border-lol-border/40">
          {games.map((g, i) => (
            <button key={i} onClick={() => setActiveGame(i)}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${
                activeGame === i
                  ? 'bg-lol-accent/20 text-lol-accent border-b-2 border-lol-accent'
                  : 'text-lol-text-sub hover:text-lol-text hover:bg-white/5'
              }`}>
              Game {g.gameNumber}
              {g.duration != null && <span className="ml-1 font-normal opacity-70">{fmtDuration(g.duration)}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-[260px]">
        {/* ブルーサイド */}
        <div className="flex-1 border-r border-lol-border/20">
          <div className={`px-3 py-2 flex items-center gap-2 border-b border-lol-border/30 ${isBlueWin ? 'bg-blue-600/20' : 'bg-black/10'}`}>
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            <span className="text-xs font-bold text-blue-300 truncate">{game.blueTeamName}</span>
            {isBlueWin && <span className="ml-auto text-[10px] text-blue-300 font-bold shrink-0">WIN</span>}
          </div>
          {game.bluePlayers.length > 0
            ? game.bluePlayers.map((p, i) => <PlayerRow key={i} p={p} side="blue" isWinner={isBlueWin} />)
            : <p className="text-center text-lol-text-sub text-xs py-8">データなし</p>
          }
        </div>

        {/* センター: ミニマップ */}
        <div className="w-36 shrink-0 flex flex-col items-center justify-center bg-[#030810]">
          <div className="relative w-28 h-28 rounded overflow-hidden border border-lol-border/30">
            <img src="https://ddragon.leagueoflegends.com/cdn/img/map/map11.png"
              alt="map" className="w-full h-full object-cover opacity-70" />
            {game.winnerSide && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded">
                  {isBlueWin ? game.blueTeamName : game.redTeamName} WIN
                </span>
              </div>
            )}
          </div>
          {game.duration != null && (
            <p className="mt-1.5 text-xs text-lol-text-sub">{fmtDuration(game.duration)}</p>
          )}
          {(game.blueTeamGold > 0 || game.redTeamGold > 0) && (() => {
            const total = game.blueTeamGold + game.redTeamGold
            const pct = total > 0 ? (game.blueTeamGold / total) * 100 : 50
            return (
              <div className="w-full px-3 mt-2">
                <p className="text-[9px] text-lol-text-sub text-center mb-1">ゴールド差</p>
                <div className="flex h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500" style={{ width: `${pct}%` }} />
                  <div className="bg-red-500 flex-1" />
                </div>
                <div className="flex justify-between text-[9px] mt-0.5">
                  <span className="text-blue-300">{fmtGold(game.blueTeamGold)}</span>
                  <span className="text-red-300">{fmtGold(game.redTeamGold)}</span>
                </div>
              </div>
            )
          })()}
        </div>

        {/* レッドサイド */}
        <div className="flex-1 border-l border-lol-border/20">
          <div className={`px-3 py-2 flex items-center gap-2 border-b border-lol-border/30 ${isRedWin ? 'bg-red-600/20' : 'bg-black/10'}`}>
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <span className="text-xs font-bold text-red-300 truncate">{game.redTeamName}</span>
            {isRedWin && <span className="ml-auto text-[10px] text-red-300 font-bold shrink-0">WIN</span>}
          </div>
          {game.redPlayers.length > 0
            ? game.redPlayers.map((p, i) => <PlayerRow key={i} p={p} side="red" isWinner={isRedWin} />)
            : <p className="text-center text-lol-text-sub text-xs py-8">データなし</p>
          }
        </div>
      </div>
    </div>
  )
}

// ─── 試合行 ──────────────────────────────────────────────
const ROW_HEIGHT = 56 // px（スクロール位置計算用）

const MatchRow: FC<{
  event: EsportsEvent; dateLocale: string
  expanded: boolean; onToggle: () => void
  innerRef?: React.RefObject<HTMLDivElement>
}> = ({ event, dateLocale, expanded, onToggle, innerRef }) => {
  const [a, b] = event.match.teams
  const bo     = event.match.strategy.count
  const date   = new Date(event.startTime)
  const isComp = event.state === 'completed'
  const isLive = event.state === 'inProgress'
  const aWin   = a?.result?.outcome === 'win'
  const bWin   = b?.result?.outcome === 'win'
  const { top_kda } = event.match.summary ?? {}
  const dur = event.match.totalDuration

  return (
    <div ref={innerRef} className="border-b border-lol-border/30 last:border-0">
      {/* クリック可能なのは完了試合のみ */}
      <div
        onClick={isComp ? onToggle : undefined}
        className={`
          flex items-center gap-2 px-3 py-2.5 transition-colors
          ${isComp ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}
          ${expanded ? 'bg-white/5' : ''}
          ${isLive ? 'bg-green-500/5' : ''}
        `}
        style={{ minHeight: `${ROW_HEIGHT}px` }}
      >
        {/* 日時 */}
        <div className="w-12 shrink-0">
          <p className="text-[10px] text-lol-text-sub leading-tight">
            {date.toLocaleDateString(dateLocale, { year: 'numeric', month: 'numeric', day: 'numeric' })}
          </p>
          <p className="text-xs font-bold text-lol-text leading-tight">
            {date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* チームA */}
        <div className="flex items-center gap-1.5 w-24 shrink-0">
          {a?.image
            ? <img
                src={a.image.startsWith('/img/') ? `${API_BASE}${a.image}` : a.image}
                alt={a.code}
                className={`w-6 h-6 object-contain shrink-0 ${isComp && !aWin ? 'opacity-40 grayscale' : ''}`}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <div className="w-6 h-6 shrink-0" />
          }
          <span className={`text-sm font-bold truncate ${aWin ? 'text-lol-accent' : isComp ? 'text-lol-text-sub/60' : 'text-lol-text'}`}>
            {a?.code ?? '?'}
          </span>
        </div>

        {/* スコア / バッジ */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 w-16">
          {isComp ? (
            <div className="flex items-center gap-1">
              <span className={`text-base font-bold ${aWin ? 'text-lol-accent' : 'text-lol-text-sub/60'}`}>{a?.result?.gameWins ?? 0}</span>
              <span className="text-lol-text-sub/50 text-xs">-</span>
              <span className={`text-base font-bold ${bWin ? 'text-lol-accent' : 'text-lol-text-sub/60'}`}>{b?.result?.gameWins ?? 0}</span>
            </div>
          ) : isLive ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-green-500/50 text-green-400 font-bold bg-green-500/10 animate-pulse">LIVE</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-lol-border text-lol-text-sub">予定</span>
          )}
          <span className="text-[9px] text-lol-text-sub/50">BO{bo}</span>
        </div>

        {/* チームB */}
        <div className="flex items-center gap-1.5 w-24 shrink-0">
          <span className={`text-sm font-bold truncate ${bWin ? 'text-lol-accent' : isComp ? 'text-lol-text-sub/60' : 'text-lol-text'}`}>
            {b?.code ?? '?'}
          </span>
          {b?.image
            ? <img
                src={b.image.startsWith('/img/') ? `${API_BASE}${b.image}` : b.image}
                alt={b.code}
                className={`w-6 h-6 object-contain shrink-0 ${isComp && !bWin ? 'opacity-40 grayscale' : ''}`}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <div className="w-6 h-6 shrink-0" />
          }
        </div>

        {/* 統計サマリー（完了時） */}
        <div className="hidden md:flex flex-1 items-center gap-3 overflow-hidden text-[10px] text-lol-text-sub">
          {isComp ? (
            <>
              {dur > 0 && <span className="shrink-0 flex items-center gap-1">⏱ {fmtDuration(dur)}</span>}
              {top_kda && <span className="truncate">★ {top_kda.player_name} ({kdaRatio(top_kda)})</span>}
            </>
          ) : (
            <span className="truncate opacity-50">{event.blockName}</span>
          )}
        </div>

        {/* 展開矢印（完了試合のみ） */}
        {isComp && (
          <svg className={`w-3.5 h-3.5 text-lol-text-sub/50 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* 展開詳細 */}
      {expanded && isComp && <MatchDetail matchId={event.match.id} />}
    </div>
  )
}

// ─── リーグ定義（フォールバック用） ──────────────────────
const LEAGUES_FALLBACK = [
  { id: '98767991349978712',  name: 'LJL',   hl: 'ja-JP', icon_url: '' },
  { id: '98767991310872058',  name: 'LCK',   hl: 'ko-KR', icon_url: '' },
  { id: '98767991299243165',  name: 'LCS',   hl: 'en-US', icon_url: '' },
  { id: '98767991302996019',  name: 'LEC',   hl: 'en-GB', icon_url: '' },
  { id: '98767991314006698',  name: 'LPL',   hl: 'zh-CN', icon_url: '' },
  { id: '98767991332355509',  name: 'CBLOL', hl: 'pt-BR', icon_url: '' },
  { id: '113476371197627891', name: 'LCP',   hl: 'en-US', icon_url: '' },
  { id: '104366947889790212', name: 'PCS',   hl: 'en-US', icon_url: '' },
]

interface LeagueInfo { id: string; name: string; hl: string; icon_url: string }

async function fetchLeagues(): Promise<LeagueInfo[]> {
  const res = await fetch(`${API_BASE}/api/esports/leagues`)
  if (!res.ok) return LEAGUES_FALLBACK
  return res.json()
}

// ─── メインコンポーネント ──────────────────────────────────
export const EsportsSchedule: FC = () => {
  const { leagueId: defaultLeagueId } = useLocale()

  const { data: leagues = LEAGUES_FALLBACK } = useQuery({
    queryKey:  ['esports-leagues'],
    queryFn:   fetchLeagues,
    staleTime: 24 * 60 * 60 * 1000,
  })

  const defaultLeague = leagues.find(l => l.id === defaultLeagueId) ?? leagues[0]
  const [selectedLeague, setSelectedLeague] = useState<LeagueInfo | null>(null)
  const currentLeague = selectedLeague ?? defaultLeague
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const scrollRef        = useRef<HTMLDivElement>(null)
  const firstUpcomingRef = useRef<HTMLDivElement>(null)
  const tabsRef          = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey:   ['esports-schedule', currentLeague.id],
    queryFn:    () => fetchSchedule(currentLeague.id, currentLeague.hl),
    staleTime:  0,
    retry:      1,
    // syncing中は15秒ごとに自動リフレッシュ
    refetchInterval: (query) =>
      query.state.data?.syncing ? 15_000 : false,
  })

  const syncing = data?.syncing ?? false

  // 時系列ソート: 完了(古→新) → LIVE → 予定(近→遠)
  const STATE_ORDER: Record<string, number> = { completed: 0, inProgress: 1, unstarted: 2 }
  const events = [...(data?.events ?? [])].sort((a, b) => {
    const sd = (STATE_ORDER[a.state] ?? 2) - (STATE_ORDER[b.state] ?? 2)
    if (sd !== 0) return sd
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })

  // リーグ切り替え時にスクロールリセット・展開閉じる・キャッシュ無効化
  const handleSelectLeague = (league: LeagueInfo) => {
    setSelectedLeague(league)
    setExpandedId(null)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    queryClient.invalidateQueries({ queryKey: ['esports-schedule', league.id] })
  }

  // データ取得後、直近の予定/LIVE試合へスクロール
  useEffect(() => {
    if (!data || !scrollRef.current || !firstUpcomingRef.current) return
    const container = scrollRef.current
    const target    = firstUpcomingRef.current
    // getBoundingClientRect でコンテナ相対の正確な位置を計算
    const containerTop = container.getBoundingClientRect().top
    const targetTop    = target.getBoundingClientRect().top
    const relativeTop  = targetTop - containerTop + container.scrollTop
    container.scrollTop = Math.max(0, relativeTop - ROW_HEIGHT * 2)
  }, [data])

  // 直近の予定/LIVE試合のインデックス
  const firstUpcomingIdx = events.findIndex(e => e.state !== 'completed')

  return (
    <section className="max-w-6xl mx-auto px-4 pb-12">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
      <div className="bg-lol-card border border-lol-border rounded-2xl overflow-hidden flex-1 min-w-0">
        {/* ヘッダー */}
        <div className="border-b border-lol-border bg-[#0a1020]">
          {/* タイトル行 */}
          <div className="flex items-center justify-end px-4 py-2.5">
            <a href={`https://lolesports.com/schedule?leagues=${currentLeague.name.toLowerCase()}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-lol-accent hover:underline">
              すべて見る →
            </a>
          </div>
          {/* リーグタブ */}
          <div
            ref={tabsRef}
            className="flex overflow-x-auto scrollbar-none px-2 pb-0 gap-0.5"
          >
            {leagues.map(league => (
              <button
                key={league.id}
                onClick={() => handleSelectLeague(league)}
                className={`
                  relative shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors
                  ${currentLeague.id === league.id
                    ? 'text-lol-accent'
                    : 'text-lol-text-sub hover:text-lol-text'
                  }
                `}
              >
                <img
                  src={league.icon_url}
                  alt={league.name}
                  className={`w-4 h-4 object-contain shrink-0 ${currentLeague.id === league.id ? 'opacity-100' : 'opacity-50'}`}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                {league.name}
                {currentLeague.id === league.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-lol-accent rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* スクロール可能なリスト（7行分の高さ） */}
        <div
          ref={scrollRef}
          className="overflow-y-auto scrollbar-thin scrollbar-thumb-lol-border scrollbar-track-transparent"
          style={{ maxHeight: `${ROW_HEIGHT * 7}px` }}
        >
          {isLoading && [...Array(7)].map((_, i) => (
            <div key={i} className="border-b border-lol-border/30 animate-pulse bg-lol-card"
              style={{ height: `${ROW_HEIGHT}px` }} />
          ))}

          {isError && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-lol-text-sub text-sm">スケジュールを取得できませんでした</p>
              <a href={`https://lolesports.com/schedule?leagues=${currentLeague.name.toLowerCase()}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-lol-accent hover:underline">
                lolesports.com で確認 →
              </a>
            </div>
          )}

          {!isLoading && !isError && events.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              {syncing ? (
                <>
                  <div className="w-5 h-5 border-2 border-lol-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-lol-text-sub text-sm">データ同期中...</p>
                  <p className="text-lol-text-sub/50 text-xs">15秒後に自動更新します</p>
                </>
              ) : (
                <p className="text-lol-text-sub text-sm">現在スケジュールはありません</p>
              )}
            </div>
          )}

          {events.map((event, idx) => {
            const isFirstUpcoming = idx === firstUpcomingIdx && firstUpcomingIdx !== -1
            return (
              <MatchRow
                key={`${event.match.id}-${event.startTime}`}
                event={event}
                dateLocale="ja-JP"
                expanded={expandedId === event.match.id}
                onToggle={() => setExpandedId(prev =>
                  prev === event.match.id ? null : event.match.id
                )}
                innerRef={isFirstUpcoming ? firstUpcomingRef : undefined}
              />
            )
          })}
        </div>

      </div>

      {/* LIVE / 直近予定パネル */}
      <LiveMatchPanel />
      </div>
    </section>
  )
}
