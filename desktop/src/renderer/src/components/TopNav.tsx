import { NavLink } from 'react-router-dom'
import { useLcu } from '../context/LcuContext'

const NAV_ITEMS = [
  { path: '/',        label: 'ホーム',     end: true  },
  { path: '/matches', label: 'マッチ履歴', end: false },
  { path: '/chat',    label: 'AI コーチ',  end: false },
] as const

export function TopNav(): JSX.Element {
  const { isConnected, summoner } = useLcu()

  return (
    /* -webkit-app-region: drag でウィンドウをドラッグ可能にする */
    <header
      className="flex items-center h-10 bg-[#060a12] border-b border-[#1a2332] px-4 shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* ロゴ */}
      <div
        className="flex items-center gap-2 mr-5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="w-6 h-6 bg-[#c89b3c] rounded flex items-center justify-center text-black font-bold text-xs">
          F
        </div>
        <span className="text-sm font-semibold text-[#c89b3c] tracking-wide">force.gg</span>
      </div>

      {/* ナビゲーション */}
      <nav
        className="flex items-center gap-1 flex-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `relative px-4 h-10 flex items-center text-sm transition-colors ${
                isActive
                  ? 'text-[#c89b3c] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#c89b3c]'
                  : 'text-gray-400 hover:text-gray-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* 右端：LCU状態 + アカウント + ウィンドウ操作 */}
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* LCU 接続インジケーター */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : 'bg-gray-600'
            }`}
          />
          {isConnected && summoner && (
            <span className="text-xs text-gray-300 max-w-[80px] truncate">
              {summoner.displayName}
            </span>
          )}
        </div>

        {/* 設定 */}
        <NavLink
          to="/settings"
          title="設定"
          className={({ isActive }) =>
            `text-gray-500 hover:text-gray-200 transition-colors ${isActive ? 'text-[#c89b3c]' : ''}`
          }
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </NavLink>

        {/* アカウント */}
        <NavLink
          to="/account"
          title="アカウント"
          className={({ isActive }) =>
            `text-gray-500 hover:text-gray-200 transition-colors ${isActive ? 'text-[#c89b3c]' : ''}`
          }
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </NavLink>

        {/* セパレーター */}
        <div className="w-px h-4 bg-[#1e2a3a]" />

        {/* ウィンドウ操作ボタン */}
        <button
          onClick={() => window.electronAPI.window.minimize()}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#1e2a3a] rounded transition-colors text-lg leading-none"
          title="最小化"
        >
          ─
        </button>
        <button
          onClick={() => window.electronAPI.window.maximize()}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#1e2a3a] rounded transition-colors"
          title="最大化"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M3 3h18v18H3V3zm2 4v12h14V7H5z" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.window.close()}
          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-red-600 rounded transition-colors text-base"
          title="閉じる"
        >
          ×
        </button>
      </div>
    </header>
  )
}
