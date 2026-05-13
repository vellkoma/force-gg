import { useState, type FC, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '@/api/auth'

const ForgotPasswordPage: FC = () => {
  const [email, setEmail]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [sent, setSent]         = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email) return
    setError(null)
    setIsLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch {
      setError('送信に失敗しました。しばらくしてから再度お試しください。')
    } finally {
      setIsLoading(false)
    }
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
          <h2 className="text-xl font-bold text-[#E0E6F0] mb-2 text-center">パスワードをお忘れの方</h2>

          {sent ? (
            <div className="text-center space-y-4 mt-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#00C6FF]/10 border border-[#00C6FF]/30 flex items-center justify-center text-2xl">
                ✉
              </div>
              <p className="text-[#C8D8F0] text-sm leading-relaxed">
                ご入力のメールアドレスにリセット用のリンクをお送りしました。<br />
                メールが届かない場合は迷惑メールフォルダをご確認ください。
              </p>
              <Link
                to="/login"
                className="inline-block mt-2 text-sm text-[#00C6FF] hover:underline"
              >
                ログイン画面に戻る
              </Link>
            </div>
          ) : (
            <>
              <p className="text-[#6B7A99] text-sm text-center mb-6">
                登録済みのメールアドレスを入力してください。<br />
                パスワードリセット用のリンクをお送りします。
              </p>

              {error && (
                <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">⚠ {error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                      送信中...
                    </span>
                  ) : (
                    'リセットリンクを送信'
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-[#6B7A99] mt-6">
                <Link to="/login" className="text-[#00C6FF] hover:underline">
                  ログイン画面に戻る
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
