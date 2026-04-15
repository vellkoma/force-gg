/**
 * アップデート通知バナー
 *
 * useUpdater フックから受け取った状態に応じて以下の表示を切り替える:
 * - updateAvailable: 新バージョン利用可能 + ダウンロードボタン
 * - downloading: ダウンロード中プログレスバー
 * - updateReady: インストール確認 + 再起動ボタン
 */

import type { FC } from 'react'
import type { useUpdater } from '../hooks/useUpdater'

type UpdaterState = ReturnType<typeof useUpdater>

interface UpdateBannerProps {
  updater: UpdaterState
}

export const UpdateBanner: FC<UpdateBannerProps> = ({ updater }) => {
  const {
    updateAvailable,
    downloading,
    downloadProgress,
    updateReady,
    updateInfo,
    error,
    downloadUpdate,
    installUpdate
  } = updater

  // いずれの状態でもない場合は何も表示しない
  if (!updateAvailable && !downloading && !updateReady && !error) {
    return null
  }

  return (
    <div className="bg-[#0f1923] border-b border-[#c89b3c] px-6 py-3">
      {/* エラー表示 */}
      {error && (
        <div className="flex items-center gap-3">
          <span className="text-red-400 text-sm font-medium">{error}</span>
        </div>
      )}

      {/* ダウンロード完了 — インストール待ち */}
      {!error && updateReady && (
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white text-sm font-medium">
              ダウンロード完了。再起動してインストールしますか？
            </span>
            {updateInfo?.version && (
              <span className="text-[#c89b3c] text-sm ml-2">v{updateInfo.version}</span>
            )}
          </div>
          <button
            onClick={installUpdate}
            className="px-4 py-1.5 bg-[#c89b3c] hover:bg-[#d4a94a] text-black font-semibold rounded text-sm transition-colors shrink-0 ml-4"
          >
            今すぐ再起動
          </button>
        </div>
      )}

      {/* ダウンロード中 — プログレスバー */}
      {!error && !updateReady && downloading && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-medium">アップデートをダウンロード中...</span>
            <span className="text-[#c89b3c] text-sm font-mono">{downloadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#1e2a3a] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c89b3c] rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* アップデート利用可能 — ダウンロードボタン */}
      {!error && !updateReady && !downloading && updateAvailable && (
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white text-sm font-medium">
              新しいバージョンが利用可能です
            </span>
            {updateInfo?.version && (
              <span className="text-[#c89b3c] text-sm ml-2">v{updateInfo.version}</span>
            )}
          </div>
          <button
            onClick={downloadUpdate}
            className="px-4 py-1.5 bg-[#c89b3c] hover:bg-[#d4a94a] text-black font-semibold rounded text-sm transition-colors shrink-0 ml-4"
          >
            ダウンロード
          </button>
        </div>
      )}
    </div>
  )
}
