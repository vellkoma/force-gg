import { useState, useEffect, useCallback } from 'react'


export interface MatchInfo {
  match_id: string
  game_duration: number
  game_mode: string
  queue_id: number
  game_end_timestamp: number
}

export interface ParticipantStats {
  puuid: string
  champion_name: string
  champion_id: number
  kills: number
  deaths: number
  assists: number
  win: boolean
  total_damage_dealt_to_champions: number
  gold_earned: number
  cs: number
  vision_score: number
  summoner1_id: number
  summoner2_id: number
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
  individual_position: string
  champ_level: number
  team_id: number
  participant_id: number
  riot_id_game_name: string
  riot_id_tag_line: string
  kda: number
}

export interface MatchDetail {
  info: MatchInfo
  participants: ParticipantStats[]
  my_stats: ParticipantStats | null
}

export interface MatchListResponse {
  matches: MatchDetail[]
  puuid: string
}

const QUEUE_LABELS: Record<number, string> = {
  420: 'ランク（ソロ）',
  440: 'フレックス',
  450: 'ARAM',
  400: 'ノーマル',
  900: 'URF',
  1700: 'アリーナ',
  1710: 'アリーナ',
}

export function getQueueLabel(queueId: number): string {
  return QUEUE_LABELS[queueId] ?? `キュー ${queueId}`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatTimeAgo(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 60) return `${diffMin}分前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}時間前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD}日前`
  return `${Math.floor(diffD / 30)}ヶ月前`
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = await window.electronAPI.settings.get('auth_access_token')
  const res = await window.electronAPI.api.request<T>({
    path,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const detail = typeof res.error === 'string' ? res.error : JSON.stringify(res.data)
    throw new Error(`HTTP ${res.status} [${path}]${detail ? `\n${detail.slice(0, 150)}` : ''}`)
  }
  return res.data
}

export function useMatchHistory(puuid: string | null, queue?: number) {
  const [matches, setMatches] = useState<MatchDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!puuid) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ count: '20' })
      if (queue) params.set('queue', String(queue))
      const data = await apiFetch<MatchListResponse>(`/api/matches/${puuid}?${params}`)
      setMatches(data.matches ?? [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      console.error('[useMatchHistory]', e)
    } finally {
      setLoading(false)
    }
  }, [puuid, queue])

  useEffect(() => {
    load()
  }, [load])

  return { matches, loading, error, reload: load }
}
