import { useEffect, useRef, type FC } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { handleOAuthCallback } from '@/api/auth'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

/**
 * OAuthコールバックハンドラー
 * /oauth/callback?code=xxx&state=xxx&provider=google
 */
const OAuthCallback: FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const calledRef = useRef(false)

  useEffect(() => {
    // React StrictMode の二重実行を防ぐ
    if (calledRef.current) return
    calledRef.current = true

    const code     = searchParams.get('code')  ?? ''
    const state    = searchParams.get('state') ?? ''
    const error    = searchParams.get('error')
    // Discordはコールバック時にproviderパラメータを付与しないためsessionStorageから復元
    const provider = searchParams.get('provider')
      ?? sessionStorage.getItem('oauth_provider')
      ?? 'google'
    sessionStorage.removeItem('oauth_provider')

    if (error) {
      console.error('OAuth認証エラー:', error)
      navigate('/login?error=oauth_failed', { replace: true })
      return
    }

    if (!code) {
      navigate('/login?error=no_code', { replace: true })
      return
    }

    handleOAuthCallback(provider, code, state)
      .then(({ token, user }) => {
        login(token, user)
        navigate('/', { replace: true })
      })
      .catch((err) => {
        console.error('OAuthコールバック処理エラー:', err)
        navigate('/login?error=callback_failed', { replace: true })
      })
  }, [searchParams, navigate, login])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#070B14] gap-4">
      <LoadingSpinner size="xl" label="ログイン処理中..." />
      <p className="text-[#C8D8F0] text-sm">認証情報を確認しています...</p>
    </div>
  )
}

export default OAuthCallback
