import { type FC } from 'react'
import { useQuery } from '@tanstack/react-query'

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? ''

interface LiveMatch {
  id: number
  league_name: string
  league_icon: string
  begin_at: string
  status: 'running' | 'not_started'
  team1_name: string
  team1_acronym: string
  team1_image: string
  team1_score: number
  team2_name: string
  team2_acronym: string
  team2_image: string
  team2_score: number
  number_of_games: number
}

async function fetchLiveMatches(): Promise<LiveMatch[]> {
  const res = await fetch(`${API_BASE}/api/esports/live`)
  if (!res.ok) return []
  return res.json()
}

const TeamLogo: FC<{ src: string; alt: string; dim?: boolean }> = ({ src, alt, dim }) => (
  src
    ? <img
        src={src.startsWith('/img/') ? `${API_BASE}${src}` : src}
        alt={alt}
        className={`w-7 h-7 object-contain shrink-0 ${dim ? 'opacity-40 grayscale' : ''}`}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    : <div className="w-7 h-7 shrink-0" />
)

const LiveMatchCard: FC<{ match: LiveMatch }> = ({ match }) => {
  const isLive = match.status === 'running'
  const date   = new Date(match.begin_at)

  const t1Wins  = match.team1_score
  const t2Wins  = match.team2_score
  const maxWins = Math.max(t1Wins, t2Wins)
  const t1Lead  = isLive && t1Wins > t2Wins
  const t2Lead  = isLive && t2Wins > t1Wins

  return (
    <div className={`px-3 py-2.5 border-b border-lol-border/30 last:border-0 ${isLive ? 'bg-green-500/5' : ''}`}>
      {/* リーグ + ステータス */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          {match.league_icon && (
            <img src={match.league_icon} alt={match.league_name}
              className="w-3.5 h-3.5 object-contain opacity-70"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <span className="text-[10px] text-lol-text-sub">{match.league_name}</span>
          <span className="text-[10px] text-lol-text-sub/40 ml-0.5">BO{match.number_of_games}</span>
        </div>
        {isLive ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded border border-green-500/50 text-green-400 font-bold bg-green-500/10 animate-pulse">
            LIVE
          </span>
        ) : (
          <span className="text-[10px] text-lol-text-sub/60">
            {date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
            {' '}
            {date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* チーム vs チーム */}
      <div className="flex items-center gap-1.5">
        {/* チーム1 */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <TeamLogo src={match.team1_image} alt={match.team1_acronym} />
          <span className={`text-xs font-bold truncate ${t1Lead ? 'text-lol-accent' : 'text-lol-text'}`}>
            {match.team1_acronym || match.team1_name}
          </span>
        </div>

        {/* スコア */}
        <div className="flex items-center gap-1 shrink-0 w-12 justify-center">
          {isLive && maxWins > 0 ? (
            <>
              <span className={`text-sm font-bold ${t1Lead ? 'text-lol-accent' : 'text-lol-text-sub/60'}`}>{t1Wins}</span>
              <span className="text-lol-text-sub/40 text-xs">-</span>
              <span className={`text-sm font-bold ${t2Lead ? 'text-lol-accent' : 'text-lol-text-sub/60'}`}>{t2Wins}</span>
            </>
          ) : (
            <span className="text-[10px] text-lol-text-sub/50">vs</span>
          )}
        </div>

        {/* チーム2 */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className={`text-xs font-bold truncate ${t2Lead ? 'text-lol-accent' : 'text-lol-text'}`}>
            {match.team2_acronym || match.team2_name}
          </span>
          <TeamLogo src={match.team2_image} alt={match.team2_acronym} />
        </div>
      </div>
    </div>
  )
}

export const LiveMatchPanel: FC = () => {
  const { data: matches = [], isLoading } = useQuery({
    queryKey:        ['esports-live'],
    queryFn:         fetchLiveMatches,
    staleTime:       60 * 1000,
    refetchInterval: 60 * 1000,  // 1分ごとに自動更新
  })

  const hasLive = matches.some(m => m.status === 'running')

  return (
    <div className="bg-lol-card border border-lol-border rounded-2xl overflow-hidden w-full lg:w-64 shrink-0 flex flex-col lg:h-full">
      {/* ヘッダー */}
      <div className="border-b border-lol-border bg-[#0a1020] px-3 py-2.5 flex items-center gap-2 shrink-0">
        {hasLive
          ? <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80] animate-pulse shrink-0" />
          : <span className="w-2 h-2 rounded-full bg-lol-text-sub/30 shrink-0" />
        }
        <h3 className="font-display font-bold text-sm text-lol-text">
          {hasLive ? 'LIVE / 直近予定' : '直近の試合予定'}
        </h3>
      </div>

      {/* リスト */}
      <div className="flex-1">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-lol-card border-b border-lol-border/30" />
          ))
        ) : matches.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-lol-text-sub text-xs">試合予定はありません</p>
          </div>
        ) : (
          matches.map(match => (
            <LiveMatchCard key={match.id} match={match} />
          ))
        )}
      </div>
    </div>
  )
}
