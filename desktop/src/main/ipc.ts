/**
 * IPCハンドラー登録
 *
 * メインプロセスとレンダラー間の通信チャンネルを定義する。
 * セキュリティのため、すべての通信は ipcMain.handle() 経由で行う。
 */

import { ipcMain, app, shell, BrowserWindow } from 'electron'
import * as http from 'http'
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

  // ---------- LCU 拡張 ----------

  /** ランク統計を取得する */
  ipcMain.handle('lcu:getRankedStats', async () => {
    try {
      return await lcuClient.getRankedStats()
    } catch (err) {
      console.error('[IPC] lcu:getRankedStats エラー:', err)
      return null
    }
  })

  // ---------- アプリ拡張 ----------

  /** Windows スタートアップ登録/解除 */
  ipcMain.handle('app:setLoginItem', (_, enable: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enable })
  })

  /** ログフォルダを開く */
  ipcMain.handle('shell:openLogFolder', () => {
    shell.openPath(app.getPath('logs'))
  })

  // ---------- OAuth 共通 ----------

  type OAuthResult =
    | { token: string; refresh_token?: string; user?: { name?: string; is_premium?: boolean } }
    | { error: string }

  /**
   * ループバックサーバー方式でOAuth認証を行う共通処理
   * 1. ランダムポートでローカルHTTPサーバーを起動
   * 2. バックエンドからOAuth URLを取得（redirect_uri=ループバックURL）
   * 3. システムブラウザでOAuth URLを開く
   * 4. 認証後にループバックURLへリダイレクト → codeとstateを取得
   * 5. バックエンドでcodeをJWTに交換して返す
   */
  function startOAuthFlow(apiBase: string, provider: 'google' | 'discord'): Promise<OAuthResult> {
    return new Promise<OAuthResult>((resolve) => {
      const server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url ?? '/', 'http://localhost')
          const code = reqUrl.searchParams.get('code')
          const state = reqUrl.searchParams.get('state')
          const oauthError = reqUrl.searchParams.get('error')

          const success = !oauthError && !!code && !!state
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>force.gg</title>
<style>body{font-family:sans-serif;background:#0a0e1a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px;}h2{color:#c89b3c;margin:0;}p{color:#9ca3af;margin:0;}</style>
</head>
<body>
<h2>${success ? '認証完了！' : '認証に失敗しました'}</h2>
<p>${success ? 'このタブを閉じて force.gg に戻ってください。' : 'ブラウザを閉じてください。'}</p>
</body></html>`)

          server.close()

          if (!success) {
            resolve({ error: oauthError ?? '認証がキャンセルされました' })
            return
          }

          const tokenRes = await fetch(`${apiBase}/api/auth/oauth/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, code, state }),
          })

          if (!tokenRes.ok) {
            resolve({ error: `トークン取得に失敗しました (${tokenRes.status})` })
            return
          }

          resolve(await tokenRes.json() as OAuthResult)
        } catch {
          server.close()
          resolve({ error: 'ログイン処理中にエラーが発生しました' })
        }
      })

      server.on('error', () => resolve({ error: 'ローカルサーバーの起動に失敗しました' }))

      server.listen(0, '127.0.0.1', async () => {
        const { port } = server.address() as { port: number }
        const redirectUri = `http://127.0.0.1:${port}`

        try {
          const urlRes = await fetch(
            `${apiBase}/api/auth/oauth/${provider}/url?redirect_uri=${encodeURIComponent(redirectUri)}`
          )
          if (!urlRes.ok) {
            server.close()
            resolve({ error: 'OAuth URLの取得に失敗しました' })
            return
          }
          const { url } = await urlRes.json() as { url: string }
          shell.openExternal(url)
        } catch {
          server.close()
          resolve({ error: 'サーバーへの接続に失敗しました' })
        }
      })

      setTimeout(() => {
        server.close()
        resolve({ error: 'タイムアウトしました（5分）' })
      }, 5 * 60 * 1000)
    })
  }

  const API_BASE = process.env['VITE_API_BASE_URL'] ?? 'http://localhost:8000'

  ipcMain.handle('auth:googleLogin', () => startOAuthFlow(API_BASE, 'google'))

  ipcMain.handle('auth:discordLogin', () => startOAuthFlow(API_BASE, 'discord'))
}
