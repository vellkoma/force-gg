import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import './index.css'

// React Query クライアント設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5分間はデータを新鮮と見なす
      staleTime: 5 * 60 * 1000,
      // 10分間キャッシュを保持
      gcTime: 10 * 60 * 1000,
      // 404は再試行しない、その他は最大3回
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status
        if (status === 404) return false
        return failureCount < 3
      },
      // フォーカス時の自動再フェッチ（ゲームデータは頻繁に変わらないためOFF）
      refetchOnWindowFocus: false,
    },
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('ルート要素 #root が見つかりません')
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* 開発時のみデバッグツールを表示 */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
)
