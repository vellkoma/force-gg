import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT_EMAIL, SITE_NAME } from '@/config/site'

/**
 * グローバルフッター
 *
 * 法務ページへの導線を全ページに提供する。
 * Google AdSense 審査では、プライバシーポリシー・お問い合わせへの
 * リンクがサイト全体から辿れることが要件となっている。
 */
const NAV_LINKS = [
  { to: '/champions', label: 'チャンピオン分析' },
  { to: '/meta',      label: 'メタ分析' },
  { to: '/summoner',  label: 'サモナー検索' },
  { to: '/download',  label: 'デスクトップアプリ' },
]

const LEGAL_LINKS = [
  { to: '/privacy', label: 'プライバシーポリシー' },
  { to: '/terms',   label: '利用規約' },
  { to: '/contact', label: 'お問い合わせ' },
]

export const Footer: FC = () => (
  <footer className="border-t border-[#1E2A40] bg-[#070B14] mt-16">
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-8">
        {/* ブランド */}
        <div className="col-span-2 sm:col-span-1">
          <p className="font-display font-bold text-lg text-[#C89B3C] tracking-wider mb-2">
            {SITE_NAME}
          </p>
          <p className="text-xs text-[#6B7A99] leading-relaxed">
            League of Legends の統計情報とチャンピオン分析を提供するファンサイトです。
          </p>
        </div>

        {/* コンテンツ */}
        <nav>
          <p className="text-xs font-bold text-[#C8D8F0] uppercase tracking-wider mb-3">
            コンテンツ
          </p>
          <ul className="space-y-2">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="text-xs text-[#6B7A99] hover:text-[#C89B3C] transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* サイト情報 */}
        <nav>
          <p className="text-xs font-bold text-[#C8D8F0] uppercase tracking-wider mb-3">
            サイト情報
          </p>
          <ul className="space-y-2">
            {LEGAL_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="text-xs text-[#6B7A99] hover:text-[#C89B3C] transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-xs text-[#6B7A99] hover:text-[#C89B3C] transition-colors break-all"
              >
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </nav>
      </div>

      {/* 著作権・免責 */}
      <div className="border-t border-[#1E2A40] pt-6 space-y-1.5">
        <p className="text-[11px] text-[#6B7A99] leading-relaxed">
          {SITE_NAME} は Riot Games が公認したサービスではなく、Riot Games および
          League of Legends の制作・運営に関わるいかなる者も代表するものではありません。
        </p>
        <p className="text-[11px] text-[#6B7A99]">
          League of Legends および Riot Games は Riot Games, Inc. の商標または登録商標です。
        </p>
        {/* Riot Games の「Legal Jibber Jabber」ポリシーが指定する英文表記 */}
        <p className="text-[11px] text-[#6B7A99] leading-relaxed pt-1">
          {SITE_NAME} isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or
          opinions of Riot Games or anyone officially involved in producing or managing
          Riot Games properties.
        </p>
      </div>
    </div>
  </footer>
)
