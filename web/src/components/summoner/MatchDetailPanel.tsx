import { type FC, useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import type { MatchDetail, MatchTimeline, ParticipantStats } from '@/types/match'
import { useChampions } from '@/hooks/useChampions'
import { MatchResultTeams } from './MatchResultTeams'

const DDRAGON_BASE = (version: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img`

// 参加者ごとのプロットカラー（participant_id 1〜10）
const PLOT_COLORS: Record<number, string> = {
  1: '#60a5fa',  // 青
  2: '#34d399',  // 緑
  3: '#f97316',  // オレンジ
  4: '#a78bfa',  // 紫
  5: '#2dd4bf',  // シアン
  6: '#f87171',  // 赤
  7: '#facc15',  // 黄
  8: '#e879f9',  // マゼンタ
  9: '#4ade80',  // 薄緑
  10: '#fb923c', // 薄オレンジ
}

// MM:SS フォーマット
function toMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// グラフタブ定義
type ChartTab = 'gold' | 'xp' | 'level'
const CHART_TABS: { key: ChartTab; label: string; color: string }[] = [
  { key: 'gold',  label: 'ゴールド', color: '#c89b3c' },
  { key: 'xp',   label: '経験値',   color: '#a78bfa' },
  { key: 'level', label: 'レベル',   color: '#34d399' },
]

const DATAKEY_MAP: Record<ChartTab, string> = {
  gold:  'total_gold',
  xp:    'xp',
  level: 'level',
}

function yFormatter(tab: ChartTab, v: number): string {
  if (tab === 'level') return `Lv.${v}`
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

// カスタムツールチップ（2カラム: 味方左・敵右）
interface ChartTooltipProps {
  active?:       boolean
  payload?:      Array<{ dataKey?: string | number; value?: unknown }>
  label?:        number | string
  participants:  ParticipantStats[]
  myTeamId:      number
  plotColors:    Record<number, string>
  visibleIds:    Set<number>
  activeTab:     ChartTab
}

const ChartTooltip: FC<ChartTooltipProps> = ({
  active, payload, label,
  participants, myTeamId, plotColors, visibleIds, activeTab,
}) => {
  if (!active || !payload || payload.length === 0) return null

  // dataKey から participant_id → value マッピングを構築
  const pidValueMap: Record<number, number> = {}
  payload.forEach((entry) => {
    const pid = parseInt((entry.dataKey as string).split('_').pop() ?? '0', 10)
    pidValueMap[pid] = entry.value as number
  })

  const allies  = participants.filter((p) => p.team_id === myTeamId && visibleIds.has(p.participant_id))
  const enemies = participants.filter((p) => p.team_id !== myTeamId && visibleIds.has(p.participant_id))

  const renderRow = (p: ParticipantStats, flip: boolean) => {
    const val = pidValueMap[p.participant_id]
    if (val === undefined) return null
    const color = plotColors[p.participant_id] ?? '#94a3b8'
    const label = yFormatter(activeTab, val)
    return (
      <div
        key={p.participant_id}
        className={`flex items-center gap-1 py-0.5 ${flip ? 'flex-row-reverse' : ''}`}
      >
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[10px] text-lol-text-body truncate max-w-[72px]">{p.champion_name}</span>
        <span className="text-[10px] font-bold ml-auto" style={{ color }}>{label}</span>
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#0d1520',
        border: '1px solid #1e2a3a',
        borderRadius: 8,
        padding: '6px 8px',
        fontSize: 11,
        minWidth: 260,
        pointerEvents: 'none',
      }}
    >
      <p className="text-[10px] text-lol-text-sub mb-1 text-center">{toMMSS(label as number)}</p>
      <div className="grid grid-cols-2 gap-x-3 divide-x divide-lol-border/40">
        <div>{allies.map((p) => renderRow(p, false))}</div>
        <div className="pl-3">{enemies.map((p) => renderRow(p, true))}</div>
      </div>
    </div>
  )
}

// アイテムアイコン
const ItemIcon: FC<{ itemId: number; version: string }> = ({ itemId, version }) => (
  <img
    src={`${DDRAGON_BASE(version)}/item/${itemId}.png`}
    alt=""
    className="w-6 h-6 rounded border border-lol-border/50 bg-lol-bg object-cover shrink-0"
    onError={(e) => { e.currentTarget.style.display = 'none' }}
  />
)

interface Props {
  timeline: MatchTimeline
  match:    MatchDetail
  puuid:    string
}

export const MatchDetailPanel: FC<Props> = ({ timeline, match, puuid }) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('gold')
  const [visibleIds, setVisibleIds] = useState<Set<number>>(
    () => new Set(timeline.participant_metas.map((m) => m.participant_id)),
  )

  const { data: champData } = useChampions()
  const version = champData?.version ?? '15.8.1'

  const myStats = match.my_stats

  // 自分のプロットカラーはgoldに固定、他は PLOT_COLORS を使用
  const plotColors = useMemo(() => {
    const colors: Record<number, string> = {}
    // まず全員に PLOT_COLORS を割り当て
    match.participants.forEach((p) => {
      colors[p.participant_id] = PLOT_COLORS[p.participant_id] ?? '#94a3b8'
    })
    // 自分だけゴールド
    if (myStats) colors[myStats.participant_id] = '#c89b3c'
    return colors
  }, [match.participants, myStats])

  const onToggle = (id: number) => {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        // 最低1つは表示する
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // グラフデータ: seconds をキーに全参加者データをフラット化
  const chartData = useMemo(() => {
    return timeline.frames.map((frame) => {
      const row: Record<string, number> = { second: frame.second }
      frame.data.forEach((p) => {
        row[`total_gold_${p.participant_id}`] = p.total_gold
        row[`xp_${p.participant_id}`]         = p.xp
        row[`level_${p.participant_id}`]      = p.level
      })
      return row
    })
  }, [timeline.frames])

  // アイテム購入を second ごとにグルーピング
  const purchasesBySecond = useMemo(() => {
    return timeline.item_purchases.reduce<Record<number, number[]>>((acc, e) => {
      if (!acc[e.second]) acc[e.second] = []
      acc[e.second].push(e.item_id)
      return acc
    }, {})
  }, [timeline.item_purchases])

  const purchaseSeconds = Object.keys(purchasesBySecond).map(Number).sort((a, b) => a - b)

  const tabColor = CHART_TABS.find((t) => t.key === activeTab)?.color ?? '#c89b3c'

  // level グラフのドメイン
  const levelDomain: [number, number] | undefined =
    activeTab === 'level' ? [1, 18] : undefined

  return (
    <div className="border-t border-lol-border bg-lol-bg/60">
      {/* チームリザルト（クリックでプロット切替） */}
      {myStats && (
        <MatchResultTeams
          participants={match.participants}
          myPuuid={puuid}
          myTeamId={myStats.team_id}
          visibleIds={visibleIds}
          plotColors={plotColors}
          onToggle={onToggle}
        />
      )}

      {/* グラフ + アイテム購入履歴 */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex gap-4">

          {/* 左: グラフエリア */}
          <div className="flex-1 min-w-0">
            {/* タブ切り替え */}
            <div className="flex gap-1 mb-3">
              {CHART_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    'px-3 py-1 rounded text-xs font-bold transition-all duration-150',
                    activeTab === tab.key
                      ? 'text-lol-bg'
                      : 'text-lol-text-sub hover:text-lol-text border border-lol-border',
                  ].join(' ')}
                  style={activeTab === tab.key ? { background: tab.color } : {}}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* グラフ */}
            <ResponsiveContainer width="100%" height={200} style={{ overflow: 'visible' }}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis
                  dataKey="second"
                  tickFormatter={(s: number) => s % 300 === 0 ? toMMSS(s) : ''}
                  tick={{ fontSize: 10, fill: '#7a8fa6' }}
                  tickLine={{ stroke: '#3a4a5a', strokeWidth: 1 }}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) =>
                    activeTab === 'level'
                      ? (v % 3 === 0 || v === 1 || v === 18 ? `Lv.${v}` : '')
                      : yFormatter(activeTab, v)
                  }
                  ticks={
                    activeTab === 'level'
                      ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]
                      : undefined
                  }
                  tick={{ fontSize: 10, fill: tabColor }}
                  tickLine={{ stroke: '#3a4a5a', strokeWidth: 1 }}
                  axisLine={false}
                  width={44}
                  domain={levelDomain}
                />
                <Tooltip
                  position={{ y: 8 }}
                  wrapperStyle={{ zIndex: 50 }}
                  content={(props) => (
                    <ChartTooltip
                      active={props.active}
                      payload={props.payload}
                      label={props.label}
                      participants={match.participants}
                      myTeamId={myStats?.team_id ?? 100}
                      plotColors={plotColors}
                      visibleIds={visibleIds}
                      activeTab={activeTab}
                    />
                  )}
                />
                {/* 表示中の参加者ごとにラインを描画 */}
                {Array.from(visibleIds).map((pid) => {
                  const dk = `${DATAKEY_MAP[activeTab]}_${pid}`
                  const color = plotColors[pid] ?? '#94a3b8'
                  const isSelf = pid === myStats?.participant_id
                  return (
                    <Line
                      key={pid}
                      type={activeTab === 'level' ? 'stepAfter' : 'monotone'}
                      dataKey={dk}
                      stroke={color}
                      strokeWidth={isSelf ? 2.5 : 1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: color }}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 右: アイテム購入履歴（縦・MM:SS表示） */}
          {purchaseSeconds.length > 0 && (
            <div className="w-36 shrink-0">
              <p className="text-[10px] font-bold text-lol-text-sub uppercase tracking-wide mb-2">
                アイテム購入
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {purchaseSeconds.map((sec) => (
                  <div key={sec} className="flex items-start gap-1.5">
                    <span className="text-[10px] text-lol-text-sub w-10 text-right shrink-0 pt-0.5 font-mono">
                      {toMMSS(sec)}
                    </span>
                    <div className="flex flex-wrap gap-0.5">
                      {purchasesBySecond[sec].map((itemId, i) => (
                        <ItemIcon key={`${itemId}-${i}`} itemId={itemId} version={version} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
