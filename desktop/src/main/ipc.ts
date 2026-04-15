/**
 * IPCハンドラー登録
 *
 * メインプロセスとレンダラー間の通信チャンネルを定義する。
 * セキュリティのため、すべての通信は ipcMain.handle() 経由で行う。
 */

import { ipcMain, app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { lcuClient } from './lcu'
import { showOverlay, hideOverlay } from './overlay'
import {
  getSetting,
  setSetting,
  getFavoriteChampions,
  addFavoriteChampion,
  removeFavoriteChampion
} from './db'

/**
 * すべてのIPCハンドラーを登録する
 * main/index.ts の app.whenReady() 内で呼び出す
 */
export function registerIpcHandlers(): void {
  // ---------- LCU API ----------

  /** LCUクライアントに接続する */
  ipcMain.handle('lcu:connect', async () => {
    try {
      return await lcuClient.connect()
    } catch (err) {
      console.error('[IPC] lcu:connect エラー:', err)
      return false
    }
  })

  /** チャンピオン選択セッションを取得する */
  ipcMain.handle('lcu:getChampSelect', async () => {
    try {
      return await lcuClient.getChampSelectSession()
    } catch (err) {
      console.error('[IPC] lcu:getChampSelect エラー:', err)
      return null
    }
  })

  /** 現在のサモナー情報を取得する */
  ipcMain.handle('lcu:getSummoner', async () => {
    try {
      return await lcuClient.getCurrentSummoner()
    } catch (err) {
      console.error('[IPC] lcu:getSummoner エラー:', err)
      return null
    }
  })

  /** ゲーム中かどうかを確認する */
  ipcMain.handle('lcu:isInGame', async () => {
    try {
      return await lcuClient.isInGame()
    } catch (err) {
      console.error('[IPC] lcu:isInGame エラー:', err)
      return false
    }
  })

  /** 現在のゲームフローフェーズを取得する */
  ipcMain.handle('lcu:getGameflowPhase', async () => {
    try {
      return await lcuClient.getGameflowPhase()
    } catch (err) {
      console.error('[IPC] lcu:getGameflowPhase エラー:', err)
      return null
    }
  })

  /** LCU接続状態を確認する */
  ipcMain.handle('lcu:isConnected', () => {
    return lcuClient.isConnected()
  })

  // ---------- オーバーレイ ----------

  /** オーバーレイウィンドウを表示する */
  ipcMain.handle('overlay:show', () => {
    showOverlay()
  })

  /** オーバーレイウィンドウを非表示にする */
  ipcMain.handle('overlay:hide', () => {
    hideOverlay()
  })

  // ---------- アプリ情報 ----------

  /** アプリバージョンを取得する */
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  // ---------- アップデート ----------

  /** アップデートを確認する */
  ipcMain.handle('update:check', async () => {
    try {
      return await autoUpdater.checkForUpdates()
    } catch (err) {
      console.error('[IPC] update:check エラー:', err)
      return null
    }
  })

  /** アップデートをダウンロードする */
  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      console.error('[IPC] update:download エラー:', err)
    }
  })

  /** ダウンロード完了後にインストールして再起動する */
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  // ---------- 設定 ----------

  /** 設定値を取得する */
  ipcMain.handle('settings:get', (_, key: string, defaultValue?: string) => {
    return getSetting(key, defaultValue)
  })

  /** 設定値を保存する */
  ipcMain.handle('settings:set', (_, key: string, value: string) => {
    setSetting(key, value)
  })

  // ---------- お気に入りチャンピオン ----------

  /** お気に入りチャンピオン一覧を取得する */
  ipcMain.handle('favorites:list', () => {
    return getFavoriteChampions()
  })

  /** お気に入りチャンピオンを追加する */
  ipcMain.handle('favorites:add', (_, championId: number, championName: string) => {
    addFavoriteChampion(championId, championName)
  })

  /** お気に入りチャンピオンを削除する */
  ipcMain.handle('favorites:remove', (_, championId: number) => {
    removeFavoriteChampion(championId)
  })

  // ---------- ウィンドウ操作 ----------

  /** メインウィンドウを最小化する */
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  /** メインウィンドウを最大化/元に戻す */
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  /** メインウィンドウを閉じる */
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}
