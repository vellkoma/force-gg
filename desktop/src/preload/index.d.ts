/**
 * window.electronAPI の型定義
 *
 * preload/index.ts で contextBridge を使って公開したAPIの型。
 * レンダラー側で TypeScript の補完が効くようにする。
 */

import type {
  ChampSelectSession,
  LcuSummoner,
  GameflowPhase,
  LcuRankedStats
} from '../types/lcu'

export interface FavoriteChampion {
  championId: number
  championName: string
}

export interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

export interface DownloadProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export interface GoogleLoginResult {
  token: string
  refresh_token?: string
  user?: { name?: string; is_premium?: boolean }
}

export interface GoogleLoginError {
  error: string
}

export interface ElectronAPI {
  auth: {
    googleLogin: () => Promise<GoogleLoginResult | GoogleLoginError>
    discordLogin: () => Promise<GoogleLoginResult | GoogleLoginError>
  }

  lcu: {
    connect: () => Promise<boolean>
    getChampSelect: () => Promise<ChampSelectSession | null>
    getSummoner: () => Promise<LcuSummoner | null>
    isInGame: () => Promise<boolean>
    getGameflowPhase: () => Promise<GameflowPhase | null>
    isConnected: () => Promise<boolean>
    getRankedStats: () => Promise<LcuRankedStats | null>
  }

  overlay: {
    show: () => Promise<void>
    hide: () => Promise<void>
  }

  app: {
    getVersion: () => Promise<string>
  }

  update: {
    check: () => Promise<unknown>
    download: () => Promise<void>
    install: () => Promise<void>
  }

  settings: {
    get: (key: string, defaultValue?: string) => Promise<string | undefined>
    set: (key: string, value: string) => Promise<void>
  }

  favorites: {
    list: () => Promise<FavoriteChampion[]>
    add: (championId: number, championName: string) => Promise<void>
    remove: (championId: number) => Promise<void>
  }

  system: {
    setLoginItem: (enable: boolean) => Promise<void>
    openLogFolder: () => Promise<void>
  }

  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }

  on: (channel: string, callback: (...args: unknown[]) => void) => void
  off: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
