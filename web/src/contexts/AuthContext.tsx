import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type FC,
  type ReactNode,
} from 'react'
import { getMe, refreshToken as apiRefreshToken } from '@/api/auth'
import type { User, AuthState } from '@/types/auth'

// ストレージキー
const TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'auth_refresh_token'

// トークンリフレッシュ間隔: 14分（アクセストークンの15分有効期限より1分早めに更新）
const REFRESH_INTERVAL_MS = 14 * 60 * 1000

interface AuthContextValue extends AuthState {
  login: (token: string, user: User, refreshTokenValue?: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [isLoading, setIsLoading] = useState(true)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // トークンをlocalStorageと状態に保存
  const persistToken = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
  }, [])

  // ログイン処理（OAuthコールバック・メールログイン後に呼ぶ）
  const login = useCallback((newToken: string, newUser: User, refreshTokenValue?: string) => {
    persistToken(newToken)
    if (refreshTokenValue) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshTokenValue)
    }
    setUser(newUser)
  }, [persistToken])

  // ログアウト処理
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    setToken(null)
    setUser(null)
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  // 自動トークンリフレッシュの開始
  const startRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
    }
    refreshTimerRef.current = setInterval(async () => {
      const storedRefreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY)
      if (!storedRefreshToken) {
        logout()
        return
      }
      try {
        const { token: newToken, refresh_token: newRefreshToken } = await apiRefreshToken(storedRefreshToken)
        persistToken(newToken)
        sessionStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken)
      } catch {
        // リフレッシュ失敗時はログアウト
        logout()
      }
    }, REFRESH_INTERVAL_MS)
  }, [persistToken, logout])

  // 初回マウント時: localStorageのトークンでユーザー情報を復元
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (!storedToken) {
      setIsLoading(false)
      return
    }

    getMe()
      .then((fetchedUser) => {
        setUser(fetchedUser)
        startRefreshTimer()
      })
      .catch(() => {
        // トークンが無効な場合はクリア
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [startRefreshTimer])

  // ログイン後にリフレッシュタイマーを起動
  useEffect(() => {
    if (token && user) {
      startRefreshTimer()
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [token, user, startRefreshTimer])

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(user && token),
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * 認証情報・操作にアクセスするカスタムフック
 * AuthProvider の外で使うとエラーを投げる
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth は AuthProvider の内側で使用してください')
  }
  return context
}
