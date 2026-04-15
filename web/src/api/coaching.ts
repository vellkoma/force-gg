import apiClient from '@/api/client'

// --- リクエスト型 ---

export interface RecentStats {
  win_rate: number
  kda: number
  cs_per_min: number
  games_played: number
}

export interface CoachingRequest {
  champion_name: string
  role: string
  recent_stats: RecentStats
  rank: string
}

// --- レスポンス型 ---

export interface CoachingAdvice {
  champion_name: string
  role: string
  summary: string
  strengths: string[]
  improvements: string[]
  tips: string[]
  is_mock: boolean
}

/**
 * AIコーチング分析リクエスト
 * バックエンド: POST /api/coaching/analyze
 */
export const analyzeCoaching = async (req: CoachingRequest): Promise<CoachingAdvice> => {
  const { data } = await apiClient.post<CoachingAdvice>('/api/coaching/analyze', req)
  return data
}
