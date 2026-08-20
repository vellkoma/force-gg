import { useState, useRef, useEffect, type FC } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { PREMIUM_SIGNUP_ENABLED } from '@/config/features'

/**
 * ヘッダー右上のユーザーメニュー
 * ログイン済み: アバター + ドロップダウン
 * 未ログイン: ログインボタン
 */
const UserMenu: FC = () => {
  const { user, isAuthenticated, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    setIsOpen(false)
    navigate('/')
  }

  if (!isAuthenticated || !user) {
    return (
      <Link
        to="/login"
        className="px-4 py-2 text-sm font-bold text-[#070B14] bg-[#C89B3C] rounded-lg hover:brightness-110 transition-all duration-200"
      >
        ログイン
      </Link>
    )
  }

  // イニシャルアバター（アバター画像がない場合）
  const initials = user.name.slice(0, 2).toUpperCase()

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#C89B3C] transition-all duration-200"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#C89B3C] flex items-center justify-center text-[#070B14] text-xs font-bold">
            {initials}
          </div>
        )}
        <span className="hidden sm:block text-sm text-[#E0E6F0] max-w-[120px] truncate">
          {user.name}
        </span>
        <svg
          className={`w-4 h-4 text-[#6B7A99] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-[#0D1626] border border-[#1E2A40] rounded-xl shadow-xl z-50 overflow-hidden">
          {/* ユーザー情報ヘッダー */}
          <div className="px-4 py-3 border-b border-[#1E2A40]">
            <p className="text-sm font-bold text-[#E0E6F0] truncate">{user.name}</p>
            <p className="text-xs text-[#6B7A99] truncate">{user.email}</p>
            {user.isPremium && (
              <span className="inline-block mt-1 text-xs font-bold text-[#C89B3C] bg-[#C89B3C]/10 px-2 py-0.5 rounded-full">
                プレミアム会員
              </span>
            )}
          </div>

          {/* メニュー項目 */}
          <nav className="py-1">
            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#C8D8F0] hover:bg-[#1E2A40] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              プロフィール
            </Link>

            {/* 新規受付休止中はアップグレード導線を出さない */}
            {!user.isPremium && PREMIUM_SIGNUP_ENABLED && (
              <Link
                to="/premium"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#C89B3C] hover:bg-[#1E2A40] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                プレミアムへアップグレード
              </Link>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#FF6B6B] hover:bg-[#1E2A40] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              ログアウト
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}

export default UserMenu
