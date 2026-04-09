import type { FC } from 'react'

type Size = 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  size?:  Size
  label?: string   // スクリーンリーダー向けラベル
  className?: string
}

const sizeClasses: Record<Size, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-[3px]',
  xl: 'w-16 h-16 border-4',
}

/** LoLゴールドのスピナー */
export const LoadingSpinner: FC<Props> = ({
  size      = 'md',
  label     = '読み込み中...',
  className = '',
}) => (
  <div role="status" aria-label={label} className={`inline-flex flex-col items-center gap-2 ${className}`}>
    <span
      className={[
        'rounded-full border-lol-border border-t-lol-accent animate-spin',
        sizeClasses[size],
      ].join(' ')}
      aria-hidden="true"
    />
    {size === 'xl' && (
      <p className="text-sm text-lol-text-sub animate-pulse">{label}</p>
    )}
  </div>
)

// ----- スケルトンローダー -----

interface SkeletonProps {
  className?: string
}

/** プレースホルダーアニメーション */
export const Skeleton: FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`bg-lol-border/40 rounded animate-pulse-slow ${className}`}
    aria-hidden="true"
  />
)

/** カード全体のスケルトン */
export const CardSkeleton: FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="bg-lol-card border border-lol-border rounded-xl p-4 space-y-3">
    <Skeleton className="h-5 w-2/3" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-1/2' : 'w-full'}`} />
    ))}
  </div>
)
