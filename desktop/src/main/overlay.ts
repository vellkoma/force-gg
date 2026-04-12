/**
 * オーバーレイウィンドウの作成・管理
 *
 * チャンピオン選択中にLoLクライアントの上に重ねて表示する
 * 透明フレームなしウィンドウ。
 */

import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let overlayWindow: BrowserWindow | null = null

/**
 * オーバーレイウィンドウを作成して返す
 */
export function createOverlayWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 400,
    height: 600,
    // 画面右端に配置
    x: screenWidth - 410,
    y: Math.floor((screenHeight - 600) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false, // ゲームの操作を邪魔しない
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, '../preload/index.js')
    }
  })

  // 開発時はViteのdev serverから、本番時はビルド済みファイルからロード
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/overlay.html'))
  }

  // ウィンドウが閉じられたときにnullにする
  win.on('closed', () => {
    overlayWindow = null
  })

  overlayWindow = win
  return win
}

/**
 * オーバーレイウィンドウを表示する
 */
export function showOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    overlayWindow = createOverlayWindow()
  }
  overlayWindow.show()
}

/**
 * オーバーレイウィンドウを非表示にする
 */
export function hideOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
}

/**
 * オーバーレイウィンドウにデータを送信する
 */
export function sendToOverlay(channel: string, data: unknown): void {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
    overlayWindow.webContents.send(channel, data)
  }
}

/**
 * 現在のオーバーレイウィンドウインスタンスを返す
 */
export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}
