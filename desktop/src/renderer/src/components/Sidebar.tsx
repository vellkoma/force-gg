import { NavLink } from 'react-router-dom'

// ナビゲーション定義
const NAV_TOP = [
  {
    path: '/',
    end: true,
    title: 'ホーム',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    path: '/matches',
    end: false,
    title: 'マッチ履歴',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
      </svg>
    ),
  },
  {
    path: '/chat',
    end: false,
    title: 'AI コーチ',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
      </svg>
    ),
  },
] as const

const NAV_BOTTOM = [
  {
    path: '/account',
    end: false,
    title: 'アカウント',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
  },
  {
    path: '/settings',
    end: false,
    title: '設定',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    ),
  },
] as const

function SideItem({
  path,
  end,
  title,
  icon,
}: {
  path: string
  end: boolean
  title: string
  icon: React.ReactNode
}) {
  return (
    <NavLink
      to={path}
      end={end}
      title={title}
      className={({ isActive }) =>
        `relative group flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ${
          isActive
            ? 'bg-[#c89b3c]/15 text-[#c89b3c]'
            : 'text-[#4a5568] hover:bg-[#ffffff08] hover:text-[#94a3b8]'
        }`
      }
    >
      {icon}
      {/* ツールチップ */}
      <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#1a2232] border border-[#2a3a4a] px-2.5 py-1.5 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {title}
      </span>
    </NavLink>
  )
}

export function Sidebar(): JSX.Element {
  return (
    <aside className="flex flex-col items-center w-[52px] bg-[#080c14] border-r border-[#111827] py-3 gap-1 shrink-0">
      {/* ロゴ */}
      <div className="w-8 h-8 mb-3 rounded-lg bg-[#c89b3c] flex items-center justify-center text-black font-bold text-sm shrink-0">
        F
      </div>

      {/* メインナビ */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        {NAV_TOP.map((item) => (
          <SideItem key={item.path} {...item} />
        ))}
      </div>

      {/* ボトムナビ */}
      <div className="flex flex-col items-center gap-0.5">
        {NAV_BOTTOM.map((item) => (
          <SideItem key={item.path} {...item} />
        ))}
      </div>
    </aside>
  )
}
