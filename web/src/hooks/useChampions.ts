import { useQuery } from '@tanstack/react-query'
import { fetchChampions, fetchChampion, fetchAllChampionStats, fetchSingleChampionStats, fetchAvailablePatches, fetchRankQuality, fetchChampionPatchHistory, fetchChampionItemStats } from '@/api/champions'
import type { ChampionListItem } from '@/types/champion'

export const championKeys = {
  all:         ['champions']              as const,
  lists:       () => [...championKeys.all, 'list']     as const,
  detail:      (id: string) => [...championKeys.all, 'detail', id]  as const,
  patches:     (rank: string) => [...championKeys.all, 'patches', rank] as const,
  rankQuality: () => [...championKeys.all, 'rank-quality'] as const,
  statsAll:    (rank: string, patch?: string, pos?: string) => [...championKeys.all, 'stats-all', rank, patch ?? 'latest', pos ?? 'ALL'] as const,
  statsSingle: (id: string, rank: string) => [...championKeys.all, 'stats', id, rank] as const,
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
 * 利用可能なパッチ一覧フック
 */
export function useRankQuality() {
  return useQuery({
    queryKey:  championKeys.rankQuality(),
    queryFn:   fetchRankQuality,
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  })
}

export function useAvailablePatches(rank = 'CHALLENGER') {
  return useQuery({
    queryKey:  championKeys.patches(rank),
    queryFn:   () => fetchAvailablePatches(rank),
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  })
}

/**
 * 全チャンピオンティアリスト統計フック
 * @param rank  ランク帯
 * @param patch パッチ番号（省略時は最新）
 */
export function useAllChampionStats(rank = 'CHALLENGER', patch?: string, position?: string) {
  return useQuery({
    queryKey:  championKeys.statsAll(rank, patch, position),
    queryFn:   () => fetchAllChampionStats(rank, patch, position),
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  })
}

/**
 * チャンピオン単体ポジション別統計フック
 * @param id   チャンピオンID
 * @param rank ランク帯
 */
export function useChampionPositionStats(id: string | undefined, rank = 'PLATINUM_PLUS') {
  return useQuery({
    queryKey:  championKeys.statsSingle(id ?? '', rank),
    queryFn:   () => fetchSingleChampionStats(id!, rank),
    enabled:   Boolean(id),
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  })
}

/**
 * チャンピオンのパッチ別勝率履歴フック
 */
export function useChampionPatchHistory(id: string | undefined, rank = 'CHALLENGER') {
  return useQuery({
    queryKey:  [...championKeys.all, 'patch-history', id ?? '', rank] as const,
    queryFn:   () => fetchChampionPatchHistory(id!, rank),
    enabled:   Boolean(id),
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  })
}

/**
 * チャンピオンのスロット別アイテム統計フック
 */
export function useChampionItemStats(
  id: string | undefined,
  rank = 'CHALLENGER',
  patch?: string,
  position?: string,
) {
  return useQuery({
    queryKey:  [...championKeys.all, 'items', id ?? '', rank, patch ?? 'latest', position ?? 'ALL'] as const,
    queryFn:   () => fetchChampionItemStats(id!, rank, patch, position),
    enabled:   Boolean(id),
    staleTime: 60 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
  })
}
