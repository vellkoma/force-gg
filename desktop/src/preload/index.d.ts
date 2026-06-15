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
  LcuRankedStats,
  LcuReadyCheck
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

export interface LcuMatchGame {
  gameId: number
  gameCreation: number
  gameDuration: number
  gameMode: string
  queueId: number
  participants: Array<{
    participantId: number
    teamId: number
    championId: number
    spell1Id: number
    spell2Id: number
    stats: {
      win: boolean
      kills: number
      deaths: number
      assists: number
      item0: number
      item1: number
      item2: number
      item3: number
      item4: number
      item5: number
      item6: number
      totalDamageDealtToChampions: number
      goldEarned: number
      totalMinionsKilled: number
      neutralMinionsKilled: number
      visionScore: number
      champLevel: number
      playerAugment1?: number
      playerAugment2?: number
      playerAugment3?: number
      playerAugment4?: number
    }
  }>
  participantIdentities: Array<{
    participantId: number
    player: {
      puuid: string
      gameName: string
      tagLine: string
      summonerName: string
    }
  }>
  teams: Array<{ teamId: number; win: string }>
}

export interface GoogleLoginResult {
  token: string
  refresh_token?: string
  user?: { name?: string; is_premium?: boolean }
}

export interface GoogleLoginError {
  error: string
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
  error?: string
}

export interface ElectronAPI {
  api: {
    request: <T = unknown>(opts: {
      path: string
      method?: string
      headers?: Record<string, string>
      body?: string
    }) => Promise<ApiResponse<T>>
  }

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
    getReadyCheck: () => Promise<LcuReadyCheck | null>
    acceptMatch: () => Promise<void>
    declineMatch: () => Promise<void>
    getMasteryList: () => Promise<Array<{ championId: number; championPoints: number; championLevel: number; lastPlayTime: number }> | null>
    getHonorIconDataUrl: (level: number) => Promise<string | null>
    getHonorProfile: () => Promise<{ honorLevel: number; checkpoint: number } | null>
    getMasteryScore: (summonerId: number, puuid: string) => Promise<{ totalScore: number; top3: Array<{ championId: number; championPoints: number }> } | null>
    getMatchHistory: (puuid: string) => Promise<LcuMatchGame[]>
    getMatchDetail: (gameId: number) => Promise<LcuMatchGame | null>
    fetchAugments: () => Promise<Array<{ id: number; iconSmall?: string; nameId?: string; name?: string; description?: string }>>
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
