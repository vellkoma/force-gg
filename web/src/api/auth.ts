import apiClient from '@/api/client'
import type { User, LoginResponse, OAuthUrlResponse, RefreshResponse } from '@/types/auth'

/**
 * メールアドレスとパスワードでログイン
 * POST /api/auth/login/email
 */
export const loginWithEmail = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/login/email', {
    email,
    password,
  })
  return data
}

/**
 * 新規アカウント登録
 * POST /api/auth/register
 */
export const registerWithEmail = async (
  email: string,
  password: string,
  name: string,
): Promise<LoginResponse> => {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/register', {
    email,
    password,
    name,
  })
  return data
}

/**
 * Google OAuth認証URLを取得
 * GET /api/auth/oauth/google/url
 */
export const getGoogleAuthUrl = async (): Promise<OAuthUrlResponse> => {
  const { data } = await apiClient.get<OAuthUrlResponse>('/api/auth/oauth/google/url')
  return data
}

/**
 * Discord OAuth認証URLを取得
 * GET /api/auth/oauth/discord/url
 */
export const getDiscordAuthUrl = async (): Promise<OAuthUrlResponse> => {
  const { data } = await apiClient.get<OAuthUrlResponse>('/api/auth/oauth/discord/url')
  return data
}

/**
 * OAuthコールバック処理
 * POST /api/auth/oauth/callback
 */
export const handleOAuthCallback = async (
  provider: string,
  code: string,
  state: string,
): Promise<LoginResponse> => {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/oauth/callback', {
    provider,
    code,
    state,
  })
  return data
}

/**
 * 現在のユーザー情報を取得
 * GET /api/auth/me
 */
export const getMe = async (): Promise<User> => {
  const { data } = await apiClient.get<User>('/api/auth/me')
  return data
}

/**
 * アクセストークンをリフレッシュ
 * POST /api/auth/refresh
 * @param currentRefreshToken sessionStorageから取得したリフレッシュトークン
 */
export const refreshToken = async (currentRefreshToken: string): Promise<RefreshResponse> => {
  const { data } = await apiClient.post<RefreshResponse>('/api/auth/refresh', {
    refresh_token: currentRefreshToken,
  })
  return data
}
