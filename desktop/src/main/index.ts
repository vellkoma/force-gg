/**
 * Electron メインプロセス エントリポイント
 *
 * アプリウィンドウの作成・管理、LCU監視ループ、
 * アップデーター設定などを行う。
 */

import { app, BrowserWindow, Menu, shell, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { initDatabase, closeDatabase, getSetting, setSetting } from './db'
import { registerIpcHandlers } from './ipc'
import { lcuClient } from './lcu'
import { sendToOverlay } from './overlay'

// ウィンドウ状態の型
interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

let mainWindow: BrowserWindow | null = null

// ---------- ウィンドウ状態の保存・復元 ----------

function loadWindowState(): WindowState {
  try {
    const saved = getSetting('windowState')
    if (saved) {
      return JSON.parse(saved) as WindowState
    }
  } catch {
    // 読み込み失敗時はデフォルト値を使用
  }
  return { width: 1280, height: 720, isMaximized: false }
}

function saveWindowState(win: BrowserWindow): void {
  const isMaximized = win.isMaximized()
  const bounds = win.getBounds()
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized
  }
  setSetting('windowState', JSON.stringify(state))
}

// ---------- メインウィンドウ作成 ----------

function createMainWindow(): BrowserWindow {
  const savedState = loadWindowState()

  const win = new BrowserWindow({
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,          // カスタムタイトルバーを使用
    backgroundColor: '#060a12',
    webPreferences: {
      contextIsolation: true,   // セキュリティ必須
      nodeIntegration: false,   // セキュリティ必須
      sandbox: true,            // サンドボックス必須
      webSecurity: true,        // 本番では必ず有効
      preload: join(__dirname, '../preload/index.js')
    }
  })

  // 保存された最大化状態を復元
  if (savedState.isMaximized) {
    win.maximize()
  }

  // 準備できてから表示（白いフラッシュを防ぐ）
  win.once('ready-to-show', () => {
    win.show()
  })

  // ウィンドウ状態の変化を保存
  win.on('close', () => {
    saveWindowState(win)
  })

  // 外部リンクはデフォルトブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // 開発時はViteのdev serverから、本番時はビルド済みファイルからロード
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
  return win
}

// ---------- アプリケーションメニュー（日本語） ----------

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'force.gg',
      submenu: [
        { label: 'バージョン情報', role: 'about' },
        { type: 'separator' },
        {
          label: 'アップデートを確認',
          click: () => autoUpdater.checkForUpdates()
        },
        { type: 'separator' },
        { label: '終了', accelerator: 'Alt+F4', role: 'quit' }
      ]
    },
    {
      label: '表示',
      submenu: [
        { label: '再読み込み', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        {
          label: '強制再読み込み',
          accelerator: 'CmdOrCtrl+Shift+R',
          role: 'forceReload'
        },
        { type: 'separator' },
        { label: '拡大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '縮小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '標準サイズ', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全画面表示', role: 'togglefullscreen' },
        ...(is.dev
          ? [
              { type: 'separator' as const },
              {
                label: '開発者ツール',
                accelerator: 'F12',
                role: 'toggleDevTools' as const
              }
            ]
          : [])
      ]
    },
    {
      label: 'ウィンドウ',
      submenu: [
        { label: '最小化', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: '閉じる', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: '公式サイト',
          click: () => shell.openExternal('https://force.gg')
        },
        {
          label: 'フィードバック',
          click: () => shell.openExternal('https://github.com/vellkoma/force-gg/issues')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------- LCU 定期ポーリング ----------

let lcuPollingInterval: NodeJS.Timeout | null = null

/**
 * 5秒ごとにLCUの状態をチェックしてレンダラーに通知する
 */
function startLcuPolling(): void {
  if (lcuPollingInterval) return

  lcuPollingInterval = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return

    // まず接続確認
    if (!lcuClient.isConnected()) {
      const connected = await lcuClient.connect()
      mainWindow.webContents.send('lcu:connectionChanged', connected)
      if (!connected) return
    }

    // ゲームフローフェーズを確認
    try {
      const phase = await lcuClient.getGameflowPhase()
      mainWindow.webContents.send('lcu:phaseChanged', phase)

      // チャンピオン選択中はセッション情報もプッシュ
      if (phase === 'ChampSelect') {
        const session = await lcuClient.getChampSelectSession()
        if (session) {
          mainWindow.webContents.send('lcu:champSelectUpdate', session)
          sendToOverlay('lcu:champSelectUpdate', session)
        }
      }
    } catch {
      // 接続が切れた場合
      lcuClient.disconnect()
      mainWindow.webContents.send('lcu:connectionChanged', false)
    }
  }, 5000)
}

function stopLcuPolling(): void {
  if (lcuPollingInterval) {
    clearInterval(lcuPollingInterval)
    lcuPollingInterval = null
  }
}

// ---------- 自動アップデーター設定 ----------

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', info)
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update:notAvailable')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:downloadProgress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] エラー:', err)
    mainWindow?.webContents.send('update:error', err.message)
  })
}

// ---------- アプリライフサイクル ----------

app.whenReady().then(() => {
  // Electronのセキュリティ設定
  electronApp.setAppUserModelId('gg.force.desktop')

  // 開発ツールショートカット（開発時のみ）
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ダークテーマを強制（LoLのUIに合わせる）
  nativeTheme.themeSource = 'dark'

  // データベース初期化
  initDatabase()

  // IPCハンドラー登録
  registerIpcHandlers()

  // メニュー構築
  buildMenu()

  // メインウィンドウ作成
  createMainWindow()

  // 自動アップデーター設定
  setupAutoUpdater()

  // LCU初回接続試行
  lcuClient.connect().then((connected) => {
    mainWindow?.webContents.send('lcu:connectionChanged', connected)
  })

  // LCUポーリング開始
  startLcuPolling()

  // macOSでは Dock クリックで再作成
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// 全ウィンドウが閉じられたら終了（macOS除く）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopLcuPolling()
    closeDatabase()
    app.quit()
  }
})

app.on('before-quit', () => {
  stopLcuPolling()
  closeDatabase()
})

export { mainWindow }
