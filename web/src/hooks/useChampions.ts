import { useQuery } from '@tanstack/react-query'
import { fetchChampions, fetchChampion, fetchChampionStats } from '@/api/champions'
import type { ChampionListItem, ChampionStats2 } from '@/types/champion'

// クエリキー定数（型安全なキャッシュ管理）
export const championKeys = {
  all:        ['champions']              as const,
  lists:      () => [...championKeys.all, 'list']     as const,
  detail:     (id: string) => [...championKeys.all, 'detail', id]  as const,
  stats:      (id: string, params: Pick<ChampionStats2, never>) =>
                [...championKeys.all, 'stats', id, params]         as const,
} as const

/**
 * チャンピオン一覧フック
 * キャッシュTTL: stale 5分 / gc 10分
 * select で champions 配列を直接返す
 */
export function useChampions() {
  return useQuery({
    queryKey:  championKeys.lists(),
    queryFn:   fetchChampions,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    select:    (res) => ({
      champions: res.champions as ChampionListItem[],
      version:   res.version,
      total:     res.total ?? res.champions.length,
    }),
  })
}

/**
 * チャンピオン詳細フック
 * @param id チャンピオンID（例: "Ahri"）
 */
export function useChampion(id: string | undefined) {
  return useQuery({
    queryKey:  championKeys.detail(id ?? ''),
    queryFn:   () => fetchChampion(id!),
    enabled:   Boolean(id),
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
 * チャンピオン統計フック
 * @param id    チャンピオンID
 * @param queue キュータイプ（デフォルト: RANKED_SOLO_5x5）
 * @param tier  ランク帯（デフォルト: ALL）
 */
export function useChampionStats(
  id: string | undefined,
  queue = 'RANKED_SOLO_5x5',
  tier  = 'ALL',
) {
  return useQuery({
    queryKey:  [...championKeys.detail(id ?? ''), 'stats', queue, tier],
    queryFn:   () => fetchChampionStats(id!, { queue, tier }),
    enabled:   Boolean(id),
    staleTime: 60 * 60 * 1000,  // 1時間（統計データは頻繁に変わらない）
    gcTime:    60 * 60 * 1000,
  })
}
