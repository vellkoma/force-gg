import apiClient from './client'
import type { Champion, ChampionListItem, ChampionsResponse, ChampionStats2 } from '@/types/champion'

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
export const fetchChampion = async (id: string): Promise<Champion> => {
  const { data } = await apiClient.get<Champion>(`/api/champions/${id}`)
  return data
}

/**
 * チャンピオン統計（勝率・ピック率等）を取得する
 * バックエンド: GET /api/champions/:id/stats?queue=RANKED_SOLO_5x5&tier=GOLD
 */
export const fetchChampionStats = async (
  id: string,
  options?: { queue?: string; tier?: string },
): Promise<ChampionStats2> => {
  const { data } = await apiClient.get<ChampionStats2>(`/api/champions/${id}/stats`, {
    params: {
      queue: options?.queue ?? 'RANKED_SOLO_5x5',
      tier:  options?.tier  ?? 'ALL',
    },
  })
  return data
}
