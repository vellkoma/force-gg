import { useState, useEffect, type FC } from 'react'
import { AdBanner } from './AdBanner'

export const BottomStickyAd: FC = () => {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    setVisible(false)
    setTimeout(() => setMounted(false), 350)
  }

  if (!mounted) return null

  return (
    <div
      className={[
        'fixed bottom-0 left-0 right-0 z-50',
        'transition-transform duration-350 ease-out will-change-transform',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
      role="complementary"
      aria-label="広告"
    >
      {/* 広告本体（中央寄せ・コンパクト） */}
      <div className="flex justify-center py-2">
        <div className="relative w-[728px] max-w-full bg-[#0d1220] border border-[#1E2A40] rounded-t-lg">
          <button
            onClick={dismiss}
            aria-label="広告を閉じる"
            className="absolute -top-1 right-0 z-10 text-[#6B7A99] hover:text-white text-sm leading-none w-5 h-5 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
          <AdBanner slot="bottom-sticky" format="horizontal" noMargin />
        </div>
      </div>
    </div>
  )
}
