/**
 * お問い合わせ / 運営者情報
 * Google AdSense 審査における「連絡手段の明示」要件を満たす
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT_EMAIL, OPERATOR_NAME, SITE_NAME, SITE_URL } from '@/config/site'

const INQUIRY_TYPES = [
  { label: '不具合の報告',       desc: '表示の崩れ、データの誤り、エラーが出るなど' },
  { label: '機能のご要望',       desc: '追加してほしい機能、改善のご提案' },
  { label: '権利関係のご連絡',   desc: '著作権・商標などに関するお問い合わせ' },
  { label: 'その他',             desc: '上記に当てはまらないお問い合わせ' },
]

const ContactPage: FC = () => (
  <main className="max-w-3xl mx-auto px-4 py-12">
    <h1 className="font-display font-bold text-3xl text-lol-text mb-2">お問い合わせ</h1>
    <p className="text-lol-text-sub text-sm mb-10">
      ご意見・ご質問は下記のメールアドレスまでお寄せください。
    </p>

    {/* 連絡先 */}
    <section className="bg-lol-card border border-lol-accent/30 rounded-xl p-6 mb-10 text-center">
      <p className="text-lol-text-sub text-xs uppercase tracking-wider font-bold mb-2">
        メールでのお問い合わせ
      </p>
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="font-display font-bold text-2xl text-lol-accent hover:underline break-all"
      >
        {CONTACT_EMAIL}
      </a>
      <p className="text-lol-text-sub text-xs mt-4 leading-relaxed">
        個人で運営しているため、返信までお時間をいただく場合があります。
        <br />
        内容によっては返信いたしかねる場合もございますので、あらかじめご了承ください。
      </p>
    </section>

    {/* お問い合わせの種類 */}
    <section className="mb-10">
      <h2 className="font-display font-bold text-lg text-lol-accent border-b border-lol-border pb-2 mb-4">
        お問い合わせの内容について
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INQUIRY_TYPES.map((t) => (
          <div key={t.label} className="bg-lol-card border border-lol-border rounded-lg px-4 py-3">
            <p className="text-lol-text font-bold text-sm">{t.label}</p>
            <p className="text-lol-text-sub text-xs mt-1 leading-relaxed">{t.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-lol-text-sub text-xs mt-4 leading-relaxed">
        不具合のご報告の際は、発生したページのURL・お使いのブラウザ・操作手順を
        添えていただけますと、調査がスムーズに進みます。
      </p>
    </section>

    {/* 運営者情報 */}
    <section className="mb-10">
      <h2 className="font-display font-bold text-lg text-lol-accent border-b border-lol-border pb-2 mb-4">
        運営者情報
      </h2>
      <dl className="bg-lol-card border border-lol-border rounded-lg divide-y divide-lol-border text-sm">
        <div className="flex px-5 py-3">
          <dt className="w-28 shrink-0 text-lol-text-sub">サイト名</dt>
          <dd className="text-lol-text-body">{SITE_NAME}</dd>
        </div>
        <div className="flex px-5 py-3">
          <dt className="w-28 shrink-0 text-lol-text-sub">URL</dt>
          <dd className="text-lol-text-body break-all">{SITE_URL}</dd>
        </div>
        <div className="flex px-5 py-3">
          <dt className="w-28 shrink-0 text-lol-text-sub">運営者</dt>
          <dd className="text-lol-text-body">{OPERATOR_NAME}</dd>
        </div>
        <div className="flex px-5 py-3">
          <dt className="w-28 shrink-0 text-lol-text-sub">連絡先</dt>
          <dd>
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-lol-accent hover:underline break-all">
              {CONTACT_EMAIL}
            </a>
          </dd>
        </div>
        <div className="flex px-5 py-3">
          <dt className="w-28 shrink-0 text-lol-text-sub">事業内容</dt>
          <dd className="text-lol-text-body">
            League of Legends に関する統計情報サイトの運営
          </dd>
        </div>
      </dl>
    </section>

    {/* 関連リンク */}
    <section className="text-sm text-lol-text-sub">
      あわせて
      <Link to="/privacy" className="text-lol-accent hover:underline mx-1">
        プライバシーポリシー
      </Link>
      および
      <Link to="/terms" className="text-lol-accent hover:underline mx-1">
        利用規約
      </Link>
      もご確認ください。
    </section>
  </main>
)

export default ContactPage
