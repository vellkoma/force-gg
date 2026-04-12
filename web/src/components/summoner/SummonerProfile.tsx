import type { FC } from 'react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/LoadingSpinner'
import { useChampions } from '@/hooks/useChampions'
import type { SummonerProfile as SummonerProfileType, RankedEntry } from '@/types/summoner'
import {
  TIER_LABELS,
  QUEUE_TYPE_LABELS,
  RANK_COLOR_CLASSES,
} from '@/types/summoner'

const PROFILE_ICON_BASE = (version: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon`

// ランクエンブレムアイコン（Community Dragon 経由でRiot公式アセットを取得）
const RANKED_EMBLEM_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests'

const RankedEmblem: FC<{ tier: string }> = ({ tier }) => {
  const src = `${RANKED_EMBLEM_BASE}/${tier.toLowerCase()}.png`
  return (
    <img
      src={src}
      alt={tier}
      className="w-12 h-12 object-contain shrink-0"
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
}

// ランクカードの1件
const RankedCard: FC<{ entry: RankedEntry }> = ({ entry }) => {
  const winRate   = entry.win_rate != null
    ? Math.round(entry.win_rate * 100)
    : Math.round((entry.wins / Math.max(entry.wins + entry.losses, 1)) * 100)
  const colorCls  = RANK_COLOR_CLASSES[entry.tier] ?? 'text-lol-text'
  const queueLabel = QUEUE_TYPE_LABELS[entry.queue_type] ?? entry.queue_type

  return (
    <div className="flex items-center gap-3 p-3 bg-lol-bg/50 rounded-lg border border-lol-border">
      <RankedEmblem tier={entry.tier} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-lol-text-sub mb-0.5">{queueLabel}</p>
        <p className={`text-sm font-bold font-display ${colorCls}`}>
          {TIER_LABELS[entry.tier] ?? entry.tier} {entry.rank}
        </p>
        <p className={`text-xs font-bold ${colorCls}`}>
          {entry.league_points} LP
        </p>
      </div>
      <div className="text-right text-xs shrink-0">
        <p className="text-lol-text-body">
          {entry.wins}W {entry.losses}L
        </p>
        <p className="text-lol-text-sub">
          勝率 {winRate}%
        </p>
      </div>
    </div>
  )
}

// スケルトン表示
export const SummonerProfileSkeleton: FC = () => (
  <div className="bg-lol-card border border-lol-border rounded-xl p-6 space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton className="w-20 h-20 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
    <Skeleton className="h-16 w-full" />
    <Skeleton className="h-16 w-full" />
  </div>
)

interface Props {
  profile:    SummonerProfileType
  isLoading?: boolean
}

export const SummonerProfile: FC<Props> = ({ profile, isLoading = false }) => {
  if (isLoading) return <SummonerProfileSkeleton />

  const { account, summoner, ranked_stats } = profile

  // Data Dragon の最新バージョンを取得（キャッシュ済みなので追加リクエストなし）
  const { data: champData } = useChampions()
  const version = champData?.version ?? '15.8.1'
  const iconUrl = `${PROFILE_ICON_BASE(version)}/${summoner.profile_icon_id}.png`

  const soloEntry = ranked_stats.find((e) => e.queue_type === 'RANKED_SOLO_5x5')
  const flexEntry = ranked_stats.find((e) => e.queue_type === 'RANKED_FLEX_SR')

  return (
    <Card className="p-6">
      {/* プロフィールヘッダー */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative shrink-0">
          <img
            src={iconUrl}
            alt={`${account.game_name}のプロフィールアイコン`}
            className="w-20 h-20 rounded-full border-2 border-lol-accent object-cover bg-lol-bg"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `${PROFILE_ICON_BASE(version)}/29.png`
            }}
          />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-lol-bg border border-lol-border text-lol-text-sub text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
            Lv.{summoner.summoner_level.toLocaleString('ja-JP')}
          </span>
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-lol-text leading-tight">
            {account.game_name}
            <span className="text-lol-text-sub text-base font-normal ml-1">
              #{account.tag_line}
            </span>
          </h1>
        </div>
      </div>

      {/* ランク情報 */}
      <div className="space-y-2">
        {soloEntry ? (
          <RankedCard entry={soloEntry} />
        ) : (
          <div className="p-3 bg-lol-bg/50 rounded-lg border border-lol-border text-center">
            <p className="text-xs text-lol-text-sub">ソロ/デュオ — ランクなし</p>
          </div>
        )}
        {flexEntry ? (
          <RankedCard entry={flexEntry} />
        ) : (
          <div className="p-3 bg-lol-bg/50 rounded-lg border border-lol-border text-center">
            <p className="text-xs text-lol-text-sub">フレックス — ランクなし</p>
          </div>
        )}
      </div>
    </Card>
  )
}
