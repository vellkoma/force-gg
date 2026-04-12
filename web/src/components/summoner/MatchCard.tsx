import { type FC, useState } from 'react'
import type { MatchDetail } from '@/types/match'
import { QUEUE_LABELS, POSITION_LABELS, formatGameDuration, calcKda } from '@/types/match'
import { Skeleton } from '@/components/ui/LoadingSpinner'
import { useMatchTimeline } from '@/hooks/useSummoner'
import { MatchDetailPanel } from './MatchDetailPanel'

const DDRAGON_VERSION = '15.8.1'
const DDRAGON_BASE    = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img`

// アイテムスロット1つ
const ItemSlot: FC<{ itemId: number }> = ({ itemId }) => {
  if (itemId === 0) {
    return (
      <div className="w-7 h-7 rounded bg-lol-bg border border-lol-border/50 shrink-0" />
    )
  }
  return (
    <img
      src={`${DDRAGON_BASE}/item/${itemId}.png`}
      alt={`アイテム ${itemId}`}
      className="w-7 h-7 rounded border border-lol-border/50 object-cover shrink-0 bg-lol-bg"
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement
        el.style.display = 'none'
      }}
    />
  )
}

// スケルトン
export const MatchCardSkeleton: FC = () => (
  <div className="bg-lol-card border border-lol-border rounded-xl p-4 flex gap-4">
    <Skeleton className="w-14 h-14 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-24" />
    </div>
  </div>
)

interface Props {
  match: MatchDetail
  puuid?: string
}

export const MatchCard: FC<Props> = ({ match, puuid }) => {
  const { info, my_stats } = match
  const [expanded, setExpanded] = useState(false)

  // my_statsがnullの場合は表示しない
  if (!my_stats) return null

  const {
    champion_name, kills, deaths, assists, win,
    cs, vision_score, total_damage_dealt_to_champions,
    item0, item1, item2, item3, item4, item5, item6,
    individual_position,
  } = my_stats

  const kdaStr      = calcKda(kills, deaths, assists)
  const queueLabel  = QUEUE_LABELS[info.queue_id] ?? info.game_mode
  const posLabel    = POSITION_LABELS[individual_position] ?? individual_position
  const duration    = formatGameDuration(info.game_duration)
  const damage      = total_damage_dealt_to_champions.toLocaleString('ja-JP')
  const gold        = my_stats.gold_earned.toLocaleString('ja-JP')
  const gameDate    = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(info.game_end_timestamp))

  const borderColor = win ? 'border-l-lol-success' : 'border-l-lol-error'
  const resultText  = win ? '勝利' : '敗北'
  const resultColor = win ? 'text-lol-success' : 'text-lol-error'

  // タイムラインは展開時のみフェッチ
  const { data: timeline, isLoading: timelineLoading, isError: timelineError } =
    useMatchTimeline(info.match_id, puuid, expanded)

  return (
    <div className={`bg-lol-card border border-lol-border border-l-4 ${borderColor} rounded-xl overflow-hidden transition-colors hover:border-lol-border-hover`}>
      {/* メインカード（クリックで展開） */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex gap-3 focus:outline-none"
        aria-expanded={expanded}
      >
        {/* チャンピオンアイコン */}
        <div className="shrink-0">
          <img
            src={`${DDRAGON_BASE}/champion/${champion_name}.png`}
            alt={champion_name}
            className="w-14 h-14 rounded-full border-2 border-lol-border object-cover bg-lol-bg"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).alt = champion_name
            }}
          />
        </div>

        {/* メイン情報 */}
        <div className="flex-1 min-w-0">
          {/* 1行目: 結果・キュー・時間・日時 */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`font-bold text-sm font-display ${resultColor}`}>{resultText}</span>
            <span className="text-lol-text-sub text-xs">{queueLabel}</span>
            <span className="text-lol-text-sub text-xs">{posLabel}</span>
            <span className="text-lol-text-sub text-xs">{duration}</span>
            <span className="text-lol-text-sub text-xs ml-auto">{gameDate}</span>
          </div>

          {/* 2行目: KDA */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lol-text font-bold font-display text-base">
              {kills} / <span className="text-lol-error">{deaths}</span> / {assists}
            </span>
            <span className="text-lol-text-sub text-xs">
              KDA <span className="text-lol-text-body font-semibold">{kdaStr}</span>
            </span>
          </div>

          {/* 3行目: CS / ビジョン / ダメージ / ゴールド */}
          <div className="flex items-center gap-3 flex-wrap mb-2 text-xs text-lol-text-sub">
            <span>CS <span className="text-lol-text-body">{cs}</span></span>
            <span>ビジョン <span className="text-lol-text-body">{vision_score}</span></span>
            <span>ダメージ <span className="text-lol-text-body">{damage}</span></span>
            <span>ゴールド <span className="text-lol-text-body">{gold}</span></span>
          </div>

          {/* 4行目: アイテム7スロット + 展開アイコン */}
          <div className="flex items-center gap-1 flex-wrap">
            <ItemSlot itemId={item0} />
            <ItemSlot itemId={item1} />
            <ItemSlot itemId={item2} />
            <ItemSlot itemId={item3} />
            <ItemSlot itemId={item4} />
            <ItemSlot itemId={item5} />
            <span className="w-1" />
            <ItemSlot itemId={item6} />
            <span className="ml-auto text-lol-text-sub text-xs">
              {expanded ? '▲ 閉じる' : '▼ 詳細'}
            </span>
          </div>
        </div>
      </button>

      {/* 詳細パネル */}
      {expanded && (
        <>
          {timelineLoading && (
            <div className="border-t border-lol-border px-4 py-6 text-center text-xs text-lol-text-sub animate-pulse">
              タイムラインを読み込み中...
            </div>
          )}
          {timelineError && (
            <div className="border-t border-lol-border px-4 py-4 text-center text-xs text-lol-error">
              タイムラインの取得に失敗しました
            </div>
          )}
          {timeline && (
            <MatchDetailPanel timeline={timeline} match={match} puuid={puuid ?? ''} />
          )}
        </>
      )}
    </div>
  )
}
