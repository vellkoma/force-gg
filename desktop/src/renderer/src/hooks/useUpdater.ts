/**
 * アップデート状態管理フック
 *
 * electron-updater のイベントを購読し、アップデートの状態と
 * アクション（確認・ダウンロード・インストール）を提供する。
 */

import { useState, useEffect, useCallback } from 'react'

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

interface UseUpdaterReturn {
  /** 新しいバージョンが利用可能か */
  updateAvailable: boolean
  /** ダウンロード中か */
  downloading: boolean
  /** ダウンロード進捗 (0-100) */
  downloadProgress: number
  /** ダウンロード完了してインストール待ちか */
  updateReady: boolean
  /** 利用可能なアップデート情報 */
  updateInfo: UpdateInfo | null
  /** エラーメッセージ */
  error: string | null
  /** アップデートを手動で確認する */
  checkUpdate: () => Promise<void>
  /** アップデートをダウンロードする */
  downloadUpdate: () => Promise<void>
  /** インストールして再起動する */
  installUpdate: () => Promise<void>
}

export function useUpdater(): UseUpdaterReturn {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateReady, setUpdateReady] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // アップデート利用可能
    window.electronAPI.on('update:available', (...args) => {
      const info = args[0] as UpdateInfo | undefined
      setUpdateAvailable(true)
      setUpdateInfo(info ?? null)
      setError(null)
    })

    // アップデートなし
    window.electronAPI.on('update:notAvailable', () => {
      setUpdateAvailable(false)
      setUpdateInfo(null)
    })

    // ダウンロード進捗
    window.electronAPI.on('update:downloadProgress', (...args) => {
      const progress = args[0] as { percent: number } | undefined
      setDownloading(true)
      setDownloadProgress(Math.round(progress?.percent ?? 0))
    })

    // ダウンロード完了
    window.electronAPI.on('update:downloaded', (...args) => {
      const info = args[0] as UpdateInfo | undefined
      setDownloading(false)
      setDownloadProgress(100)
      setUpdateReady(true)
      if (info) setUpdateInfo(info)
    })

    // エラー
    window.electronAPI.on('update:error', (...args) => {
      const err = args[0] as Error | string | undefined
      const message = err instanceof Error ? err.message : String(err ?? 'アップデートエラーが発生しました')
      setError(message)
      setDownloading(false)
    })

    return () => {
      window.electronAPI.off('update:available')
      window.electronAPI.off('update:notAvailable')
      window.electronAPI.off('update:downloadProgress')
      window.electronAPI.off('update:downloaded')
      window.electronAPI.off('update:error')
    }
  }, [])

  const checkUpdate = useCallback(async () => {
    try {
      setError(null)
      await window.electronAPI.update.check()
    } catch (err) {
      setError('アップデートの確認に失敗しました')
    }
  }, [])

  const downloadUpdate = useCallback(async () => {
    try {
      setError(null)
      setDownloading(true)
      setDownloadProgress(0)
      await window.electronAPI.update.download()
    } catch (err) {
      setError('ダウンロードに失敗しました')
      setDownloading(false)
    }
  }, [])

  const installUpdate = useCallback(async () => {
    await window.electronAPI.update.install()
  }, [])

  return {
    updateAvailable,
    downloading,
    downloadProgress,
    updateReady,
    updateInfo,
    error,
    checkUpdate,
    downloadUpdate,
    installUpdate
  }
}
