import type { FC } from 'react'

interface Props {
  className?: string
}

export const PremiumBadge: FC<Props> = ({ className = '' }) => (
  <span
    className={[
      'inline-block px-2 py-0.5 text-xs font-bold rounded-full',
      'bg-gradient-to-r from-lol-accent to-yellow-300 text-lol-bg',
      className,
    ].join(' ')}
  >
    PREMIUM
  </span>
)
