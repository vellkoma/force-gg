/**
 * Preload スクリプト
 *
 * contextBridge を使用してメインプロセスのAPIを
 * レンダラープロセスに安全に公開する。
 *
 * セキュリティ原則:
 * - contextIsolation: true でレンダラーとNode.jsを完全に分離
 * - 公開するAPIは最小限にとどめる
 * - チャンネル名を明示的に許可リストで管理
 */

import { contextBridge, ipcRenderer } from 'electron'

// レンダラーから購読を許可するチャンネル（許可リスト）
const ALLOWED_CHANNELS = [
  'lcu:connectionChanged',
  'lcu:phaseChanged',
  'lcu:champSelectUpdate',
  'update:available',
  'update:notAvailable',
  'update:downloadProgress',
  'update:downloaded',
  'update:error'
] as const

type AllowedChannel = (typeof ALLOWED_CHANNELS)[number]

// window.electronAPI として公開するAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // ---------- LCU API ----------
  lcu: {
    /** LCUクライアントに接続する */
    connect: (): Promise<boolean> => ipcRenderer.invoke('lcu:connect'),

    /** チャンピオン選択セッションを取得する */
    getChampSelect: () => ipcRenderer.invoke('lcu:getChampSelect'),

    /** 現在のサモナー情報を取得する */
    getSummoner: () => ipcRenderer.invoke('lcu:getSummoner'),

    /** ゲーム中かどうかを確認する */
    isInGame: (): Promise<boolean> => ipcRenderer.invoke('lcu:isInGame'),

    /** 現在のゲームフローフェーズを取得する */
    getGameflowPhase: () => ipcRenderer.invoke('lcu:getGameflowPhase'),

    /** LCU接続状態を確認する */
    isConnected: (): Promise<boolean> => ipcRenderer.invoke('lcu:isConnected'),

    /** ランク統計を取得する */
    getRankedStats: () => ipcRenderer.invoke('lcu:getRankedStats')
  },

  // ---------- オーバーレイ ----------
  overlay: {
    /** オーバーレイウィンドウを表示する */
    show: (): Promise<void> => ipcRenderer.invoke('overlay:show'),

    /** オーバーレイウィンドウを非表示にする */
    hide: (): Promise<void> => ipcRenderer.invoke('overlay:hide')
  },

  // ---------- アプリ情報 ----------
  app: {
    /** アプリバージョンを取得する */
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },

  // ---------- アップデート ----------
  update: {
    /** アップデートを確認する */
    check: () => ipcRenderer.invoke('update:check'),

    /** アップデートをダウンロードする */
    download: (): Promise<void> => ipcRenderer.invoke('update:download'),

    /** ダウンロード完了後にインストールして再起動する */
    install: (): Promise<void> => ipcRenderer.invoke('update:install')
  },

  // ---------- 設定 ----------
  settings: {
    /** 設定値を取得する */
    get: (key: string, defaultValue?: string): Promise<string | undefined> =>
      ipcRenderer.invoke('settings:get', key, defaultValue),

    /** 設定値を保存する */
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value)
  },

  // ---------- お気に入りチャンピオン ----------
  favorites: {
    /** お気に入りチャンピオン一覧を取得する */
    list: () => ipcRenderer.invoke('favorites:list'),

    /** お気に入りチャンピオンを追加する */
    add: (championId: number, championName: string): Promise<void> =>
      ipcRenderer.invoke('favorites:add', championId, championName),

    /** お気に入りチャンピオンを削除する */
    remove: (championId: number): Promise<void> =>
      ipcRenderer.invoke('favorites:remove', championId)
  },

  // ---------- 認証 ----------
  auth: {
    /** Googleアカウントでログインする（システムブラウザ経由） */
    googleLogin: () => ipcRenderer.invoke('auth:googleLogin'),
    /** Discordアカウントでログインする（システムブラウザ経由） */
    discordLogin: () => ipcRenderer.invoke('auth:discordLogin'),
  },

  // ---------- アプリ拡張 ----------
  system: {
    setLoginItem: (enable: boolean): Promise<void> =>
      ipcRenderer.invoke('app:setLoginItem', enable),
    openLogFolder: (): Promise<void> => ipcRenderer.invoke('shell:openLogFolder')
  },

  // ---------- ウィンドウ操作 ----------
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close')
  },

  // ---------- イベント購読 ----------

  /**
   * メインプロセスからのイベントを購読する
   * 許可リストにないチャンネルは無視する
   */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    if (ALLOWED_CHANNELS.includes(channel as AllowedChannel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args))
    }
  },

  /**
   * イベント購読を解除する
   * 許可リストにないチャンネルは無視する
   */
  off: (channel: string): void => {
    if (ALLOWED_CHANNELS.includes(channel as AllowedChannel)) {
      ipcRenderer.removeAllListeners(channel)
    }
  }
})
