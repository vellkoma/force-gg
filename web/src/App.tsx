import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

// ページの遅延ロード（コード分割）
const HomePage       = lazy(() => import('@/pages/HomePage'))
const ChampionsPage  = lazy(() => import('@/pages/ChampionsPage'))

// ルートレイアウト
function RootLayout() {
  return (
    <div className="min-h-screen bg-lol-bg">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/',                              element: <HomePage /> },
      { path: '/champions',                     element: <ChampionsPage /> },
      // Phase 2以降に追加予定
      // { path: '/summoner/:gameName/:tagLine',   element: <SummonerPage /> },
      // { path: '/champions/:id',                 element: <ChampionDetail /> },
      // { path: '/premium',                       element: <PremiumPage /> },
      // { path: '/premium/success',               element: <PremiumSuccess /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
