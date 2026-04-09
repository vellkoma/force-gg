import axios, { type AxiosError } from 'axios'

// Axiosインスタンス（全APIリクエストの共通設定）
// 開発時: Viteプロキシ（/api → localhost:8000）を経由するため baseURL は空
// 本番時: VITE_API_URL を設定してバックエンドに直接接続
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// リクエストインターセプター（認証トークン等を後で追加）
apiClient.interceptors.request.use(
  (config) => {
    // Phase 4以降: Auth.jsのJWTトークンをヘッダーに付与
    // const token = getAuthToken()
    // if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error),
)

// レスポンスインターセプター（エラーハンドリング統一）
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status

      // 429: レート制限 — Retry-Afterヘッダーをログ出力
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after']
        console.warn(`レート制限に達しました。${retryAfter ?? '?'}秒後に再試行してください。`)
      }

      // エラーオブジェクトにstatusを付与してReact Queryのretryロジックで利用
      const enhancedError = Object.assign(error, { status })
      return Promise.reject(enhancedError)
    }

    // ネットワークエラー
    if (error.request) {
      console.error('ネットワークエラー: バックエンドに接続できません')
    }

    return Promise.reject(error)
  },
)

export default apiClient
