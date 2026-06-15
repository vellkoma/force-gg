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

  /** マッチ承認画面の情報を取得する */
  ipcMain.handle('lcu:getReadyCheck', async () => {
    try {
      return await lcuClient.getReadyCheck()
    } catch (err) {
      console.error('[IPC] lcu:getReadyCheck エラー:', err)
      return null
    }
  })

  /** マッチを承認する */
  ipcMain.handle('lcu:acceptMatch', async () => {
    try {
      await lcuClient.acceptMatch()
    } catch (err) {
      console.error('[IPC] lcu:acceptMatch エラー:', err)
    }
  })

  /** マッチを拒否する */
  ipcMain.handle('lcu:declineMatch', async () => {
    try {
      await lcuClient.declineMatch()
    } catch (err) {
      console.error('[IPC] lcu:declineMatch エラー:', err)
    }
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

  /** LCU内部マッチ履歴からqueueIdを取得する */
  ipcMain.handle('lcu:getMatchHistory', async (_, puuid: string) => {
    try {
      return await lcuClient.getLcuMatchHistory(puuid, 30)
    } catch (err) {
      console.error('[IPC] lcu:getMatchHistory エラー:', err)
      return []
    }
  })

  /** チャンピオンマスタリー全リストを取得する */
  ipcMain.handle('lcu:getMasteryList', async () => {
    try {
      return await lcuClient.getMasteryList()
    } catch (err) {
      console.error('[IPC] lcu:getMasteryList エラー:', err)
      return null
    }
  })

  /** 名誉レベルアイコンを base64 データ URL で取得する */
  ipcMain.handle('lcu:getHonorIconDataUrl', async (_, level: number) => {
    try {
      return await lcuClient.getHonorIconDataUrl(level)
    } catch (err) {
      console.error('[IPC] lcu:getHonorIconDataUrl エラー:', err)
      return null
    }
  })

  /** 名誉プロフィールを取得する */
  ipcMain.handle('lcu:getHonorProfile', async () => {
    try {
      return await lcuClient.getHonorProfile()
    } catch (err) {
      console.error('[IPC] lcu:getHonorProfile エラー:', err)
      return null
    }
  })

  /** チャンピオンマスタリースコアを取得する */
  ipcMain.handle('lcu:getMasteryScore', async (_, summonerId: number, puuid: string) => {
    try {
      return await lcuClient.getMasteryScore(summonerId, puuid)
    } catch (err) {
      console.error('[IPC] lcu:getMasteryScore エラー:', err)
      return null
    }
  })

  /** LCU個別試合の全参加者データを取得する */
  ipcMain.handle('lcu:getMatchDetail', async (_, gameId: number) => {
    try {
      return await lcuClient.getLcuMatchDetail(gameId)
    } catch (err) {
      console.error('[IPC] lcu:getMatchDetail エラー:', err)
      return null
    }
  })

  /** オーグメント一覧を LCU から取得して CDragon アイコン URL に変換する */
  ipcMain.handle('lcu:fetchAugments', async () => {
    // LCUパスをCDragonのURLに変換する
    // 例: /lol-game-data/assets/ASSETS/UX/Cherry/Augments/Icons/x_small.png
    //  → https://raw.communitydragon.org/latest/game/assets/ux/cherry/augments/icons/x_small.png
    function lcuPathToCDragon(lcuPath: string): string {
      const withoutPrefix = lcuPath.replace(/^\/lol-game-data\/assets\//i, '')
      return `https://raw.communitydragon.org/latest/game/${withoutPrefix.toLowerCase()}`
    }

    // LCUから取得（正しいゲーム内IDを持つ）
    try {
      type LcuAugment = {
        id: number
        augmentSmallIconPath?: string
        nameId?: string
        augmentNameId?: string
        nameTRA?: string
        descriptionTRA?: string
        augmentDescriptionTRA?: string
        tooltipTRA?: string
      }
      const data = await lcuClient.get<LcuAugment[]>('/lol-game-data/assets/v1/cherry-augments.json')
      if (Array.isArray(data)) {
        return data.map((a) => ({
          id: a.id,
          iconSmall: a.augmentSmallIconPath ? lcuPathToCDragon(a.augmentSmallIconPath) : undefined,
          nameId: a.augmentNameId ?? a.nameId,
          name: a.nameTRA,
          description: a.descriptionTRA ?? a.augmentDescriptionTRA ?? a.tooltipTRA,
        }))
      }
    } catch (e) {
      console.warn('[fetchAugments] LCU取得失敗、CDragonにフォールバック:', e)
    }

    // LCU未接続時はCDragonから取得（旧形式・IDが異なるが一応返す）
    try {
      const r = await fetch('https://raw.communitydragon.org/latest/cdragon/arena/en_us.json')
      if (!r.ok) return []
      const data = await r.json()
      return Array.isArray(data) ? data : (data as { augments?: unknown[] }).augments ?? []
    } catch {
      return []
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

          // OAuthコールバック以外のリクエスト（favicon等）は無視する
          if (!code && !state && !oauthError) {
            res.writeHead(204)
            res.end()
            return
          }

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

  const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

  ipcMain.handle('auth:googleLogin', () => startOAuthFlow(API_BASE, 'google'))

  ipcMain.handle('auth:discordLogin', () => startOAuthFlow(API_BASE, 'discord'))

  // ---------- API プロキシ（CORS 回避のためメインプロセス経由）----------

  ipcMain.handle('api:request', async (
    _,
    { path, method = 'GET', headers = {}, body }: {
      path: string
      method?: string
      headers?: Record<string, string>
      body?: string
    }
  ) => {
    const url = `${API_BASE}${path}`
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
      })
      const status = res.status
      let data: unknown = null
      let rawText = ''
      try {
        rawText = await res.text()
        data = JSON.parse(rawText)
      } catch { data = rawText || null }

      if (!res.ok) {
        if (status === 404) {
          console.debug(`[IPC] api:request 404 ${url}`)
        } else {
          console.error(`[IPC] api:request HTTP ${status} ${url}:`, rawText.slice(0, 200))
        }
        return { ok: false, status, data, error: rawText.slice(0, 200) }
      }
      return { ok: true, status, data }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[IPC] api:request エラー ${url}:`, msg)
      return { ok: false, status: 0, data: null, error: `${url} → ${msg}` }
    }
  })
}
