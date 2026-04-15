import type { FC } from 'react'
import type { CoachingAdvice } from '@/api/coaching'

interface Props {
  advice: CoachingAdvice
}

export const CoachingPanel: FC<Props> = ({ advice }) => {
  return (
    <div className="space-y-4">
      {/* モックデータ警告バナー */}
      {advice.is_mock && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
          <p className="text-yellow-400 text-sm">
            ※ AI APIキー未設定のためサンプルデータを表示中
          </p>
        </div>
      )}

      {/* ヘッダー情報 */}
      <div className="flex items-center gap-3 pb-2 border-b border-lol-border">
        <div>
          <span className="text-lol-gold font-display font-bold text-lg">
            {advice.champion_name}
          </span>
          <span className="text-lol-text-sub text-sm ml-2">— {advice.role}</span>
        </div>
      </div>

      {/* 総評 */}
      <div className="bg-lol-bg rounded-lg p-4 border border-lol-border">
        <h3 className="text-xs font-bold text-lol-text-sub uppercase tracking-wider mb-2">
          総評
        </h3>
        <p className="text-lol-gold font-semibold leading-relaxed">{advice.summary}</p>
      </div>

      {/* 強み */}
      <div className="bg-lol-card rounded-lg p-4 border border-lol-border">
        <h3 className="text-xs font-bold text-lol-text-sub uppercase tracking-wider mb-3">
          強み
        </h3>
        <ul className="space-y-2">
          {advice.strengths.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5 shrink-0">✓</span>
              <span className="text-lol-text text-sm">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 改善点 */}
      <div className="bg-lol-card rounded-lg p-4 border border-lol-border">
        <h3 className="text-xs font-bold text-lol-text-sub uppercase tracking-wider mb-3">
          改善点
        </h3>
        <ul className="space-y-2">
          {advice.improvements.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5 shrink-0">⚠</span>
              <span className="text-lol-text text-sm">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* アドバイス */}
      <div className="bg-lol-card rounded-lg p-4 border border-lol-border">
        <h3 className="text-xs font-bold text-lol-text-sub uppercase tracking-wider mb-3">
          アドバイス
        </h3>
        <ol className="space-y-2">
          {advice.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-lol-gold font-display font-bold text-sm shrink-0 w-5 text-right">
                {i + 1}.
              </span>
              <span className="text-lol-text text-sm">{tip}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
