import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchSummonerProfile, fetchMatchHistory, fetchMatchTimeline } from '@/api/summoner'

// クエリキー定数
export const summonerKeys = {
  all:      ['summoner'] as const,
  profile:  (gameName: string, tagLine: string) =>
    [...summonerKeys.all, 'profile', gameName, tagLine] as const,
  matches:  (puuid: string, count: number, queue?: number) =>
    ['matches', puuid, count, queue] as const,
  timeline: (matchId: string, puuid: string) =>
    ['match-timeline', matchId, puuid] as const,
}

/**
 * サモナープロフィールフック
 * staleTime: 5分（ランク情報は5分キャッシュ）
 */
export function useSummonerProfile(gameName?: string, tagLine?: string) {
  return useQuery({
    queryKey: summonerKeys.profile(gameName ?? '', tagLine ?? ''),
    queryFn:  () => fetchSummonerProfile(gameName!, tagLine!),
    enabled:  Boolean(gameName && tagLine),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    retry: (failureCount, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 404) return false
      return failureCount < 3
    },
  })
}

/**
 * マッチ履歴フック
 * staleTime: 1時間（試合履歴は変わりにくい）
 * queue=undefined: 全モード, 420: ランク戦, 450: ARAM, 900: URF
 */
/**
 * マッチタイムラインフック（クリック時のみ fetch）
 * enabled=false のときはフェッチしない
 */
export function useMatchTimeline(matchId?: string, puuid?: string, enabled = false) {
  return useQuery({
    queryKey: summonerKeys.timeline(matchId ?? '', puuid ?? ''),
    queryFn:  () => fetchMatchTimeline(matchId!, puuid!),
    enabled:  enabled && Boolean(matchId && puuid),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime:    24 * 60 * 60 * 1000,
    retry: false,
  })
}

export function useMatchHistory(puuid?: string, count = 50, queue?: number) {
  return useQuery({
    queryKey: summonerKeys.matches(puuid ?? '', count, queue),
    queryFn:  () => fetchMatchHistory(puuid!, count, queue),
    enabled:  Boolean(puuid),
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    // フィルター切替時に前のデータを維持して画面のガタつきを防ぐ
    placeholderData: keepPreviousData,
    retry: (failureCount, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 404) return false
      return failureCount < 2
    },
  })
}
