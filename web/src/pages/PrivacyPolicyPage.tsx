/**
 * プライバシーポリシー
 * Google AdSense 審査の必須要件（Cookie・広告配信・アクセス解析の説明）
 */
import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { LegalLayout, Section, List } from '@/components/legal/LegalLayout'
import { CONTACT_EMAIL, OPERATOR_NAME, SITE_NAME } from '@/config/site'

const PrivacyPolicyPage: FC = () => (
  <LegalLayout title="プライバシーポリシー" lastUpdated="2026年8月21日">
    <Section title="1. はじめに">
      <p>
        {OPERATOR_NAME}（以下「当方」）は、{SITE_NAME}（以下「当サイト」）における
        利用者の個人情報およびそれに準ずる情報の取り扱いについて、以下のとおり
        プライバシーポリシーを定めます。
      </p>
    </Section>

    <Section title="2. 取得する情報">
      <p>当サイトでは、以下の情報を取得することがあります。</p>
      <List
        items={[
          <>
            <strong className="text-lol-text">アカウント情報</strong> —
            会員登録時にご提供いただくメールアドレス、表示名。Google または Discord
            でログインした場合は、それらのサービスから提供されるメールアドレスと
            プロフィール情報。
          </>,
          <>
            <strong className="text-lol-text">検索したゲームアカウント情報</strong> —
            サモナー名・戦績表示のために入力された Riot ID。これは Riot Games が
            一般に公開している情報であり、個人を特定する情報としては扱いません。
          </>,
          <>
            <strong className="text-lol-text">アクセス情報</strong> —
            IPアドレス、ブラウザの種類、閲覧ページ、参照元URL、アクセス日時など、
            一般的にウェブサーバーが記録する情報。
          </>,
          <>
            <strong className="text-lol-text">Cookie 情報</strong> —
            ログイン状態の維持および広告配信・アクセス解析のために使用します。
          </>,
        ]}
      />
    </Section>

    <Section title="3. 利用目的">
      <List
        items={[
          '当サイトのサービス提供、認証、およびログイン状態の維持のため',
          'サービスの改善、不具合の調査、および利用状況の分析のため',
          '利用規約に違反する行為への対応のため',
          '広告の配信および効果測定のため',
          'お問い合わせへの回答のため',
        ]}
      />
    </Section>

    <Section title="4. 広告配信について（Google AdSense）">
      <p>
        当サイトは、第三者配信の広告サービス「Google AdSense」を利用しています。
      </p>
      <p>
        Google などの第三者配信事業者は、Cookie を使用して、利用者が当サイトや
        他のウェブサイトに過去にアクセスした際の情報に基づいて広告を配信します。
        これにより、利用者の興味に応じた広告が表示されます。
      </p>
      <p>
        Google が広告 Cookie を使用することにより、利用者は
        <a
          href="https://www.google.com/settings/ads"
          target="_blank"
          rel="noopener noreferrer"
          className="text-lol-accent hover:underline"
        >
          広告設定
        </a>
        でパーソナライズ広告を無効にできます。また
        <a
          href="https://www.aboutads.info/choices/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-lol-accent hover:underline"
        >
          aboutads.info
        </a>
        にアクセスすれば、第三者配信事業者の Cookie を無効にできます。
      </p>
      <p>
        詳細については、
        <a
          href="https://policies.google.com/technologies/ads?hl=ja"
          target="_blank"
          rel="noopener noreferrer"
          className="text-lol-accent hover:underline"
        >
          Google のポリシーと規約
        </a>
        をご確認ください。
      </p>
    </Section>

    <Section title="5. アクセス解析について">
      <p>
        当サイトでは、サービス改善のためにアクセス解析ツールを利用する場合があります。
        これらのツールはトラフィックデータの収集のために Cookie を使用しますが、
        収集されるデータは匿名であり、個人を特定するものではありません。
      </p>
      <p>
        Cookie の使用はブラウザの設定により拒否することができます。ただしその場合、
        当サイトの一部機能（ログイン状態の維持など）が正常に動作しないことがあります。
      </p>
    </Section>

    <Section title="6. 決済情報の取り扱い">
      <p>
        有料プランの決済には Stripe, Inc. が提供する決済サービスを利用します。
        クレジットカード番号などの決済情報は Stripe が直接取得・管理するものであり、
        当方のサーバーには保存されません。
      </p>
      <p className="text-lol-text-sub">
        ※ 現在、有料プランの新規受付は休止しています。
      </p>
    </Section>

    <Section title="7. 第三者への提供">
      <p>
        当方は、以下の場合を除き、取得した個人情報を第三者に提供することはありません。
      </p>
      <List
        items={[
          '利用者本人の同意がある場合',
          '法令に基づく開示請求があった場合',
          '人の生命、身体または財産の保護のために必要であり、本人の同意を得ることが困難な場合',
          'サービス提供に必要な範囲で業務委託先（決済代行、メール配信など）に提供する場合',
        ]}
      />
    </Section>

    <Section title="8. 情報の開示・訂正・削除">
      <p>
        利用者本人から、個人情報の開示、訂正、利用停止または削除を求められた場合は、
        本人であることを確認のうえ、合理的な期間内に対応します。ご希望の際は
        <Link to="/contact" className="text-lol-accent hover:underline">
          お問い合わせページ
        </Link>
        よりご連絡ください。
      </p>
    </Section>

    <Section title="9. 免責事項">
      <p>
        当サイトに掲載する統計情報は、Riot Games が提供する公開 API および
        公開データをもとに独自に集計したものです。情報の正確性・完全性について
        保証するものではなく、これらの情報を利用したことにより生じた損害について、
        当方は一切の責任を負いません。
      </p>
      <p>
        当サイトから外部サイトへ移動された場合、移動先サイトで提供される情報や
        サービスについて当方は責任を負いません。
      </p>
    </Section>

    <Section title="10. ポリシーの変更">
      <p>
        当方は、法令の変更やサービス内容の変更に応じて、本ポリシーを予告なく
        変更することがあります。変更後のポリシーは、当サイトに掲載した時点から
        効力を生じるものとします。
      </p>
    </Section>

    <Section title="11. お問い合わせ窓口">
      <p>
        本ポリシーに関するお問い合わせは、下記までご連絡ください。
      </p>
      <div className="bg-lol-card border border-lol-border rounded-lg px-5 py-4 space-y-1">
        <p>
          <span className="text-lol-text-sub">運営者:</span>{' '}
          <span className="text-lol-text font-medium">{OPERATOR_NAME}</span>
        </p>
        <p>
          <span className="text-lol-text-sub">連絡先:</span>{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-lol-accent hover:underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </Section>
  </LegalLayout>
)

export default PrivacyPolicyPage
