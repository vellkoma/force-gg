export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  provider: 'google' | 'discord' | 'email'
  has_password: boolean
  is_premium: boolean
  isPremium: boolean        // 後方互換（is_premium の別名）
  premiumExpiresAt?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

export interface LoginResponse {
  token: string
  refresh_token: string
  user: User
}

export interface OAuthUrlResponse {
  url: string
}

export interface RefreshResponse {
  token: string
  refresh_token: string
}
