export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  provider: 'google' | 'discord' | 'email'
  isPremium: boolean
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
