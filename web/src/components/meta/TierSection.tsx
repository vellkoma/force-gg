import type { FC } from 'react'
import type { ChampionListItem } from '@/types/champion'

type TierKey = 'S' | 'A' | 'B' | 'C'

interface Props {
  tier:      TierKey
  champions: ChampionListItem[]
}

const TIER_STYLES: Record<TierKey, { label: string; color: string; border: string }> = {
  S: { label: 'S', color: 'text-lol-accent',    border: 'border-lol-accent' },
  A: { label: 'A', color: 'text-lol-cyan',      border: 'border-lol-cyan' },
  B: { label: 'B', color: 'text-lol-success',   border: 'border-lol-success' },
  C: { label: 'C', color: 'text-lol-text-sub',  border: 'border-lol-text-sub' },
}

export const TierSection: FC<Props> = ({ tier, champions }) => {
  const style = TIER_STYLES[tier]

  return (
    <div className="flex items-start gap-4">
      {/* ティアラベル */}
      <div
        className={[
          'w-12 h-12 flex-shrink-0 flex items-center justify-center',
          'rounded-lg border-2 font-display font-bold text-2xl',
          style.color,
          style.border,
        ].join(' ')}
      >
        {style.label}
      </div>

      {/* チャンピオンアイコン群 */}
      <div className="flex flex-wrap gap-2 flex-1 min-h-[48px]">
        {champions.length === 0 ? (
          <p className="text-xs text-lol-text-sub self-center">— なし —</p>
        ) : (
          champions.map((champ) => (
            <div key={champ.id} className="relative group">
              <img
                src={champ.image_url}
                alt={champ.name}
                className="w-12 h-12 rounded-lg border border-lol-border group-hover:border-lol-accent transition-colors"
                loading="lazy"
              />
              {/* ホバー時の名前ツールチップ */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-lol-card border border-lol-border rounded text-xs text-lol-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {champ.name}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
