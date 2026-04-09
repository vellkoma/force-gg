import type { FC, ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children:   ReactNode
  /** ホバー時にボーダーが光るエフェクト */
  hoverable?: boolean
  /** ゴールドアクセントのボーダー */
  accent?:    boolean
  /** パディングを無効化（画像カードなど） */
  noPadding?: boolean
}

export const Card: FC<CardProps> = ({
  children,
  hoverable = false,
  accent    = false,
  noPadding = false,
  className = '',
  ...rest
}) => {
  return (
    <div
      className={[
        'bg-lol-card rounded-xl transition-all duration-200',
        accent
          ? 'border border-lol-accent/60 shadow-[0_0_12px_rgba(200,155,60,0.15)]'
          : 'border border-lol-border',
        hoverable && 'hover:border-lol-border-hover hover:shadow-lg cursor-pointer',
        noPadding ? '' : 'p-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

// ----- サブコンポーネント -----

interface CardHeaderProps {
  title:     string
  subtitle?: string
  action?:   ReactNode
}

export const CardHeader: FC<CardHeaderProps> = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between mb-4">
    <div>
      <h2 className="font-display text-lg font-bold text-lol-text">{title}</h2>
      {subtitle && (
        <p className="text-sm text-lol-text-sub mt-0.5">{subtitle}</p>
      )}
    </div>
    {action && <div>{action}</div>}
  </div>
)

interface CardDividerProps {
  className?: string
}

export const CardDivider: FC<CardDividerProps> = ({ className = '' }) => (
  <hr className={`border-lol-border my-3 ${className}`} />
)
