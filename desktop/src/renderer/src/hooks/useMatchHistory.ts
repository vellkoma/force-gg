import { useState, useEffect, useCallback, useRef } from 'react'
import type { LcuSummoner } from '../../../types/lcu'
import type { LcuMatchGame } from '../../../preload/index.d'


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
  playerAugment1: number
  playerAugment2: number
  playerAugment3: number
  playerAugment4: number
  individual_position: string
  champ_level: number
  team_id: number
  participant_id: number
  riot_id_game_name: string
  riot_id_tag_line: string
  kda: number
  // バックエンド（Riot Match v5）から来る場合はスネークケース
  player_augment1?: number
  player_augment2?: number
  player_augment3?: number
  player_augment4?: number
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

const ARENA_QUEUES = [1700, 1710]

const QUEUE_LABELS: Record<number, string> = {
  420: 'ランク（ソロ）',
  440: 'フレックス',
  450: 'ARAM',
  400: 'ノーマル',
  900: 'メイヘム',
  1010: 'メイヘム',
  1900: 'メイヘム',
  2400: 'メイヘム',
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

interface SummonerProfile {
  account: { puuid: string; game_name: string; tag_line: string }
  summoner: { puuid: string; profile_icon_id: number; summoner_level: number }
  ranked_stats: unknown[]
}

/** LCU summoner → Riot API PUUID を解決するキャッシュ */
const puuidCache = new Map<string, string>()

async function resolveRiotPuuid(summoner: LcuSummoner): Promise<string> {
  const cacheKey = summoner.displayName
  if (puuidCache.has(cacheKey)) return puuidCache.get(cacheKey)!

  // tagLine が LCU から取れた場合はそのまま使う
  const tag = summoner.tagLine ?? 'JP1'
  const name = summoner.gameName ?? summoner.displayName

  const res = await window.electronAPI.api.request<SummonerProfile>({
    path: `/api/summoner/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
  })
  if (!res.ok || !res.data?.account?.puuid) {
    throw new Error(`サモナー情報の取得に失敗しました (${res.status})`)
  }
  puuidCache.set(cacheKey, res.data.account.puuid)
  return res.data.account.puuid
}

/**
 * LCU ゲームデータを MatchDetail 形式に変換する
 * Riot API が未対応のキュー（queue 2400 等）の試合に使用する
 */
function lcuGameToMatchDetail(
  game: LcuMatchGame,
  lcuPuuid: string,
  riotPuuid: string,
  championMap: Map<number, string>
): MatchDetail {
  const identityMap = new Map(
    game.participantIdentities.map((pi) => [pi.participantId, pi.player])
  )

  const participants: ParticipantStats[] = game.participants.map((p) => {
    const identity = identityMap.get(p.participantId)
    const championName = championMap.get(p.championId) ?? ''
    const s = p.stats
    return {
      puuid: identity?.puuid ?? '',
      champion_name: championName,
      champion_id: p.championId,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      win: s.win,
      total_damage_dealt_to_champions: s.totalDamageDealtToChampions,
      gold_earned: s.goldEarned,
      cs: s.totalMinionsKilled + s.neutralMinionsKilled,
      vision_score: s.visionScore,
      summoner1_id: p.spell1Id,
      summoner2_id: p.spell2Id,
      item0: s.item0,
      item1: s.item1,
      item2: s.item2,
      item3: s.item3,
      item4: s.item4,
      item5: s.item5,
      item6: s.item6,
      playerAugment1: s.playerAugment1 ?? 0,
      playerAugment2: s.playerAugment2 ?? 0,
      playerAugment3: s.playerAugment3 ?? 0,
      playerAugment4: s.playerAugment4 ?? 0,
      individual_position: '',
      champ_level: s.champLevel,
      team_id: p.teamId,
      participant_id: p.participantId,
      riot_id_game_name: identity?.gameName ?? '',
      riot_id_tag_line: identity?.tagLine ?? '',
      kda:
        s.deaths === 0
          ? s.kills + s.assists
          : (s.kills + s.assists) / s.deaths,
    }
  })

  // LCU puuid または riot puuid でマッチング
  const my_stats =
    participants.find((p) => p.puuid === riotPuuid) ??
    participants.find((p) => p.puuid === lcuPuuid) ??
    null

  return {
    info: {
      match_id: `JP1_${game.gameId}`,
      game_duration: game.gameDuration,
      game_mode: game.gameMode,
      queue_id: game.queueId,
      game_end_timestamp: game.gameCreation + game.gameDuration * 1000,
    },
    participants,
    my_stats,
  }
}

export function useMatchHistory(
  summoner: LcuSummoner | null,
  queue?: number,
  championMap: Map<number, string> = new Map()
) {
  const [matches, setMatches] = useState<MatchDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resolvedPuuid = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!summoner) return
    setLoading(true)
    setError(null)
    try {
      // LCU puuid は暗号化済みのため summoner API 経由で Riot PUUID を取得
      if (!resolvedPuuid.current) {
        resolvedPuuid.current = await resolveRiotPuuid(summoner)
      }
      const riotPuuid = resolvedPuuid.current
      const lcuPuuid = summoner.puuid

      // Step 1: バックエンド API（Riot Match v5）を優先取得
      // → playerAugment1-4 が正しいオーグメントIDとして返ってくる
      const params = new URLSearchParams({ count: '30' })
      if (queue) params.set('queue', String(queue))

      let backendMatches: MatchDetail[] = []
      try {
        const data = await apiFetch<MatchListResponse>(`/api/matches/${riotPuuid}?${params}`)
        // バックエンドはスネークケース (player_augment1) → キャメルケースに正規化
        backendMatches = (data.matches ?? []).map((m) => ({
          ...m,
          participants: m.participants.map((p) => ({
            ...p,
            playerAugment1: (p as ParticipantStats & { player_augment1?: number }).player_augment1 ?? p.playerAugment1 ?? 0,
            playerAugment2: (p as ParticipantStats & { player_augment2?: number }).player_augment2 ?? p.playerAugment2 ?? 0,
            playerAugment3: (p as ParticipantStats & { player_augment3?: number }).player_augment3 ?? p.playerAugment3 ?? 0,
            playerAugment4: (p as ParticipantStats & { player_augment4?: number }).player_augment4 ?? p.playerAugment4 ?? 0,
          })),
        }))
      } catch (e) {
        console.warn('[useMatchHistory] バックエンドAPI失敗、LCUのみで続行:', e)
      }

      // Step 2: LCU から全モードのマッチ一覧を取得
      const lcuGames = await window.electronAPI.lcu.getMatchHistory(lcuPuuid)

      // Step 3: バックエンドにない試合をLCUで補完
      const backendGameIds = new Set(
        backendMatches.map((m) => parseInt(m.info.match_id.replace('JP1_', ''), 10))
      )
      const lcuOnlyGames = lcuGames.filter((g) => !backendGameIds.has(g.gameId))

      // Arena試合（1700/1710）はRiot APIが対応しているため、バックエンドで再取得して正しいaugment IDを得る
      const arenaLcuGames = lcuOnlyGames.filter((g) => ARENA_QUEUES.includes(g.queueId))
      const nonArenaLcuGames = lcuOnlyGames.filter((g) => !ARENA_QUEUES.includes(g.queueId))

      let arenaBackendMatches: MatchDetail[] = []
      if (arenaLcuGames.length > 0) {
        try {
          const matchIds = arenaLcuGames.map((g) => `JP1_${g.gameId}`).join(',')
          const data = await apiFetch<MatchListResponse>(`/api/matches/by-ids/${riotPuuid}?ids=${matchIds}`)
          arenaBackendMatches = (data.matches ?? []).map((m) => ({
            ...m,
            participants: m.participants.map((p) => ({
              ...p,
              playerAugment1: (p as ParticipantStats & { player_augment1?: number }).player_augment1 ?? p.playerAugment1 ?? 0,
              playerAugment2: (p as ParticipantStats & { player_augment2?: number }).player_augment2 ?? p.playerAugment2 ?? 0,
              playerAugment3: (p as ParticipantStats & { player_augment3?: number }).player_augment3 ?? p.playerAugment3 ?? 0,
              playerAugment4: (p as ParticipantStats & { player_augment4?: number }).player_augment4 ?? p.playerAugment4 ?? 0,
            })),
          }))
        } catch (e) {
          console.warn('[useMatchHistory] Arena試合のバックエンド取得失敗:', e)
        }
      }

      // Arena以外のLCU専用試合はLCUデータで補完
      const lcuSupplementMatches: MatchDetail[] = await Promise.all(
        nonArenaLcuGames.map(async (lcuGame) => {
          const detail = await window.electronAPI.lcu.getMatchDetail(lcuGame.gameId)
          return lcuGameToMatchDetail(detail ?? lcuGame, lcuPuuid, riotPuuid, championMap)
        })
      )

      // Step 4: マージしてタイムスタンプ降順でソート
      const allMatches = [...backendMatches, ...arenaBackendMatches, ...lcuSupplementMatches]
        .sort((a, b) => b.info.game_end_timestamp - a.info.game_end_timestamp)

      // Step 5: queue フィルター適用
      const filtered = queue
        ? allMatches.filter((m) => m.info.queue_id === queue)
        : allMatches

      setMatches(filtered)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      console.error('[useMatchHistory]', e)
    } finally {
      setLoading(false)
    }
  }, [summoner, queue, championMap])

  // summoner が変わったらキャッシュをリセット
  useEffect(() => {
    resolvedPuuid.current = null
  }, [summoner?.displayName])

  useEffect(() => {
    load()
  }, [load])

  return { matches, loading, error, reload: load }
}
