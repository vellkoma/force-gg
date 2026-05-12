import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { UpdateBanner } from '../components/UpdateBanner'
import { useUpdater } from '../hooks/useUpdater'
import { useLcu } from '../context/LcuContext'
import { useEffect } from 'react'

/** フレームレスウィンドウ用タイトルバー */
function TitleBar(): JSX.Element {
  return (
    <div
      className="flex items-center justify-between h-8 px-4 shrink-0 bg-[#060a11]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-[11px] text-[#3a4a5a] tracking-widest font-medium select-none">
        force.gg
      </span>
      {/* ウィンドウ操作ボタン */}
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
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

  useEffect(() => {
    if (gameflowPhase === 'ChampSelect') {
      window.electronAPI.overlay.show()
    } else {
      window.electronAPI.overlay.hide()
    }
  }, [gameflowPhase])

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-white font-sans overflow-hidden">
      {/* タイトルバー（ドラッグ領域 + ウィンドウボタン） */}
      <TitleBar />

      <div className="flex flex-1 min-h-0">
        {/* OP.GG スタイル縦サイドバー */}
        <Sidebar />

        {/* メインコンテンツ */}
        <div className="flex flex-col flex-1 min-w-0">
          <UpdateBanner updater={updater} />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
