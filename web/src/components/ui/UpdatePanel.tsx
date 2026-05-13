import { useState } from 'react'

type UpdateType = 'feat' | 'fix' | 'ui' | 'infra'

interface UpdateEntry {
  date: string
  type: UpdateType
  title: string
  description: string
}

const TYPE_LABEL: Record<UpdateType, string> = {
  feat: '新機能',
  fix: 'バグ修正',
  ui: 'UI改善',
  infra: 'インフラ',
}

const TYPE_COLOR: Record<UpdateType, string> = {
  feat: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  fix: 'bg-red-500/20 text-red-300 border-red-500/40',
  ui: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  infra: 'bg-green-500/20 text-green-300 border-green-500/40',
}

const UPDATES: UpdateEntry[] = [
  {
    date: '2026-05-14',
    type: 'fix',
    title: 'Google OAuth デスクトップ認証修正',
    description: 'ブラウザのfavicon等リクエストにより認証がキャンセルされる問題を修正。OAuthコールバック以外のリクエストを無視するように対応。',
  },
  {
    date: '2026-05-13',
    type: 'ui',
    title: 'デスクトップアプリ 全画面センタリング対応',
    description: '全画面表示時にコンテンツが左上に寄る問題を修正。全ページに max-w + mx-auto を適用。',
  },
  {
    date: '2026-05-13',
    type: 'feat',
    title: 'Google / Discord ログイン追加（デスクトップ）',
    description: 'デスクトップアプリにGoogle・Discordのソーシャルログインを追加。RFC 8252準拠のループバックサーバー方式で実装。',
  },
  {
    date: '2026-05-12',
    type: 'infra',
    title: 'PostgreSQL 永続化対応',
    description: 'バックエンドの認証データをインメモリDictからPostgreSQL（asyncpg）に移行。Railwayへのデプロイで本番データが永続化。',
  },
  {
    date: '2026-05-12',
    type: 'feat',
    title: 'メールアドレス新規登録 / ログイン実装',
    description: 'デスクトップアプリにメール＋パスワードによるアカウント登録・ログイン機能を追加。',
  },
  {
    date: '2026-05-11',
    type: 'fix',
    title: 'ホーム画面 接続フラッシュ修正',
    description: 'ナビゲーション時に「LoLクライアント未接続」が一瞬表示される問題を修正。LCU状態をContext化して共有。',
  },
  {
    date: '2026-05-10',
    type: 'feat',
    title: '自動アップデート機能実装',
    description: 'UpdateBannerコンポーネントとダウンロード・インストールIPCハンドラーを追加。electron-updaterと連携。',
  },
  {
    date: '2026-05-09',
    type: 'ui',
    title: 'tsconfig エラー解消',
    description: 'tsconfig.node.json / tsconfig.web.json の非推奨警告・パスエラーを修正。ignoreDeprecations追加・未使用パス削除。',
  },
  {
    date: '2026-05-08',
    type: 'feat',
    title: 'デスクトップアプリ Phase 5 強化',
    description: 'マッチ履歴・マッチ詳細・設定画面・AIコーチングページをデスクトップアプリに追加。サイドバーナビ実装。',
  },
  {
    date: '2026-05-07',
    type: 'feat',
    title: 'ティアリスト表記変更',
    description: 'チャンピオンティア表記を S+/S/A/B/C から Tier Ⅰ〜Ⅴ に変更。視認性向上。',
  },
]

export function UpdatePanel() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* トグルタブ */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-[#c89b3c] hover:bg-[#d4a94a] text-black font-bold text-xs px-2 py-4 rounded-l-lg shadow-lg transition-all duration-200 writing-mode-vertical"
        style={{ writingMode: 'vertical-rl', letterSpacing: '0.1em' }}
        title="アップデート情報"
      >
        {isOpen ? '✕ 閉じる' : '📋 更新履歴'}
      </button>

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* サイドパネル */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-50 bg-[#0a0e1a] border-l border-[#1e2a3a] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a3a] shrink-0">
          <div>
            <h2 className="font-bold text-[#c89b3c] text-base">アップデート情報</h2>
            <p className="text-xs text-gray-500 mt-0.5">開発中 — 公開時に非表示</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* 更新リスト */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          {UPDATES.map((entry, i) => (
            <div
              key={i}
              className="bg-[#0f1923] border border-[#1e2a3a] rounded-lg p-3 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${TYPE_COLOR[entry.type]}`}
                >
                  {TYPE_LABEL[entry.type]}
                </span>
                <span className="text-[11px] text-gray-500">{entry.date}</span>
              </div>
              <p className="text-sm font-semibold text-gray-100">{entry.title}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{entry.description}</p>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-[#1e2a3a] shrink-0">
          <p className="text-[11px] text-gray-600 text-center">
            直近 {UPDATES.length} 件の更新を表示
          </p>
        </div>
      </div>
    </>
  )
}
