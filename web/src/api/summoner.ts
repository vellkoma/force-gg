import apiClient from '@/api/client'
import type { SummonerProfile } from '@/types/summoner'
import type { MatchListResponse, MatchTimeline } from '@/types/match'

/**
 * サモナープロフィール（アカウント情報 + ランク情報）を取得する
 * バックエンド: GET /api/summoner/{gameName}/{tagLine}
 */
export const fetchSummonerProfile = async (
  gameName: string,
  tagLine: string,
): Promise<SummonerProfile> => {
  const { data } = await apiClient.get<SummonerProfile>(
    `/api/summoner/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
  )
  return data
}

/**
 * マッチ履歴を取得する
 * バックエンド: GET /api/matches/{puuid}?count=20&queue=420
 * queue=undefined: 全モード, 420: ランク戦, 450: ARAM, 900: URF
 */
export const fetchMatchTimeline = async (
  matchId: string,
  puuid: string,
): Promise<MatchTimeline> => {
  const { data } = await apiClient.get<MatchTimeline>(`/api/matches/${matchId}/timeline`, {
    params: { puuid },
  })
  return data
}

export const fetchMatchHistory = async (
  puuid: string,
  count = 20,
  queue?: number,
): Promise<MatchListResponse> => {
  const { data } = await apiClient.get<MatchListResponse>(`/api/matches/${puuid}`, {
    params: { count, ...(queue !== undefined && { queue }) },
  })
  return data
}
