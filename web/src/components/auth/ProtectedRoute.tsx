import type { FC, ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface Props {
  children: ReactNode
}

/**
 * 認証必須ルートのラッパー
 * 未認証の場合はログインページにリダイレクトする
 */
const ProtectedRoute: FC<Props> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#070B14]">
        <LoadingSpinner size="lg" label="認証情報を確認中..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
