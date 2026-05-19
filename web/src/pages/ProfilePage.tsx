import { useState, type FC, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { setPassword } from '@/api/auth'

const ProfilePage: FC = () => {
  const { user } = useAuth()

  const [password, setPasswordValue] = useState('')
  const [confirm, setConfirm]         = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState<string | null>(null)

  if (!user) return null

  const providerLabel =
    user.provider === 'google'  ? 'Google' :
    user.provider === 'discord' ? 'Discord' : 'メール'

  const handleSetPassword = async (e: FormEvent) => {
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
    setSuccess(null)
    setIsLoading(true)
    try {
      const res = await setPassword(password)
      setSuccess(res.message)
      setPasswordValue('')
      setConfirm('')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'パスワードの設定に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#E0E6F0] mb-8">プロフィール</h1>

      {/* アカウント情報 */}
      <div className="bg-[#0D1626] border border-[#1E2A40] rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-bold text-[#6B7A99] uppercase tracking-wider mb-4">アカウント情報</h2>
        <div className="flex items-center gap-4 mb-4">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#C89B3C] flex items-center justify-center text-[#070B14] text-lg font-bold">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[#E0E6F0] font-bold">{user.name}</p>
            <p className="text-[#6B7A99] text-sm">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7A99]">ログイン方法:</span>
          <span className="text-xs font-bold text-[#C8D8F0] bg-[#1E2A40] px-2 py-0.5 rounded-full">
            {providerLabel}
          </span>
          {user.provider === 'email' && (
            <span className="text-xs font-bold text-[#C8D8F0] bg-[#1E2A40] px-2 py-0.5 rounded-full">
              メール/パスワード
            </span>
          )}
        </div>
      </div>

      {/* パスワード設定（Google/Discord アカウント、またはパスワード未設定の場合） */}
      <div className="bg-[#0D1626] border border-[#1E2A40] rounded-2xl p-6">
        <h2 className="text-sm font-bold text-[#6B7A99] uppercase tracking-wider mb-1">
          {user.provider === 'email' ? 'パスワード変更' : 'パスワードを追加'}
        </h2>
        {user.provider !== 'email' && (
          <p className="text-[#6B7A99] text-xs mb-4 leading-relaxed">
            パスワードを設定すると、{providerLabel} ログインに加えて
            メールアドレスとパスワードでもログインできるようになります。
          </p>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">✓ {success}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">⚠ {error}</p>
          </div>
        )}

        <form onSubmit={handleSetPassword} className="space-y-4 mt-4">
          <div>
            <label htmlFor="new-password" className="block text-sm text-[#C8D8F0] mb-1.5">
              新しいパスワード
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="8文字以上"
              autoComplete="new-password"
              required
              className="w-full bg-[#111827] border border-[#1E2A40] text-[#E0E6F0] placeholder-[#6B7A99] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#00C6FF] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm text-[#C8D8F0] mb-1.5">
              パスワード（確認）
            </label>
            <input
              id="confirm-password"
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
                設定中...
              </span>
            ) : (
              'パスワードを設定する'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProfilePage
