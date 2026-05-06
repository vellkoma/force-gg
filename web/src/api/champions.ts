import apiClient from './client'
import type { ChampionDetailData, ChampionsResponse, ChampionStatsSummary, PositionStats, PatchWinRate, ItemSlotStats } from '@/types/champion'
import type { BuildRecommendation } from '@/types/build'

/**
 * チャンピオン一覧を取得する
 * バックエンド: GET /api/champions
 */
export const fetchChampions = async (): Promise<ChampionsResponse> => {
  const { data } = await apiClient.get<ChampionsResponse>('/api/champions')
  return data
}

/**
 * チャンピオン詳細を取得する
 * バックエンド: GET /api/champions/:id
 */
export const fetchChampion = async (id: string): Promise<ChampionDetailData> => {
  const { data } = await apiClient.get<ChampionDetailData>(`/api/champions/${id}`)
  return data
}

/**
 * チャンピオンビルド推奨を取得する
 * バックエンド: GET /api/champions/:id/builds
 */
export const fetchChampionBuilds = async (id: string): Promise<BuildRecommendation> => {
  const { data } = await apiClient.get<BuildRecommendation>(`/api/champions/${id}/builds`)
  return data
}

/**
 * 利用可能なパッチ一覧を取得する
 * バックエンド: GET /api/champions/patches?rank=CHALLENGER
 */
export interface RankQuality {
  rank:        string
  total_games: number
  patch:       string
}

export const fetchRankQuality = async (): Promise<RankQuality[]> => {
  const { data } = await apiClient.get<RankQuality[]>('/api/champions/rank-quality')
  return data
}

export const fetchAvailablePatches = async (rank = 'CHALLENGER'): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>('/api/champions/patches', { params: { rank } })
  return data
}

/**
 * 全チャンピオンティアリスト統計を取得する
 * バックエンド: GET /api/champions/stats?rank=CHALLENGER&patch=16.9
 */
export const fetchAllChampionStats = async (rank = 'CHALLENGER', patch?: string, position?: string): Promise<ChampionStatsSummary[]> => {
  const { data } = await apiClient.get<ChampionStatsSummary[]>('/api/champions/stats', { params: { rank, patch, position } })
  return data
}

/**
 * チャンピオン単体のポジション別統計を取得する
 * バックエンド: GET /api/champions/:id/stats?rank=CHALLENGER
 */
export const fetchSingleChampionStats = async (id: string, rank = 'CHALLENGER'): Promise<PositionStats[]> => {
  const { data } = await apiClient.get<PositionStats[]>(`/api/champions/${id}/stats`, { params: { rank } })
  return data
}

/**
 * チャンピオンのパッチ別勝率履歴を取得する
 * バックエンド: GET /api/champions/:id/history?rank=CHALLENGER
 */
export const fetchChampionPatchHistory = async (id: string, rank = 'CHALLENGER'): Promise<PatchWinRate[]> => {
  const { data } = await apiClient.get<PatchWinRate[]>(`/api/champions/${id}/history`, { params: { rank } })
  return data
}

/**
 * チャンピオンのスロット別アイテム統計を取得する
 * バックエンド: GET /api/champions/:id/items?rank=CHALLENGER&patch=...&position=...
 */
export const fetchChampionItemStats = async (
  id: string,
  rank = 'CHALLENGER',
  patch?: string,
  position?: string,
): Promise<ItemSlotStats[]> => {
  const { data } = await apiClient.get<ItemSlotStats[]>(`/api/champions/${id}/items`, {
    params: { rank, patch, position },
  })
  return data
}
