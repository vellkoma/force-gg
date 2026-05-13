import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

type Tab = 'login' | 'register'

export function AccountPage(): JSX.Element {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('login')

  // ログインフォーム
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 新規登録フォーム
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [registering, setRegistering] = useState(false)

  // OAuth
  const [oauthLoading, setOauthLoading] = useState<'google' | 'discord' | null>(null)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadStoredAuth(): Promise<void> {
      const [token, storedUsername, premium, storedAvatar] = await Promise.all([
        window.electronAPI.settings.get('auth_access_token'),
        window.electronAPI.settings.get('auth_username'),
        window.electronAPI.settings.get('auth_is_premium', 'false'),
        window.electronAPI.settings.get('auth_avatar'),
      ])
      if (token && storedUsername) {
        setIsLoggedIn(true)
        setUsername(storedUsername)
        setIsPremium(premium === 'true')
        let resolvedAvatar = storedAvatar || null
        // アバターが未保存の場合はサーバーから取得して保存
        if (!storedAvatar) {
          try {
            const meRes = await fetch(`${API_BASE}/api/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (meRes.ok) {
              const me = (await meRes.json()) as { avatar?: string }
              resolvedAvatar = me.avatar ?? null
              if (resolvedAvatar) {
                await window.electronAPI.settings.set('auth_avatar', resolvedAvatar)
              }
            }
          } catch { /* 失敗してもログイン状態は維持 */ }
        }
        setAvatar(resolvedAvatar)
      }
      setLoading(false)
    }
    loadStoredAuth()
  }, [])

  const saveAuthAndUpdateState = useCallback(
    async (data: {
      token: string
      refresh_token?: string
      user?: { name?: string; is_premium?: boolean; avatar?: string }
    }, fallbackName: string) => {
      let isPremiumFromServer = data.user?.is_premium ?? false
      let resolvedUsername = data.user?.name ?? fallbackName
      let resolvedAvatar = data.user?.avatar ?? null
      try {
        const meRes = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        })
        if (meRes.ok) {
          const me = (await meRes.json()) as { is_premium?: boolean; name?: string; avatar?: string }
          isPremiumFromServer = me.is_premium ?? false
          resolvedUsername = me.name ?? resolvedUsername
          resolvedAvatar = me.avatar ?? resolvedAvatar
        }
      } catch {
        // /me 失敗はログインを妨げない
      }
      await Promise.all([
        window.electronAPI.settings.set('auth_access_token', data.token),
        data.refresh_token
          ? window.electronAPI.settings.set('auth_refresh_token', data.refresh_token)
          : Promise.resolve(),
        window.electronAPI.settings.set('auth_username', resolvedUsername),
        window.electronAPI.settings.set('auth_is_premium', String(isPremiumFromServer)),
        window.electronAPI.settings.set('auth_avatar', resolvedAvatar ?? ''),
      ])
      setIsLoggedIn(true)
      setUsername(resolvedUsername)
      setIsPremium(isPremiumFromServer)
      setAvatar(resolvedAvatar)
    },
    []
  )

  const handleOAuthLogin = useCallback(
    async (provider: 'google' | 'discord') => {
      setOauthLoading(provider)
      setError(null)
      try {
        const result =
          provider === 'google'
            ? await window.electronAPI.auth.googleLogin()
            : await window.electronAPI.auth.discordLogin()
        if ('error' in result) {
          setError(result.error)
          return
        }
        const displayName =
          result.user?.name ?? (provider === 'google' ? 'Googleユーザー' : 'Discordユーザー')
        await saveAuthAndUpdateState(result, displayName)
      } catch {
        setError(`${provider === 'google' ? 'Google' : 'Discord'}ログイン中にエラーが発生しました。`)
      } finally {
        setOauthLoading(null)
      }
    },
    [saveAuthAndUpdateState]
  )

  const handleLogin = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setSubmitting(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/auth/login/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (!res.ok) {
          setError('メールアドレスまたはパスワードが正しくありません')
          return
        }
        const data = (await res.json()) as {
          token: string
          refresh_token?: string
          user?: { name?: string; is_premium?: boolean }
        }
        await saveAuthAndUpdateState(data, email)
        setEmail('')
        setPassword('')
      } catch {
        setError('サーバーへの接続に失敗しました。しばらくしてから再試行してください。')
      } finally {
        setSubmitting(false)
      }
    },
    [email, password, saveAuthAndUpdateState]
  )

  const handleRegister = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setError(null)
      if (regPassword !== regConfirm) {
        setError('パスワードが一致しません')
        return
      }
      if (regPassword.length < 8) {
        setError('パスワードは8文字以上で設定してください')
        return
      }
      setRegistering(true)
      try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: regEmail, password: regPassword, name: regName }),
        })
        if (res.status === 409) {
          setError('このメールアドレスはすでに登録されています')
          return
        }
        if (!res.ok) {
          setError('登録に失敗しました。しばらくしてから再試行してください。')
          return
        }
        const data = (await res.json()) as {
          token: string
          refresh_token?: string
          user?: { name?: string; is_premium?: boolean }
        }
        await saveAuthAndUpdateState(data, regName || regEmail)
        setRegName('')
        setRegEmail('')
        setRegPassword('')
        setRegConfirm('')
      } catch {
        setError('サーバーへの接続に失敗しました。しばらくしてから再試行してください。')
      } finally {
        setRegistering(false)
      }
    },
    [regName, regEmail, regPassword, regConfirm, saveAuthAndUpdateState]
  )

  const handleLogout = useCallback(async () => {
    await Promise.all([
      window.electronAPI.settings.set('auth_access_token', ''),
      window.electronAPI.settings.set('auth_refresh_token', ''),
      window.electronAPI.settings.set('auth_username', ''),
      window.electronAPI.settings.set('auth_is_premium', 'false'),
      window.electronAPI.settings.set('auth_avatar', ''),
    ])
    setIsLoggedIn(false)
    setUsername(null)
    setIsPremium(false)
    setAvatar(null)
  }, [])

  const isOAuthBusy = oauthLoading !== null
  const isBusy = isOAuthBusy || submitting || registering

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ←
        </button>
        <h1 className="text-lg font-semibold text-[#c89b3c]">アカウント連携</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c89b3c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isLoggedIn ? (
        /* ─── ログイン済み ─── */
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#1e2a3a] border-2 border-[#c89b3c] overflow-hidden flex items-center justify-center shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt={username ?? 'アバター'}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="text-[#c89b3c] text-xl font-bold uppercase">
                  {(username ?? 'U')[0]}
                </span>
              )}
            </div>
            <div>
              <p className="font-semibold text-white">{username}</p>
              <p className="text-sm text-gray-400">Webアカウントに接続済み</p>
            </div>
          </div>

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
        /* ─── 未ログイン ─── */
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-6">
          <p className="text-sm text-gray-400 mb-5">
            force.gg のアカウントと連携することで、プレミアム機能をデスクトップアプリでも利用できます。
          </p>

          {/* OAuth ボタン */}
          <div className="space-y-2 mb-5">
            <button
              onClick={() => handleOAuthLogin('google')}
              disabled={isBusy}
              className="w-full py-2.5 bg-white hover:bg-gray-100 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-800 font-semibold rounded text-sm transition-colors flex items-center justify-center gap-3"
            >
              {oauthLoading === 'google' ? (
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              {oauthLoading === 'google' ? 'ブラウザで認証中...' : 'Googleでログイン'}
            </button>

            <button
              onClick={() => handleOAuthLogin('discord')}
              disabled={isBusy}
              className="w-full py-2.5 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/40 disabled:opacity-50 disabled:cursor-not-allowed text-[#7289DA] font-semibold rounded text-sm transition-colors flex items-center justify-center gap-3"
            >
              {oauthLoading === 'discord' ? (
                <span className="w-4 h-4 border-2 border-[#7289DA] border-t-transparent rounded-full animate-spin" />
              ) : (
                <DiscordIcon />
              )}
              {oauthLoading === 'discord' ? 'ブラウザで認証中...' : 'Discordでログイン'}
            </button>
          </div>

          {/* 区切り線 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#1e2a3a]" />
            <span className="text-xs text-gray-600">または</span>
            <div className="flex-1 h-px bg-[#1e2a3a]" />
          </div>

          {/* ログイン / 新規登録 タブ */}
          <div className="flex rounded overflow-hidden border border-[#1e2a3a] mb-4">
            <button
              onClick={() => { setTab('login'); setError(null) }}
              className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'bg-[#1e2a3a] text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              ログイン
            </button>
            <button
              onClick={() => { setTab('register'); setError(null) }}
              className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                tab === 'register'
                  ? 'bg-[#1e2a3a] text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              新規登録
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded px-3 py-2 mb-4">
              {error}
            </p>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                disabled={isBusy}
                className="w-full bg-[#1e2a3a] border border-[#2a3a4a] focus:border-[#c89b3c] rounded px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-50"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
                disabled={isBusy}
                className="w-full bg-[#1e2a3a] border border-[#2a3a4a] focus:border-[#c89b3c] rounded px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-2.5 bg-[#c89b3c] hover:bg-[#d4a94a] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded text-sm transition-colors flex items-center justify-center gap-2"
              >
                {submitting && (
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                )}
                {submitting ? 'ログイン中...' : 'メールでログイン'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="名前（サモナー名など）"
                disabled={isBusy}
                className="w-full bg-[#1e2a3a] border border-[#2a3a4a] focus:border-[#c89b3c] rounded px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-50"
              />
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="メールアドレス"
                disabled={isBusy}
                className="w-full bg-[#1e2a3a] border border-[#2a3a4a] focus:border-[#c89b3c] rounded px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-50"
              />
              <input
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="パスワード（8文字以上）"
                disabled={isBusy}
                className="w-full bg-[#1e2a3a] border border-[#2a3a4a] focus:border-[#c89b3c] rounded px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-50"
              />
              <input
                type="password"
                required
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                placeholder="パスワード（確認）"
                disabled={isBusy}
                className="w-full bg-[#1e2a3a] border border-[#2a3a4a] focus:border-[#c89b3c] rounded px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-2.5 bg-[#c89b3c] hover:bg-[#d4a94a] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded text-sm transition-colors flex items-center justify-center gap-2"
              >
                {registering && (
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                )}
                {registering ? '登録中...' : 'アカウントを作成'}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  )
}

function GoogleIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function DiscordIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#7289DA" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}

export default AccountPage
