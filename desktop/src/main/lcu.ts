/**
 * LCU (League Client Update) API クライアント
 *
 * LoLクライアントと通信するローカルAPIの実装。
 * Windowsのwmicコマンドでプロセス情報からポート/パスワードを取得し、
 * 自己署名証明書のlocalhost HTTPSエンドポイントと通信する。
 */

import { execSync } from 'child_process'
import https from 'https'
import http from 'http'
import type {
  LcuCredentials,
  ChampSelectSession,
  LcuSummoner,
  GameflowPhase,
  LcuRankedStats,
  LcuReadyCheck
} from '../types/lcu'

// 自己署名証明書を許可するHTTPSエージェント（localhostのみ）
const lcuAgent = new https.Agent({ rejectUnauthorized: false })

/**
 * LoLクライアントプロセスのコマンドライン引数から
 * ポート番号と認証トークンを取得する
 */
function getLcuCredentialsFromProcess(): LcuCredentials | null {
  try {
    // LeagueClientUx.exe のコマンドライン引数を取得
    const output = execSync(
      'wmic PROCESS WHERE name="LeagueClientUx.exe" GET commandline',
      { encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    )

    const portMatch = output.match(/--app-port=(\d+)/)
    const tokenMatch = output.match(/--remoting-auth-token=([\w-]+)/)

    if (!portMatch || !tokenMatch) {
      return null
    }

    return {
      port: parseInt(portMatch[1], 10),
      password: tokenMatch[1],
      protocol: 'https'
    }
  } catch {
    // wmicが失敗した場合（LoLが起動していないなど）
    return null
  }
}

export class LcuClient {
  private credentials: LcuCredentials | null = null
  private baseURL = ''
  private authHeader = ''

  /**
   * LCUクライアントを接続状態にする
   * @returns 接続成功したかどうか
   */
  async connect(): Promise<boolean> {
    const creds = getLcuCredentialsFromProcess()
    if (!creds) {
      this.credentials = null
      return false
    }

    this.credentials = creds
    this.baseURL = `https://127.0.0.1:${creds.port}`
    this.authHeader = `Basic ${Buffer.from(`riot:${creds.password}`).toString('base64')}`

    // 接続確認として summoner 情報を取得してみる
    try {
      await this.get('/lol-summoner/v1/current-summoner')
      return true
    } catch {
      this.credentials = null
      return false
    }
  }

  /**
   * 接続状態かどうかを返す
   */
  isConnected(): boolean {
    return this.credentials !== null
  }

  /**
   * LCU APIへのGETリクエスト
   */
  async get<T>(path: string): Promise<T> {
    if (!this.credentials) {
      throw new Error('LCUクライアントが接続されていません')
    }

    return new Promise<T>((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: '127.0.0.1',
        port: this.credentials!.port,
        path,
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/json'
        },
        agent: lcuAgent,
        timeout: 5000
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            if (res.statusCode === 404) {
              resolve(null as unknown as T)
              return
            }
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`LCU API エラー: ${res.statusCode} ${path}`))
              return
            }
            resolve(JSON.parse(data) as T)
          } catch {
            reject(new Error(`JSONパースエラー: ${data}`))
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('LCU API タイムアウト'))
      })

      req.end()
    })
  }

  /**
   * LCU APIへのPOSTリクエスト
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    if (!this.credentials) {
      throw new Error('LCUクライアントが接続されていません')
    }

    const bodyStr = body !== undefined ? JSON.stringify(body) : ''

    return new Promise<T>((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: '127.0.0.1',
        port: this.credentials!.port,
        path,
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          Accept: 'application/json'
        },
        agent: lcuAgent,
        timeout: 5000
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`LCU API エラー: ${res.statusCode} ${path}`))
              return
            }
            resolve(data ? (JSON.parse(data) as T) : (undefined as unknown as T))
          } catch {
            reject(new Error(`JSONパースエラー: ${data}`))
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('LCU API タイムアウト'))
      })

      if (bodyStr) {
        req.write(bodyStr)
      }
      req.end()
    })
  }

  /**
   * チャンピオン選択セッションを取得する
   * チャンピオン選択中でない場合は null を返す
   */
  async getChampSelectSession(): Promise<ChampSelectSession | null> {
    try {
      const session = await this.get<ChampSelectSession>('/lol-champ-select/v1/session')
      return session
    } catch {
      return null
    }
  }

  /**
   * 現在ゲーム中かどうかを確認する
   */
  async isInGame(): Promise<boolean> {
    try {
      const phase = await this.get<GameflowPhase>('/lol-gameflow/v1/gameflow-phase')
      return phase === 'InProgress'
    } catch {
      return false
    }
  }

  /**
   * 現在のゲームフローフェーズを取得する
   */
  async getGameflowPhase(): Promise<GameflowPhase | null> {
    try {
      return await this.get<GameflowPhase>('/lol-gameflow/v1/gameflow-phase')
    } catch {
      return null
    }
  }

  /**
   * 現在ログイン中のサモナー情報を取得する
   */
  async getCurrentSummoner(): Promise<LcuSummoner> {
    return this.get<LcuSummoner>('/lol-summoner/v1/current-summoner')
  }

  /**
   * ランク統計を取得する
   */
  async getRankedStats(): Promise<LcuRankedStats | null> {
    try {
      return await this.get<LcuRankedStats>('/lol-ranked/v1/current-ranked-stats')
    } catch {
      return null
    }
  }

  /**
   * マッチ承認画面の情報を取得する
   */
  async getReadyCheck(): Promise<LcuReadyCheck | null> {
    try {
      return await this.get<LcuReadyCheck>('/lol-matchmaking/v1/ready-check')
    } catch {
      return null
    }
  }

  /**
   * マッチを承認する
   */
  async acceptMatch(): Promise<void> {
    await this.post('/lol-matchmaking/v1/ready-check/accept')
  }

  /**
   * マッチを拒否する
   */
  async declineMatch(): Promise<void> {
    await this.post('/lol-matchmaking/v1/ready-check/decline')
  }

  /**
   * LCU内部マッチ履歴から直近の試合をフル participant データで取得する
   */
  async getLcuMatchHistory(puuid: string, count = 30): Promise<LcuMatchGame[]> {
    try {
      const res = await this.get<{
        games: { games: LcuMatchGame[] }
      }>(
        `/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=0&endIndex=${count - 1}`
      )
      return res?.games?.games ?? []
    } catch {
      return []
    }
  }

  /** 個別試合の全参加者データを取得する（match list は自プレイヤーのみのため） */
  async getLcuMatchDetail(gameId: number): Promise<LcuMatchGame | null> {
    try {
      return await this.get<LcuMatchGame>(`/lol-match-history/v1/games/${gameId}`)
    } catch {
      return null
    }
  }

  /** 名誉プロフィールを取得する */
  async getHonorProfile(): Promise<{ honorLevel: number; checkpoint: number } | null> {
    try {
      return await this.get<{ honorLevel: number; checkpoint: number }>('/lol-honor-v2/v1/profile')
    } catch {
      return null
    }
  }

  /** 名誉レベルアイコンを LCU またはCommunityDragon CDNから取得して base64 データ URL で返す */
  async getHonorIconDataUrl(level: number): Promise<string | null> {
    // LCU ゲームデータ上で試す候補パス
    const lcuCandidates = this.credentials ? [
      `/lol-game-data/assets/v1/honor-icon/${level}`,
      `/lol-honor-v2/v1/honor-icon/${level}`,
      `/lol-game-data/assets/ASSETS/Loadouts/HonorEmblems/Emblem_Level_${level}_Shadow.png`,
      `/lol-game-data/assets/ASSETS/Loadouts/HonorEmblems/HonorEmblems_Medallion_Level${level}.png`,
      `/lol-game-data/assets/ASSETS/Loadouts/HonorEmblems/Emblem_Level_${level}.png`,
    ] : []

    for (const path of lcuCandidates) {
      try {
        const dataUrl = await new Promise<string | null>((resolve) => {
          const options: https.RequestOptions = {
            hostname: '127.0.0.1',
            port: this.credentials!.port,
            path,
            method: 'GET',
            headers: { Authorization: this.authHeader, Accept: 'image/png,image/*' },
            agent: lcuAgent,
            timeout: 3000,
          }
          const r = https.request(options, (res) => {
            if (!res.statusCode || res.statusCode >= 400) {
              res.resume()
              resolve(null)
              return
            }
            const chunks: Buffer[] = []
            res.on('data', (c: Buffer) => chunks.push(c))
            res.on('end', () => {
              const b64 = Buffer.concat(chunks).toString('base64')
              resolve(`data:image/png;base64,${b64}`)
            })
          })
          r.on('error', () => resolve(null))
          r.on('timeout', () => { r.destroy(); resolve(null) })
          r.end()
        })
        if (dataUrl) {
          console.log(`[LCU] honor icon found via LCU: ${path}`)
          return dataUrl
        }
      } catch { /* 次を試す */ }
    }

    // CommunityDragon CDN からフォールバック取得（メインプロセスなので CORS 制約なし）
    const cdnCandidates = [
      `https://raw.communitydragon.org/latest/game/assets/loadouts/honoremblems/emblem_level_${level}_shadow.png`,
      `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-honor-v2/global/default/honor-${level}.png`,
      `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-honor-v2/global/default/honor-level-${level}.png`,
    ]

    for (const url of cdnCandidates) {
      try {
        const res = await fetch(url)
        if (res.ok) {
          const buf = await res.arrayBuffer()
          const b64 = Buffer.from(buf).toString('base64')
          const mime = res.headers.get('content-type') ?? 'image/png'
          console.log(`[LCU] honor icon found via CDN: ${url}`)
          return `data:${mime};base64,${b64}`
        }
      } catch { /* 次を試す */ }
    }

    console.log(`[LCU] honor icon not found for level ${level}`)
    return null
  }

  /** チャンピオンマスタリー全リストを取得する */
  async getMasteryList(): Promise<Array<{
    championId: number
    championPoints: number
    championLevel: number
    lastPlayTime: number
  }> | null> {
    try {
      return await this.get('/lol-champion-mastery/v1/local-player/champion-mastery')
    } catch {
      return null
    }
  }

  /** チャンピオンマスタリー情報（合計スコア + トップ3）を取得する */
  async getMasteryScore(_summonerId: number, _puuid: string): Promise<{
    totalScore: number
    top3: Array<{ championId: number; championPoints: number }>
  } | null> {
    try {
      const list = await this.get<Array<{ championId: number; championPoints: number }>>(
        '/lol-champion-mastery/v1/local-player/champion-mastery'
      )
      if (!Array.isArray(list) || list.length === 0) return null
      const sorted = [...list].sort((a, b) => b.championPoints - a.championPoints)
      return {
        totalScore: list.reduce((sum, m) => sum + (m.championPoints ?? 0), 0),
        top3: sorted.slice(0, 3).map((m) => ({ championId: m.championId, championPoints: m.championPoints })),
      }
    } catch {
      return null
    }
  }

  /**
   * 接続を切断してクレデンシャルをクリアする
   */
  disconnect(): void {
    this.credentials = null
    this.baseURL = ''
    this.authHeader = ''
  }
}

// シングルトンインスタンス
export const lcuClient = new LcuClient()

// ---------- LCU マッチ履歴の型定義 ----------

export interface LcuMatchParticipantStats {
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

export interface LcuMatchParticipant {
  participantId: number
  teamId: number
  championId: number
  spell1Id: number
  spell2Id: number
  stats: LcuMatchParticipantStats
}

export interface LcuMatchParticipantIdentity {
  participantId: number
  player: {
    puuid: string
    gameName: string
    tagLine: string
    summonerName: string
  }
}

export interface LcuMatchGame {
  gameId: number
  gameCreation: number
  gameDuration: number
  gameMode: string
  queueId: number
  participants: LcuMatchParticipant[]
  participantIdentities: LcuMatchParticipantIdentity[]
  teams: Array<{ teamId: number; win: string }>
}
