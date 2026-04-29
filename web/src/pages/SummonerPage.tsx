import { type FC, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { SummonerSearchBar }  from '@/components/summoner/SummonerSearchBar'
import { SummonerProfile, SummonerProfileSkeleton } from '@/components/summoner/SummonerProfile'
import { MatchCard, MatchCardSkeleton } from '@/components/summoner/MatchCard'
import { AdBanner }           from '@/components/ads/AdBanner'
import { useSummonerProfile, useMatchHistory } from '@/hooks/useSummoner'

// エラーカード（共通）
const ErrorCard: FC<{ message: string }> = ({ message }) => (
  <div className="border border-lol-error/30 bg-lol-error/10 rounded-xl p-4">
    <p className="text-lol-error text-sm">⚠️ {message}</p>
  </div>
)

// ゲームモードフィルター定義
const QUEUE_FILTERS = [
  { label: '全て',       queue: undefined },
  { label: 'ランク戦',   queue: 420 },
  { label: 'フレックス', queue: 440 },
  { label: 'ARAM',       queue: 450 },
  { label: 'URF',        queue: 900 },
] as const

type QueueFilter = typeof QUEUE_FILTERS[number]

// マッチ履歴セクション
const MatchHistorySection: FC<{ puuid: string }> = ({ puuid }) => {
  const [activeQueue, setActiveQueue] = useState<QueueFilter>(QUEUE_FILTERS[0])
  const { data, isLoading, isError } = useMatchHistory(puuid, 50, activeQueue.queue)

  return (
    <div>
      {/* ゲームモードタブ */}
      <div className="flex flex-wrap gap-2 mb-4">
        {QUEUE_FILTERS.map((f) => {
          const isActive = activeQueue.label === f.label
          return (
            <button
              key={f.label}
              onClick={() => { if (!isLoading) setActiveQueue(f) }}
              disabled={isLoading && !isActive}
              className={[
                'px-3 py-1 rounded-full text-xs font-display font-bold transition-all duration-200',
                isActive
                  ? 'bg-lol-accent text-lol-bg'
                  : 'bg-lol-card border border-lol-border text-lol-text-body hover:border-lol-accent hover:text-lol-accent',
                isLoading && !isActive ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {f.label}
              {isActive && isLoading && (
                <span className="ml-1 inline-block w-2 h-2 rounded-full bg-current animate-pulse" />
              )}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <ErrorCard message="マッチ履歴の取得に失敗しました。しばらく待ってから再試行してください。" />
      )}

      {!isLoading && !isError && (!data || data.matches.length === 0) && (
        <div className="text-center py-12 text-lol-text-sub">
          このゲームモードのマッチ履歴が見つかりませんでした。
        </div>
      )}

      {!isLoading && !isError && data && data.matches.length > 0 && (
        <>
          <div className="space-y-3">
            {data.matches
              .filter((m) => m.my_stats !== null)
              .map((match) => (
                <MatchCard key={match.info.match_id} match={match} puuid={puuid} />
              ))}
          </div>
          {/* 広告（マッチ履歴末尾） */}
          <AdBanner slot="summoner-bottom" format="horizontal" />
        </>
      )}
    </div>
  )
}

const SummonerPage: FC = () => {
  const { gameName, tagLine } = useParams<{ gameName?: string; tagLine?: string }>()
  const navigate = useNavigate()

  const decodedName = gameName ? decodeURIComponent(gameName) : undefined
  const decodedTag  = tagLine  ? decodeURIComponent(tagLine)  : undefined

  const { data: profile, isLoading, isError, error } = useSummonerProfile(decodedName, decodedTag)

  useEffect(() => {
    if (gameName) {
      document.title = `${decodeURIComponent(gameName)} の戦績 | LoL Stats JP`
    } else {
      document.title = 'サモナー検索 | LoL Stats JP'
    }
    return () => { document.title = 'LoL Stats JP' }
  }, [gameName])

  const handleSearch = (name: string, tag: string) => {
    navigate(`/summoner/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`)
  }

  // 404エラー判定
  const is404 = isError && (error as { status?: number })?.status === 404

  const initialValue =
    decodedName && decodedTag ? `${decodedName}#${decodedTag}` : ''

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* 検索バー（常に上部表示） */}
        <SummonerSearchBar
          onSearch={handleSearch}
          initialValue={initialValue}
          isLoading={isLoading}
        />

        {/* サモナーが指定されていない場合のガイド */}
        {!decodedName && !decodedTag && (
          <div className="text-center py-16 text-lol-text-sub">
            <p className="text-lg mb-2">サモナー名を入力して検索してください</p>
            <p className="text-sm">例: ねこ#JP1</p>
          </div>
        )}

        {/* ローディング中 */}
        {isLoading && decodedName && (
          <SummonerProfileSkeleton />
        )}

        {/* エラー表示 */}
        {isError && (
          <ErrorCard
            message={
              is404
                ? `「${decodedName}#${decodedTag}」が見つかりませんでした。サモナー名とタグを確認してください。`
                : 'データの取得に失敗しました。しばらく待ってから再試行してください。'
            }
          />
        )}

        {/* プロフィール + マッチ履歴 */}
        {profile && !isLoading && (
          <>
            <SummonerProfile profile={profile} />

            <AdBanner slot="summoner-banner" format="horizontal" />

            <div>
              <h2 className="font-display font-bold text-lg text-lol-text mb-3">
                マッチ履歴
              </h2>
              <MatchHistorySection puuid={profile.summoner.puuid} />
            </div>
          </>
        )}
      </div>

      {/* フッター */}
      <footer className="border-t border-lol-border mt-20 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-lol-text-sub space-y-1">
          <p>LoL Stats JP は Riot Games が公認したサービスではありません。</p>
        </div>
      </footer>
    </div>
  )
}

export default SummonerPage
