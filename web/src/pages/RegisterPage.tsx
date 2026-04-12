import { useState, useEffect, type FC, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerWithEmail, getGoogleAuthUrl, getDiscordAuthUrl } from '@/api/auth'
import { useAuth } from '@/contexts/AuthContext'

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirm?: string
}

const RegisterPage: FC = () => {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [apiError, setApiError]     = useState<string | null>(null)
  const [isLoading, setIsLoading]   = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'discord' | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // バリデーション
  const validate = (): boolean => {
    const errors: FormErrors = {}

    if (!name.trim()) {
      errors.name = '名前を入力してください。'
    } else if (name.trim().length < 2) {
      errors.name = '名前は2文字以上で入力してください。'
    }

    if (!email) {
      errors.email = 'メールアドレスを入力してください。'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = '有効なメールアドレスを入力してください。'
    }

    if (!password) {
      errors.password = 'パスワードを入力してください。'
    } else if (password.length < 8) {
      errors.password = 'パスワードは8文字以上で設定してください。'
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password = 'パスワードには英字と数字を含めてください。'
    }

    if (!confirm) {
      errors.confirm = 'パスワード（確認）を入力してください。'
    } else if (password !== confirm) {
      errors.confirm = 'パスワードが一致しません。'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setApiError(null)
    setIsLoading(true)
    try {
      const { token, user } = await registerWithEmail(email, password, name.trim())
      login(token, user)
      navigate('/', { replace: true })
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status
      if (status === 409) {
        setApiError('このメールアドレスはすでに登録されています。')
      } else {
        setApiError('アカウント登録に失敗しました。しばらくしてから再度お試しください。')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setOauthLoading('google')
    setApiError(null)
    try {
      const { url } = await getGoogleAuthUrl()
      window.location.href = url
    } catch {
      setApiError('Googleログイン用のURLの取得に失敗しました。')
      setOauthLoading(null)
    }
  }

  const handleDiscordLogin = async () => {
    setOauthLoading('discord')
    setApiError(null)
    try {
      const { url } = await getDiscordAuthUrl()
      window.location.href = url
    } catch {
      setApiError('Discordログイン用のURLの取得に失敗しました。')
      setOauthLoading(null)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#070B14] px-4 py-8">
      {/* 背景グラデーション */}
      <div
        className="absolute inset-0 opacity-20 bg-gradient-to-br from-[#C89B3C]/20 via-transparent to-[#00C6FF]/20 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        {/* ロゴ・タイトル */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <h1 className="text-3xl font-bold text-[#C89B3C] tracking-wider font-display">
              LoLガイド
            </h1>
          </Link>
          <p className="text-[#6B7A99] text-sm">日本語LoLプレイヤー向けWebアプリ</p>
        </div>

        {/* カード */}
        <div className="bg-[#0D1626] border border-[#1E2A40] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-[#E0E6F0] mb-6 text-center">新規登録</h2>

          {/* APIエラー */}
          {apiError && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">⚠ {apiError}</p>
            </div>
          )}

          {/* OAuthボタン */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#EA4335]/10 border border-[#EA4335]/40 text-[#EA4335] font-bold rounded-xl hover:bg-[#EA4335]/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'google' ? (
                <span className="w-5 h-5 border-2 border-[#EA4335] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              ) : (
                <GoogleIcon />
              )}
              Googleで登録
            </button>

            <button
              type="button"
              onClick={handleDiscordLogin}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#5865F2]/10 border border-[#5865F2]/40 text-[#7289DA] font-bold rounded-xl hover:bg-[#5865F2]/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'discord' ? (
                <span className="w-5 h-5 border-2 border-[#7289DA] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              ) : (
                <DiscordIcon />
              )}
              Discordで登録
            </button>
          </div>

          {/* セパレーター */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[#1E2A40]" />
            <span className="text-xs text-[#6B7A99]">または</span>
            <div className="flex-1 h-px bg-[#1E2A40]" />
          </div>

          {/* 登録フォーム */}
          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            {/* 名前 */}
            <div>
              <label htmlFor="name" className="block text-sm text-[#C8D8F0] mb-1.5">
                名前
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="サモナー名など"
                autoComplete="name"
                className={`w-full bg-[#111827] border text-[#E0E6F0] placeholder-[#6B7A99] rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors ${
                  formErrors.name ? 'border-red-500/60' : 'border-[#1E2A40] focus:border-[#00C6FF]'
                }`}
              />
              {formErrors.name && (
                <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>
              )}
            </div>

            {/* メールアドレス */}
            <div>
              <label htmlFor="email" className="block text-sm text-[#C8D8F0] mb-1.5">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                className={`w-full bg-[#111827] border text-[#E0E6F0] placeholder-[#6B7A99] rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors ${
                  formErrors.email ? 'border-red-500/60' : 'border-[#1E2A40] focus:border-[#00C6FF]'
                }`}
              />
              {formErrors.email && (
                <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>
              )}
            </div>

            {/* パスワード */}
            <div>
              <label htmlFor="password" className="block text-sm text-[#C8D8F0] mb-1.5">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上（英字と数字を含む）"
                autoComplete="new-password"
                className={`w-full bg-[#111827] border text-[#E0E6F0] placeholder-[#6B7A99] rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors ${
                  formErrors.password ? 'border-red-500/60' : 'border-[#1E2A40] focus:border-[#00C6FF]'
                }`}
              />
              {formErrors.password && (
                <p className="text-red-400 text-xs mt-1">{formErrors.password}</p>
              )}
            </div>

            {/* パスワード確認 */}
            <div>
              <label htmlFor="confirm" className="block text-sm text-[#C8D8F0] mb-1.5">
                パスワード（確認）
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="パスワードを再入力"
                autoComplete="new-password"
                className={`w-full bg-[#111827] border text-[#E0E6F0] placeholder-[#6B7A99] rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors ${
                  formErrors.confirm ? 'border-red-500/60' : 'border-[#1E2A40] focus:border-[#00C6FF]'
                }`}
              />
              {formErrors.confirm && (
                <p className="text-red-400 text-xs mt-1">{formErrors.confirm}</p>
              )}
            </div>

            {/* 利用規約 */}
            <p className="text-xs text-[#6B7A99] text-center leading-relaxed">
              登録することで、
              <Link to="/terms" className="text-[#00C6FF] hover:underline">利用規約</Link>
              および
              <Link to="/privacy" className="text-[#00C6FF] hover:underline">プライバシーポリシー</Link>
              に同意したものとみなされます。
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#C89B3C] text-[#070B14] font-bold rounded-xl hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#070B14] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  登録中...
                </span>
              ) : (
                'アカウントを作成'
              )}
            </button>
          </form>

          {/* ログインリンク */}
          <p className="text-center text-sm text-[#6B7A99] mt-6">
            すでにアカウントをお持ちの方は{' '}
            <Link to="/login" className="text-[#00C6FF] hover:underline">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const GoogleIcon: FC = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M5.27 9.76A7.08 7.08 0 0 1 19.07 12c0 .68-.06 1.34-.18 1.97H12v-3.73h7.73a7.1 7.1 0 0 0-1.35-5.32L5.27 9.76z" />
    <path fill="#FBBC05" d="M5.27 9.76 2.58 7.09A11.98 11.98 0 0 0 0 12c0 1.93.46 3.75 1.27 5.36l3.74-2.9A7.07 7.07 0 0 1 5 12c0-.77.1-1.52.27-2.24z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-3.02A7.07 7.07 0 0 1 5.01 14.46l-3.74 2.9C3.26 21.44 7.32 24 12 24z" />
    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63l3.87 3.02C21.98 19.01 23.49 15.87 23.49 12.27z" />
  </svg>
)

const DiscordIcon: FC = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#7289DA" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
  </svg>
)

export default RegisterPage
