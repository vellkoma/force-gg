/**
 * アカウント連携ページ
 *
 * デスクトップアプリからWebサービスアカウントにログインする。
 * トークンは settings:get/set 経由でローカルDBに永続化される。
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface AccountPageProps {
  /** ホームに戻るコールバック */
  onBack: () => void
}

export function AccountPage({ onBack }: AccountPageProps): JSX.Element {
  // ---- 認証状態 ----
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)

  // ---- フォーム ----
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // ---- UI状態 ----
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 保存済みトークンを読み込んでログイン状態を復元する
  useEffect(() => {
    async function loadStoredAuth(): Promise<void> {
      const [token, storedUsername, premium] = await Promise.all([
        window.electronAPI.settings.get('auth_access_token'),
        window.electronAPI.settings.get('auth_username'),
        window.electronAPI.settings.get('auth_is_premium', 'false')
      ])
      if (token && storedUsername) {
        setIsLoggedIn(true)
        setUsername(storedUsername)
        setIsPremium(premium === 'true')
      }
      setLoading(false)
    }
    loadStoredAuth()
  }, [])

  // ログイン処理
  const handleLogin = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setSubmitting(true)
      setError(null)

      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email, password })
        })

        if (!res.ok) {
          setError('メールアドレスまたはパスワードが正しくありません')
          return
        }

        const data = (await res.json()) as {
          access_token: string
          refresh_token?: string
          username?: string
        }

        // ログイン後にサーバーからユーザー情報（プレミアム状態）を取得
        let isPremiumFromServer = false
        let resolvedUsername = data.username ?? email
        try {
          const meRes = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${data.access_token}` }
          })
          if (meRes.ok) {
            const me = (await meRes.json()) as { is_premium?: boolean; name?: string }
            isPremiumFromServer = me.is_premium ?? false
            resolvedUsername = me.name ?? resolvedUsername
          }
        } catch {
          // /me 取得失敗はログインを妨げない
        }

        // トークンを永続化
        await Promise.all([
          window.electronAPI.settings.set('auth_access_token', data.access_token),
          data.refresh_token
            ? window.electronAPI.settings.set('auth_refresh_token', data.refresh_token)
            : Promise.resolve(),
          window.electronAPI.settings.set('auth_username', resolvedUsername),
          window.electronAPI.settings.set('auth_is_premium', String(isPremiumFromServer))
        ])

        setIsLoggedIn(true)
        setUsername(resolvedUsername)
        setIsPremium(isPremiumFromServer)
        setEmail('')
        setPassword('')
      } catch {
        setError('サーバーへの接続に失敗しました。しばらくしてから再試行してください。')
      } finally {
        setSubmitting(false)
      }
    },
    [email, password]
  )

  // ログアウト処理
  const handleLogout = useCallback(async () => {
    await Promise.all([
      window.electronAPI.settings.set('auth_access_token', ''),
      window.electronAPI.settings.set('auth_refresh_token', ''),
      window.electronAPI.settings.set('auth_username', ''),
      window.electronAPI.settings.set('auth_is_premium', 'false')
    ])
    setIsLoggedIn(false)
    setUsername(null)
    setIsPremium(false)
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white font-sans">
      {/* ヘッダー */}
      <header className="border-b border-[#1e2a3a] px-6 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          &larr; 戻る
        </button>
        <h1 className="text-lg font-semibold text-[#c89b3c]">アカウント連携</h1>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        {loading ? (
          /* ローディングスピナー */
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c89b3c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isLoggedIn ? (
          /* ---- ログイン済み画面 ---- */
          <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-6 space-y-5">
            <div className="flex items-center gap-4">
              {/* アバタープレースホルダー */}
              <div className="w-14 h-14 rounded-full bg-[#1e2a3a] border-2 border-[#c89b3c] flex items-center justify-center">
                <span className="text-[#c89b3c] text-xl font-bold uppercase">
                  {(username ?? 'U')[0]}
                </span>
              </div>
              <div>
                <p className="font-semibold text-white">{username}</p>
                <p className="text-sm text-gray-400">Webアカウントに接続済み</p>
              </div>
            </div>

            {/* プレミアムバッジ（将来拡張用プレースホルダー） */}
            <div className="flex items-center gap-2">
              {isPremium ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c89b3c] text-black text-xs font-bold">
                  プレミアム会員
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e2a3a] border border-[#2a3a4a] text-gray-400 text-xs">
                  無料プラン
                </span>
              )}
            </div>

            {/* プレミアムアップグレード案内（未登録時のみ） */}
            {!isPremium && (
              <div className="bg-[#1e2a3a] rounded border border-[#2a3a4a] p-4 text-sm text-gray-400">
                <p className="text-[#c89b3c] font-medium mb-1">プレミアム会員 ¥980/月</p>
                <p>AIコーチング・詳細統計など全機能が利用できます。</p>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full py-2 border border-[#1e2a3a] hover:border-red-500 hover:text-red-400 text-gray-400 rounded text-sm font-medium transition-colors"
            >
              ログアウト
            </button>
          </section>
        ) : (
          /* ---- 未ログイン画面 ---- */
          <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-6">
            <h2 className="text-base font-semibold text-white mb-1">Webアカウントにログイン</h2>
            <p className="text-sm text-gray-400 mb-6">
              LoLガイドのWebアカウントと連携することで、プレミアム機能をデスクトップアプリでも利用できます。
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* メールアドレス */}
              <div>
                <label htmlFor="email" className="block text-sm text-gray-400 mb-1.5">
                  メールアドレス
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full bg-[#1e2a3a] border border-[#2a3a4a] focus:border-[#c89b3c] rounded px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
                />
              </div>

              {/* パスワード */}
              <div>
                <label htmlFor="password" className="block text-sm text-gray-400 mb-1.5">
                  パスワード
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#1e2a3a] border border-[#2a3a4a] focus:border-[#c89b3c] rounded px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
                />
              </div>

              {/* エラーメッセージ */}
              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded px-3 py-2">
                  {error}
                </p>
              )}

              {/* ログインボタン */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#c89b3c] hover:bg-[#d4a94a] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded text-sm transition-colors flex items-center justify-center gap-2"
              >
                {submitting && (
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                )}
                {submitting ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}

export default AccountPage
