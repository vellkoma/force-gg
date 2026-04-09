import type { FC } from 'react'
import { Link } from 'react-router-dom'
import type { ChampionListItem, ChampionTag } from '@/types/champion'
import { CHAMPION_TAG_LABELS } from '@/types/champion'

// タグごとの配色（枠線 + テキスト）
const TAG_STYLE: Record<ChampionTag, string> = {
  Fighter:  'border-orange-500/60 text-orange-400',
  Tank:     'border-blue-400/60 text-blue-300',
  Mage:     'border-purple-400/60 text-purple-300',
  Assassin: 'border-red-400/60 text-red-300',
  Support:  'border-green-400/60 text-green-300',
  Marksman: 'border-yellow-400/60 text-yellow-300',
}

interface Props {
  champion: ChampionListItem
}

export const ChampionCard: FC<Props> = ({ champion }) => {
  return (
    <Link
      to={`/champions/${champion.id}`}
      className="group block bg-lol-card border border-lol-border rounded-xl overflow-hidden
                 hover:border-lol-accent hover:shadow-[0_0_12px_rgba(200,155,60,0.35)]
                 transition-all duration-200 focus-visible:outline-none
                 focus-visible:ring-2 focus-visible:ring-lol-accent"
      aria-label={`${champion.name} — ${champion.title}`}
    >
      {/* サムネイル */}
      <div className="relative aspect-square overflow-hidden bg-lol-bg">
        <img
          src={champion.image_url}
          alt={champion.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover object-top
                     group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            const target = e.currentTarget
            target.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champion.id}_0.jpg`
          }}
        />
        {/* ゴールドオーバーレイ（ホバー時） */}
        <div className="absolute inset-0 bg-gradient-to-t from-lol-card via-transparent to-transparent
                        group-hover:from-lol-accent/10 transition-colors duration-200" />
      </div>

      {/* テキスト情報 */}
      <div className="p-3 space-y-1.5">
        <p className="font-display font-bold text-sm text-lol-text leading-tight truncate">
          {champion.name}
        </p>
        <p className="text-xs text-lol-text-sub truncate leading-tight">
          {champion.title}
        </p>

        {/* タグバッジ */}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {champion.tags.map((tag) => (
            <span
              key={tag}
              className={`inline-block border rounded px-1.5 py-0.5 text-[10px] leading-tight
                          font-medium ${TAG_STYLE[tag] ?? 'border-lol-border text-lol-text-sub'}`}
            >
              {CHAMPION_TAG_LABELS[tag] ?? tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
