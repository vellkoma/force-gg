/**
 * デスクトップアプリ ダウンロードページ
 */

const GITHUB_RELEASES_URL = 'https://github.com/vellkoma/force-gg/releases/latest/download/force.gg-Setup-0.1.0.exe'

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">

        {/* ヒーロー */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#C89B3C]/10 border border-[#C89B3C]/30 mb-6">
            <svg className="w-10 h-10 text-[#C89B3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[#C89B3C] mb-3">force.gg Desktop</h1>
          <p className="text-[#8A9BB5] text-lg">
            LoL クライアントと連携し、チャンピオン選択画面でリアルタイム統計をオーバーレイ表示
          </p>
        </div>

        {/* ダウンロードカード */}
        <div className="bg-[#0D1117] border border-[#1E2A40] rounded-xl p-8 mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-5 h-5 text-[#4CAF91]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
            </svg>
            <span className="text-[#4CAF91] text-sm font-medium">Windows 10 / 11 対応</span>
          </div>
          <p className="text-[#8A9BB5] text-sm mb-6">x64 (64ビット)</p>

          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#C89B3C] hover:bg-[#D4A94A] text-black font-bold text-lg rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Windows 版をダウンロード
          </a>

          <p className="text-[#4A5568] text-xs mt-4">
            GitHub Releases からダウンロードされます
          </p>
        </div>

        {/* インストール手順 */}
        <div className="bg-[#0D1117] border border-[#1E2A40] rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-[#8A9BB5] uppercase tracking-wider mb-4">
            インストール手順
          </h2>
          <ol className="space-y-3">
            {[
              'ダウンロードボタンをクリックし、GitHub Releases ページを開く',
              'force.gg-Setup-X.X.X.exe をクリックしてダウンロード',
              'ダウンロードした .exe を実行してインストール',
              'League of Legends を起動してから force.gg を開く',
              '「LoL クライアントに接続」ボタンで連携完了',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#C89B3C]/20 text-[#C89B3C] text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[#C8D8F0] text-sm">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* 機能一覧 */}
        <div className="bg-[#0D1117] border border-[#1E2A40] rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-[#8A9BB5] uppercase tracking-wider mb-4">
            主な機能
          </h2>
          <ul className="space-y-2">
            {[
              'チャンピオン選択画面のオーバーレイ表示',
              'LCU API によるリアルタイム統計',
              'サモナー情報・ゲームフロー状態の表示',
              '自動アップデート機能',
              'Web アカウントとの連携（プレミアム機能）',
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-[#C8D8F0]">
                <svg className="w-4 h-4 text-[#4CAF91] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* 注意事項 */}
        <div className="bg-[#1A1200] border border-[#C89B3C]/20 rounded-xl p-4">
          <p className="text-[#C89B3C] text-xs font-semibold mb-1">SmartScreen について</p>
          <p className="text-[#8A9BB5] text-xs leading-relaxed">
            初回インストール時に Windows SmartScreen の警告が表示される場合があります。
            「詳細情報」→「実行」をクリックしてインストールを続行してください。
          </p>
        </div>

      </div>
    </div>
  )
}
