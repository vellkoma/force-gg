import { type FC, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { ChampionStatsSummary, ChampionListItem } from '@/types/champion'
import { TIER_COLORS } from '@/types/champion'

export type TierSortBy = 'win_rate' | 'pick_rate' | 'ban_rate'

interface Props {
  stats:     ChampionStatsSummary[]
  champions: ChampionListItem[]
  sortBy?:   TierSortBy
}

const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const

const TIER_LABEL: Record<string, string> = {
  'T1': 'Tier Ⅰ',
  'T2': 'Tier Ⅱ',
  'T3': 'Tier Ⅲ',
  'T4': 'Tier Ⅳ',
  'T5': 'Tier Ⅴ',
}

// ソートモードごとのティア判定メトリクス
const SORT_METRIC: Record<TierSortBy, keyof ChampionStatsSummary> = {
  win_rate:  'win_rate',
  pick_rate: 'pick_rate',
  ban_rate:  'ban_rate',
}

// パーセンタイルベースでティア割り当て（T1:上位5% / T2:上位20% / T3:上位45% / T4:上位75% / T5:残り）
const TIER_THRESHOLDS: [string, number][] = [
  ['T1', 0.95],
  ['T2', 0.80],
  ['T3', 0.55],
  ['T4', 0.25],
  ['T5', 0.0],
]

function computeTieredGroups(
  items: ChampionStatsSummary[],
  metric: keyof ChampionStatsSummary,
): Record<string, ChampionStatsSummary[]> {
  const g: Record<string, ChampionStatsSummary[]> = {}
  for (const [tier] of TIER_THRESHOLDS) g[tier] = []
  if (!items.length) return g

  const sorted = [...items.map(s => s[metric] as number)].sort((a, b) => a - b)
  const n = sorted.length

  const pct = (v: number) => sorted.filter(x => x <= v).length / n

  for (const s of items) {
    const p = pct(s[metric] as number)
    for (const [tier, threshold] of TIER_THRESHOLDS) {
      if (p >= threshold) { g[tier].push(s); break }
    }
  }

  for (const [tier] of TIER_THRESHOLDS) {
    g[tier].sort((a, b) => a.champion_id.localeCompare(b.champion_id))
  }
  return g
}

const TIER_BG: Record<string, string> = {
  'T1': 'bg-yellow-900/20 border-yellow-600/30',
  'T2': 'bg-yellow-900/10 border-yellow-700/20',
  'T3': 'bg-green-900/10 border-green-700/20',
  'T4': 'bg-blue-900/10 border-blue-700/20',
  'T5': 'bg-slate-800/20 border-slate-600/20',
}

export const TierList: FC<Props> = ({
  stats,
  champions,
  sortBy = 'win_rate',
}) => {
  const champMap = useMemo(() => {
    const m: Record<string, ChampionListItem> = {}
    for (const c of champions) {
      m[c.id]  = c
      m[c.key] = c
    }
    return m
  }, [champions])

  const grouped = useMemo(() => {
    // ポジション絞り込みはバックエンド側で処理済み。stats をそのまま使用。
    return computeTieredGroups(stats, SORT_METRIC[sortBy])
  }, [stats, sortBy])

  const fmt = (v: number) => `${(v * 100).toFixed(1)}%`

  return (
    <div className="space-y-2">
      {TIERS.map((tier) => {
        const list = grouped[tier]
        if (!list?.length) return null
        return (
          <div key={tier} className={`rounded-xl border p-3 ${TIER_BG[tier]}`}>
            <div className="flex gap-3 items-start">
              {/* ティアラベル */}
              <div
                className="shrink-0 w-16 h-10 rounded-lg flex items-center justify-center font-display font-bold text-xs"
                style={{ color: TIER_COLORS[tier], backgroundColor: `${TIER_COLORS[tier]}22` }}
              >
                {TIER_LABEL[tier]}
              </div>

              {/* チャンピオンアイコン群 */}
              <div className="flex flex-wrap gap-1.5">
                {list.map((s) => {
                  const champ = champMap[s.champion_id]
                  const img   = champ?.image_url
                    ?? `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${s.champion_id}_0.jpg`
                  const name  = champ?.name ?? s.champion_id

                  // ソート基準の値をアイコン下に小さく表示
                  const highlight = s[sortBy]

                  return (
                    <Link
                      key={s.champion_id}
                      to={`/champions/${s.champion_id}`}
                      className="relative group flex flex-col items-center gap-0.5"
                    >
                      <img
                        src={img}
                        alt={name}
                        className="w-10 h-10 rounded-lg border border-lol-border object-cover group-hover:border-lol-accent transition-colors"
                      />
                      {/* ソート基準値をアイコン下に表示 */}
                      <span className="text-[9px] text-lol-text-sub leading-none">
                        {fmt(highlight)}
                      </span>

                      {/* ホバーツールチップ */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20 whitespace-nowrap">
                        <div className="bg-lol-bg border border-lol-border rounded-lg px-2.5 py-2 text-[11px] text-left shadow-xl">
                          <p className="font-bold text-lol-text mb-1">{name}</p>
                          <div className="space-y-0.5">
                            <p className={sortBy === 'win_rate'  ? 'text-lol-accent font-bold' : 'text-lol-text-sub'}>
                              勝率 <span className="text-lol-text">{fmt(s.win_rate)}</span>
                            </p>
                            <p className={sortBy === 'pick_rate' ? 'text-lol-accent font-bold' : 'text-lol-text-sub'}>
                              ピック率 <span className="text-lol-text">{fmt(s.pick_rate)}</span>
                            </p>
                            <p className={sortBy === 'ban_rate'  ? 'text-lol-accent font-bold' : 'text-lol-text-sub'}>
                              BAN率 <span className="text-lol-text">{fmt(s.ban_rate)}</span>
                            </p>
                            <p className="text-lol-text-sub pt-0.5 border-t border-lol-border mt-0.5">
                              主ポジ <span className="text-lol-text">{s.best_position}</span>
                            </p>
                            <p className="text-lol-text-sub">
                              試合数 <span className="text-lol-text">{s.games_played.toLocaleString()}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

      {TIERS.every((t) => !grouped[t]?.length) && (
        <p className="text-lol-text-sub text-sm text-center py-10">
          該当するチャンピオンがいません
        </p>
      )}
    </div>
  )
}
