import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { UpdateBanner } from '../components/UpdateBanner'
import { ReadyCheckOverlay } from '../components/ReadyCheckOverlay'
import { useUpdater } from '../hooks/useUpdater'
import { useLcu } from '../context/LcuContext'
import { useEffect, useRef } from 'react'

const NAV_MAIN = [
  {
    path: '/',
    end: true,
    label: 'ホーム',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    path: '/matches',
    end: false,
    label: 'マッチ履歴',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
        <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
      </svg>
    ),
  },
  {
    path: '/chat',
    end: false,
    label: 'AI コーチ',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
      </svg>
    ),
  },
] as const

const NAV_RIGHT = [
  {
    path: '/account',
    end: false,
    label: 'アカウント',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
  },
  {
    path: '/settings',
    end: false,
    label: '設定',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    ),
  },
] as const

function NavTab({
  path,
  end,
  label,
  icon,
}: {
  path: string
  end: boolean
  label: string
  icon: React.ReactNode
}) {
  return (
    <NavLink
      to={path}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-1.5 px-3 h-7 rounded-md text-[11px] font-medium transition-colors select-none ${
          isActive
            ? 'bg-[#c89b3c]/15 text-[#c89b3c]'
            : 'text-[#4a5568] hover:bg-white/5 hover:text-[#94a3b8]'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

function TopBar(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const canGoBack = location.pathname !== '/'

  return (
    <div
      className="flex items-center h-10 px-2 shrink-0 bg-[#060a11] border-b border-[#111827]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 左: ロゴ + 戻るボタン */}
      <div
        className="flex items-center gap-1.5 mr-3"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="w-6 h-6 rounded-md bg-[#c89b3c] flex items-center justify-center text-black font-bold text-[11px] select-none">
          F
        </div>
        <button
          onClick={() => navigate(-1)}
          disabled={!canGoBack}
          title="戻る"
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            canGoBack
              ? 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
              : 'text-[#1e2a3a] cursor-default'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
      </div>

      {/* 中: メインナビ */}
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {NAV_MAIN.map((item) => (
          <NavTab key={item.path} {...item} />
        ))}
      </div>

      {/* スペーサー（ドラッグ領域） */}
      <div className="flex-1" />

      {/* 右: アカウント・設定 + ウィンドウ操作 */}
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {NAV_RIGHT.map((item) => (
          <NavTab key={item.path} {...item} />
        ))}

        {/* セパレーター */}
        <div className="w-px h-4 bg-[#1e2a3a] mx-1.5" />

        {/* ウィンドウ操作 */}
        <button
          onClick={() => window.electronAPI.window.minimize()}
          className="w-7 h-6 flex items-center justify-center text-[#3a4a5a] hover:text-gray-300 hover:bg-white/5 rounded transition-colors text-base leading-none"
        >
          ─
        </button>
        <button
          onClick={() => window.electronAPI.window.maximize()}
          className="w-7 h-6 flex items-center justify-center text-[#3a4a5a] hover:text-gray-300 hover:bg-white/5 rounded transition-colors"
        >
          <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
            <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.window.close()}
          className="w-7 h-6 flex items-center justify-center text-[#3a4a5a] hover:text-white hover:bg-red-600 rounded transition-colors text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export function RootLayout(): JSX.Element {
  const updater = useUpdater()
  const { gameflowPhase } = useLcu()
  const navigate = useNavigate()
  const location = useLocation()
  const prevPhaseRef = useRef<typeof gameflowPhase>(null)

  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = gameflowPhase

    if (gameflowPhase === 'ChampSelect' && prev !== 'ChampSelect') {
      navigate('/champ-select', { replace: true })
    } else if (prev === 'ChampSelect' && gameflowPhase !== 'ChampSelect') {
      // チャンプセレクト終了 → ホームに戻る（他のページにいた場合は移動しない）
      if (location.pathname === '/champ-select') {
        navigate('/', { replace: true })
      }
    }
  }, [gameflowPhase, navigate, location.pathname])

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-white font-sans overflow-hidden">
      {/* ブラウザ型トップバー */}
      <TopBar />

      {/* メインコンテンツ */}
      <div className="flex flex-col flex-1 min-h-0">
        <UpdateBanner updater={updater} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* マッチ承認オーバーレイ */}
      <ReadyCheckOverlay />
    </div>
  )
}
