import { useState, type FC, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '@/api/auth'

const ResetPasswordPage: FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [done, setDone]           = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('パスワードが一致しません。')
      return
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください。')
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err: any) {
      const msg = err?.response?.data?.detail
      if (msg) {
        setError(msg)
      } else {
        setError('パスワードのリセットに失敗しました。リンクが期限切れの可能性があります。')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-[#070B14] px-4">
        <div className="text-center space-y-4">
          <p className="text-red-400">無効なリセットリンクです。</p>
          <Link to="/forgot-password" className="text-[#00C6FF] hover:underline text-sm">
            再度リセットメールを送る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#070B14] px-4">
      <div
        className="absolute inset-0 opacity-20 bg-gradient-to-br from-[#00C6FF]/30 via-transparent to-[#C89B3C]/20 pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <h1 className="text-3xl font-bold text-[#C89B3C] tracking-wider font-display">
              force.gg
            </h1>
          </Link>
          <p className="text-[#6B7A99] text-sm">LoL 統計 &amp; AI コーチング</p>
        </div>

        <div className="bg-[#0D1626] border border-[#1E2A40] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-[#E0E6F0] mb-6 text-center">新しいパスワードを設定</h2>

          {done ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-2xl">
                ✓
              </div>
              <p className="text-[#C8D8F0] text-sm">
                パスワードを変更しました。<br />
                3秒後にログイン画面へ移動します。
              </p>
              <Link to="/login" className="inline-block text-sm text-[#00C6FF] hover:underline">
                今すぐログイン画面へ
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">⚠ {error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm text-[#C8D8F0] mb-1.5">
                    新しいパスワード
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8文字以上"
                    autoComplete="new-password"
                    required
                    className="w-full bg-[#111827] border border-[#1E2A40] text-[#E0E6F0] placeholder-[#6B7A99] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#00C6FF] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm text-[#C8D8F0] mb-1.5">
                    パスワード（確認）
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="もう一度入力"
                    autoComplete="new-password"
                    required
                    className="w-full bg-[#111827] border border-[#1E2A40] text-[#E0E6F0] placeholder-[#6B7A99] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#00C6FF] transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#C89B3C] text-[#070B14] font-bold rounded-xl hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#070B14] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      変更中...
                    </span>
                  ) : (
                    'パスワードを変更する'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
