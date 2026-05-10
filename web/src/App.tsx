import { createBrowserRouter, RouterProvider, Outlet, NavLink, useLocation } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { AuthProvider } from '@/contexts/AuthContext'
import UserMenu from '@/components/auth/UserMenu'
import { BottomStickyAd } from '@/components/ads/BottomStickyAd'

// ページの遅延ロード（コード分割）
const HomePage          = lazy(() => import('@/pages/HomePage'))
const ChampionsPage     = lazy(() => import('@/pages/ChampionsPage'))
const SummonerPage      = lazy(() => import('@/pages/SummonerPage'))
const MetaPage          = lazy(() => import('@/pages/MetaPage'))
const PremiumPage       = lazy(() => import('@/pages/PremiumPage'))
const ChampionDetailPage = lazy(() => import('@/pages/ChampionDetailPage'))
const LoginPage            = lazy(() => import('@/pages/LoginPage'))
const RegisterPage         = lazy(() => import('@/pages/RegisterPage'))
const OAuthCallback        = lazy(() => import('@/components/auth/OAuthCallback'))
const PremiumSuccessPage   = lazy(() => import('@/pages/PremiumSuccessPage'))
const PremiumCancelPage    = lazy(() => import('@/pages/PremiumCancelPage'))
const CoachingPage         = lazy(() => import('@/pages/CoachingPage'))
const DownloadPage         = lazy(() => import('@/pages/DownloadPage'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// ルートレイアウト（ヘッダー付き）
function RootLayout() {
  return (
    <div className="min-h-screen bg-lol-bg">
      {/* グローバルヘッダー */}
      <header className="sticky top-0 z-40 bg-[#070B14]/90 border-b border-[#1E2A40] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-[#C89B3C] font-display tracking-wider">
            force.gg
          </a>
          <nav className="hidden sm:flex items-center gap-5">
            <NavLink
              to="/champions"
              className={({ isActive }) =>
                `text-sm transition-colors ${isActive ? 'text-[#C89B3C] font-bold' : 'text-[#C8D8F0] hover:text-[#C89B3C]'}`
              }
            >
              チャンピオン分析
            </NavLink>
            <NavLink
              to="/meta"
              className={({ isActive }) =>
                `text-sm transition-colors ${isActive ? 'text-[#C89B3C] font-bold' : 'text-[#C8D8F0] hover:text-[#C89B3C]'}`
              }
            >
              メタ分析
            </NavLink>
            <NavLink
              to="/coaching"
              className={({ isActive }) =>
                `text-sm transition-colors ${isActive ? 'text-[#C89B3C] font-bold' : 'text-[#C8D8F0] hover:text-[#C89B3C]'}`
              }
            >
              AI コーチング
            </NavLink>
            <NavLink
              to="/download"
              className={({ isActive }) =>
                `text-sm transition-colors ${isActive ? 'text-[#C89B3C] font-bold' : 'text-[#C8D8F0] hover:text-[#C89B3C]'}`
              }
            >
              デスクトップ
            </NavLink>
          </nav>
          <UserMenu />
        </div>
      </header>

      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        {/* BottomStickyAd（高さ約106px）に隠れないよう全ページに下余白 */}
        <ScrollToTop />
        <div className="pb-32">
          <Outlet />
        </div>
      </Suspense>

      <BottomStickyAd />
    </div>
  )
}

// 認証ページ用レイアウト（ヘッダーなし）
function AuthLayout() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#070B14]">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  )
}

const router = createBrowserRouter([
  // 認証ページ（ヘッダーなし）
  {
    element: <AuthLayout />,
    children: [
      { path: '/login',          element: <LoginPage /> },
      { path: '/register',       element: <RegisterPage /> },
      { path: '/oauth/callback', element: <OAuthCallback /> },
    ],
  },
  // メインページ（ヘッダーあり）
  {
    element: <RootLayout />,
    children: [
      { path: '/',                              element: <HomePage /> },
      { path: '/champions',                     element: <ChampionsPage /> },
      { path: '/champions/:id',                 element: <ChampionDetailPage /> },
      { path: '/summoner',                      element: <SummonerPage /> },
      { path: '/summoner/:gameName/:tagLine',   element: <SummonerPage /> },
      { path: '/meta',                          element: <MetaPage /> },
      { path: '/premium',                       element: <PremiumPage /> },
      { path: '/premium/success',               element: <PremiumSuccessPage /> },
      { path: '/premium/cancel',                element: <PremiumCancelPage /> },
      { path: '/coaching',                      element: <CoachingPage /> },
      { path: '/download',                      element: <DownloadPage /> },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
