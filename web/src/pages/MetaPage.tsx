import type { FC } from 'react'
import { useMemo } from 'react'
import { useChampions } from '@/hooks/useChampions'
import type { ChampionListItem, ChampionTag } from '@/types/champion'
import { Card } from '@/components/ui/Card'
import { RoleDistributionChart } from '@/components/meta/RoleDistributionChart'
import { AdBanner } from '@/components/ads/AdBanner'

// ロール定義
type Role = '全て' | 'トップ' | 'ジャングル' | 'ミッド' | 'ボット' | 'サポート'

const ROLE_TAGS: Record<Role, ChampionTag[]> = {
  全て:     [],
  トップ:   ['Fighter', 'Tank'],
  ジャングル: ['Fighter', 'Tank', 'Assassin'],
  ミッド:   ['Mage', 'Assassin'],
  ボット:   ['Marksman'],
  サポート: ['Support'],
}

// ロールフィルター
function filterByRole(champions: ChampionListItem[], role: Role): ChampionListItem[] {
  if (role === '全て') return champions
  const required = ROLE_TAGS[role]
  return champions.filter((c) => c.tags.some((t) => required.includes(t)))
}

const ROLE_LABEL_SHORT: Record<Role, string> = {
  全て:     '全て',
  トップ:   'Top',
  ジャングル: 'JG',
  ミッド:   'Mid',
  ボット:   'Bot',
  サポート: 'Sup',
}

const MetaPage: FC = () => {
  const { data, isLoading, isError } = useChampions()

  // ロール別チャンピオン数（グラフ用）
  const chartData = useMemo(
    () =>
      (['トップ', 'ジャングル', 'ミッド', 'ボット', 'サポート'] as Role[]).map((role) => ({
        role:  ROLE_LABEL_SHORT[role],
        count: filterByRole(data?.champions ?? [], role).length,
      })),
    [data],
  )

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* ページタイトル */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-lol-text mb-1">メタ分析</h1>
          {data?.version && (
            <p className="text-sm text-lol-text-sub">パッチ {data.version}</p>
          )}
          <p className="mt-2 text-xs text-lol-text-sub bg-lol-card border border-lol-border rounded-lg px-3 py-2 inline-block">
            ティアリストはランクデータ収集後に公開予定です。
          </p>
        </div>

        {/* ローディング・エラー */}
        {isLoading && (
          <div className="flex flex-col gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-lol-card border border-lol-border rounded-xl animate-pulse" />
            ))}
          </div>
        )}
        {isError && (
          <div className="border border-lol-error/30 bg-lol-error/10 rounded-xl p-4">
            <p className="text-lol-error text-sm">チャンピオンデータの取得に失敗しました。</p>
          </div>
        )}

        {/* 広告（コンテンツ上） */}
        <AdBanner slot="meta-top" format="horizontal" />

        {/* ロール別分布グラフ */}
        {!isLoading && !isError && (
          <Card>
            <h2 className="font-display font-bold text-lg text-lol-text mb-4">
              ロール別チャンピオン分布
            </h2>
            <RoleDistributionChart data={chartData} />
          </Card>
        )}
      </div>

      {/* フッター */}
      <footer className="border-t border-lol-border mt-20 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-lol-text-sub space-y-1">
          <p>LoL Stats JP は Riot Games が公認したサービスではありません。</p>
        </div>
      </footer>
    </div>
  )
}

export default MetaPage
