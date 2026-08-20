import type { FC, ReactNode } from 'react'

/**
 * プライバシーポリシー・利用規約など、法務系ページ共通のレイアウト
 */
interface LegalLayoutProps {
  title:       string
  lastUpdated: string
  children:    ReactNode
}

export const LegalLayout: FC<LegalLayoutProps> = ({ title, lastUpdated, children }) => (
  <main className="max-w-3xl mx-auto px-4 py-12">
    <h1 className="font-display font-bold text-3xl text-lol-text mb-2">{title}</h1>
    <p className="text-lol-text-sub text-xs mb-10">最終更新日: {lastUpdated}</p>

    <div className="space-y-8">{children}</div>
  </main>
)

/** 見出し付きの節 */
export const Section: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="font-display font-bold text-lg text-lol-accent border-b border-lol-border pb-2">
      {title}
    </h2>
    <div className="space-y-3 text-sm text-lol-text-body leading-relaxed">{children}</div>
  </section>
)

/** 箇条書き */
export const List: FC<{ items: ReactNode[] }> = ({ items }) => (
  <ul className="space-y-1.5 pl-1">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2">
        <span className="text-lol-text-sub shrink-0">—</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
)
