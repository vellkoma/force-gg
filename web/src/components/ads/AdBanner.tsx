import { useEffect, useRef } from 'react'

// --- 型定義 ---

type AdFormat = 'auto' | 'rectangle' | 'horizontal' | 'vertical' | 'billboard'

interface AdBannerProps {
  slot:       string
  format?:    AdFormat
  className?: string
  noMargin?:  boolean
}

// --- フォーマット別サイズ設定 ---

const FORMAT_CONFIG: Record<AdFormat, {
  wrapper:    string
  insStyle:   React.CSSProperties
  label:      string
}> = {
  horizontal: {
    wrapper:  'w-full',
    insStyle: { display: 'block', width: '100%', height: '90px' },
    label:    'リーダーボード広告 728×90',
  },
  rectangle: {
    wrapper:  'w-full flex justify-center',
    insStyle: { display: 'inline-block', width: '300px', height: '250px' },
    label:    'レクタングル広告 300×250',
  },
  vertical: {
    wrapper:  'w-full flex justify-center',
    insStyle: { display: 'inline-block', width: '160px', height: '600px' },
    label:    'ワイドスカイスクレイパー 160×600',
  },
  auto: {
    wrapper:  'w-full',
    insStyle: { display: 'block' },
    label:    '自動広告',
  },
  billboard: {
    wrapper:  'w-full',
    insStyle: { display: 'block', width: '100%', height: '250px' },
    label:    'ビルボード広告 970×250',
  },
}

// --- AdSense スクリプト動的挿入（重複防止） ---

const SCRIPT_ID = 'adsense-script'

function injectAdSenseScript(clientId: string): void {
  if (document.getElementById(SCRIPT_ID)) return
  const script       = document.createElement('script')
  script.id          = SCRIPT_ID
  script.async       = true
  script.crossOrigin = 'anonymous'
  script.src         = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`
  document.head.appendChild(script)
}

// --- コンポーネント ---

export const AdBanner = ({
  slot,
  format    = 'horizontal',
  className = '',
  noMargin  = false,
}: AdBannerProps) => {
  const clientId    = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined
  const initialized = useRef(false)
  const isDev       = !clientId

  useEffect(() => {
    if (isDev) return
    if (initialized.current) return
    initialized.current = true

    // コンテンツレンダリング後にスクリプトを挿入（パフォーマンス配慮）
    const timer = setTimeout(() => {
      injectAdSenseScript(clientId)
      try {
        const w = (window as unknown) as Record<string, unknown>
        const adsbygoogle = (w.adsbygoogle as unknown[]) ?? []
        w.adsbygoogle = adsbygoogle
        adsbygoogle.push({})
      } catch (e) {
        console.error('[AdBanner] adsbygoogle.push エラー:', e)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isDev, clientId])

  const config = FORMAT_CONFIG[format]

  // --- 開発環境: プレースホルダー表示 ---
  if (isDev) {
    return (
      <div className={`${config.wrapper} ${noMargin ? '' : 'my-4'} ${className}`}>
        <div
          className="mx-auto rounded-lg bg-lol-card border border-dashed border-lol-border/50
                     flex flex-col items-center justify-center gap-1 opacity-50"
          style={config.insStyle}
          title={`AdSense slot: ${slot}`}
        >
          <span className="text-[10px] font-display tracking-widest text-lol-text-sub uppercase">
            Ad
          </span>
          <span className="text-[9px] text-lol-text-sub/60">{config.label}</span>
        </div>
      </div>
    )
  }

  // --- 本番環境: AdSense ins タグ ---
  return (
    <div className={`${config.wrapper} ${noMargin ? '' : 'my-4'} ${className}`}>
      <ins
        className="adsbygoogle"
        style={config.insStyle}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format={format === 'auto' ? 'auto' : undefined}
        data-full-width-responsive={format === 'auto' || format === 'horizontal' ? 'true' : undefined}
      />
    </div>
  )
}
