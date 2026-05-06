import type { FC } from 'react'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useChampionPatchHistory, useChampionItemStats, useAvailablePatches } from '@/hooks/useChampions'
import { formatPatch } from '@/utils/patch'
import type { ChampionListItem } from '@/types/champion'

interface ChampionAnalysisPanelProps {
  championId:     string
  champions:      ChampionListItem[]
  ddragonVersion: string
}

const RANK_OPTIONS = [
  { value: 'CHALLENGER',  label: 'チャレンジャー' },
  { value: 'GRANDMASTER', label: 'グランドマスター' },
  { value: 'MASTER',      label: 'マスター' },
  { value: 'DIAMOND',     label: 'ダイヤモンド' },
  { value: 'EMERALD',     label: 'エメラルド' },
  { value: 'PLATINUM',    label: 'プラチナ' },
  { value: 'GOLD',        label: 'ゴールド' },
  { value: 'SILVER',      label: 'シルバー' },
  { value: 'BRONZE',      label: 'ブロンズ' },
  { value: 'IRON',        label: 'アイアン' },
]

const POSITION_OPTIONS = [
  { value: 'ALL',     label: '全て' },
  { value: 'TOP',     label: 'TOP' },
  { value: 'JUNGLE',  label: 'JG' },
  { value: 'MID',     label: 'MID' },
  { value: 'ADC',     label: 'ADC' },
  { value: 'SUPPORT', label: 'SUP' },
]

const selectClass =
  'bg-[#0d1117] border border-[#1e2d3d] rounded-lg px-3 py-1.5 text-xs text-lol-text focus:outline-none focus:border-lol-accent cursor-pointer'

export const ChampionAnalysisPanel: FC<ChampionAnalysisPanelProps> = ({
  championId,
  champions,
  ddragonVersion,
}) => {
  const [rank, setRank]             = useState('CHALLENGER')
  const [position, setPosition]     = useState('ALL')
  const [selectedPatch, setSelectedPatch] = useState<string | undefined>(undefined)

  const champion = champions.find((c) => c.id === championId)
  const { data: patches = [] }    = useAvailablePatches(rank)
  const { data: history = [] }    = useChampionPatchHistory(championId, rank)
  const { data: itemSlots = [] }  = useChampionItemStats(
    championId,
    rank,
    selectedPatch,
    position === 'ALL' ? undefined : position,
  )

  const tileUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${championId}_0.jpg`

  // DDragonアイテムデータ取得（depth で完成アイテムを判別）
  const { data: ddragonItems } = useQuery<Record<string, { depth?: number }>>({
    queryKey: ['ddragon-items', ddragonVersion],
    queryFn: async () => {
      const res = await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/item.json`
      )
      const json: { data: Record<string, { depth?: number }> } = await res.json()
      return json.data
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  })

  // 非スタートアイテムID（Doran系、ポーション、トリンケット）
  const STARTER_IDS = new Set([1055, 1056, 1054, 2003, 2031, 2033, 3340, 3364, 3363])

  // 完成アイテム判定: depth >= 3（DDragonでの完成品の定義）、データ未ロードは除外しない
  const isCompletedItem = (itemId: number): boolean => {
    if (STARTER_IDS.has(itemId)) return false
    if (!ddragonItems) return true
    const d = ddragonItems[String(itemId)]
    return d != null && (d.depth ?? 1) >= 3
  }

  const SLOT_LABELS = ['1番目', '2番目', '3番目', '4番目', '5番目', '6番目']

  // スロット別・完成アイテムのみ
  const coreSlots = useMemo(() =>
    itemSlots.slice(0, 6).map((slot) => ({
      ...slot,
      items: slot.items.filter((item) => item.item_id > 0 && isCompletedItem(item.item_id)),
    })).filter((slot) => slot.items.length > 0)
  , [itemSlots, ddragonItems])

  const chartData = [...history]
    .sort((a, b) => a.patch.localeCompare(b.patch))
    .map((d) => ({
      patch:    formatPatch(d.patch),
      win_rate: Math.round(d.win_rate * 1000) / 10,  // 0.523 → 52.3
      games:    d.games_played,
    }))

  return (
    <div className="space-y-4 pb-6">
      {/* ヘッダー: チャンピオン情報 */}
      <div className="flex items-center gap-4 bg-[#111827] border border-[#1e2d3d] rounded-xl p-4">
        <img
          src={tileUrl}
          alt={champion?.name ?? championId}
          className="w-16 h-16 rounded-lg object-cover shrink-0"
          onError={(e) => {
            if (champion?.image_url) {
              (e.currentTarget as HTMLImageElement).src = champion.image_url
            }
          }}
        />
        <div>
          <h2 className="text-lg font-bold text-lol-text font-display">
            {champion?.name ?? championId}
          </h2>
          {champion?.title && (
            <p className="text-xs text-lol-text-sub mt-0.5">{champion.title}</p>
          )}
        </div>

        {/* コントロールバー */}
        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
          <select value={rank} onChange={(e) => setRank(e.target.value)} className={selectClass}>
            {RANK_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className={selectClass}>
            {POSITION_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={selectedPatch ?? ''}
            onChange={(e) => setSelectedPatch(e.target.value || undefined)}
            className={selectClass}
          >
            <option value="">最新パッチ</option>
            {patches.map((p) => (
              <option key={p} value={p}>{formatPatch(p)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* パッチ別勝率グラフ */}
      <div className="bg-[#111827] border border-[#1e2d3d] rounded-xl p-4">
        <h3 className="text-sm font-bold text-lol-text mb-3">パッチ別勝率</h3>
        {chartData.length === 0 ? (
          <p className="text-lol-text-sub text-xs text-center py-8">
            データが取得できていません（update.pyを実行してください）
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="patch"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[
                  (min: number) => Math.min(min - 1, 48),
                  (max: number) => Math.max(max + 1, 52),
                ]}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v}%`, '勝率']}
              />
              <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="win_rate"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ fill: '#60a5fa', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* よく購入されるアイテム（スロット別） */}
      <div className="bg-[#111827] border border-[#1e2d3d] rounded-xl p-4">
        <h3 className="text-sm font-bold text-lol-text mb-3">人気コアアイテム</h3>
        {coreSlots.length === 0 ? (
          <p className="text-lol-text-sub text-xs text-center py-8">
            アイテムデータがありません（update.pyを実行してください）
          </p>
        ) : (
          <div className="space-y-3">
            {coreSlots.map((slot) => (
              <div key={slot.slot} className="flex items-center gap-3">
                <span className="text-xs text-lol-text-sub w-12 shrink-0">
                  {SLOT_LABELS[slot.slot] ?? `${slot.slot + 1}番目`}
                </span>
                <div className="flex gap-3">
                  {slot.items.slice(0, 3).map((item) => (
                    <div key={item.item_id} className="flex flex-col items-center gap-1">
                      <img
                        src={`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${item.item_id}.png`}
                        alt={String(item.item_id)}
                        className="w-10 h-10 rounded border border-[#1e2d3d] object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                      <span className="text-[10px] text-lol-text-sub">
                        {(item.pick_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
