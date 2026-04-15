import { useMutation } from '@tanstack/react-query'
import { analyzeCoaching } from '@/api/coaching'
import type { CoachingRequest } from '@/api/coaching'

/**
 * AIコーチング分析を実行するミューテーションフック
 */
export function useCoachingMutation() {
  return useMutation({
    mutationFn: (req: CoachingRequest) => analyzeCoaching(req),
  })
}
