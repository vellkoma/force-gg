import type { FC } from 'react'
import type { ChampionListItem } from '@/types/champion'
import { ChampionCard } from './ChampionCard'
import { Skeleton } from '@/components/ui/LoadingSpinner'

// チャンピオンカードのスケルトン
const ChampionCardSkeleton: FC = () => (
  <div className="bg-lol-card border border-lol-border rounded-xl overflow-hidden" aria-hidden="true">
    {/* サムネイル部分 */}
    <Skeleton className="aspect-square w-full rounded-none" />
    {/* テキスト部分 */}
    <div className="p-3 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <div className="flex gap-1 pt-0.5">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  </div>
)

interface Props {
  champions:  ChampionListItem[]
  isLoading:  boolean
  error?:     Error | null
}

export const ChampionGrid: FC<Props> = ({ champions, isLoading, error }) => {
  if (error) {
    return (
      <div className="border border-lol-error/30 bg-lol-error/10 rounded-xl p-6 text-center">
        <p className="text-lol-error text-sm">
          チャンピオンデータの取得に失敗しました。
        </p>
        <p className="text-lol-text-sub text-xs mt-1">
          {error.message ?? 'しばらく経ってから再度お試しください。'}
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        aria-label="チャンピオン一覧 読み込み中"
        aria-busy="true"
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <ChampionCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (champions.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lol-text-sub text-sm">
          条件に一致するチャンピオンが見つかりませんでした。
        </p>
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
      aria-label="チャンピオン一覧"
    >
      {champions.map((champion) => (
        <ChampionCard key={champion.id} champion={champion} />
      ))}
    </div>
  )
}
