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
  LcuRankedStats
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
