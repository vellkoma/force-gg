/**
 * ローカルデータストア
 *
 * electron-store を使用してユーザー設定・お気に入り・キャッシュを保存する。
 * ネイティブコンパイル不要、JSONファイルベースでシンプルに動作する。
 * 保存先: %APPDATA%\lol-guide-desktop\config.json
 */

import Store from 'electron-store'

interface StoreSchema {
  settings: Record<string, string>
  favoriteChampions: Array<{ championId: number; championName: string; addedAt: string }>
  championStatsCache: Record<string, { data: unknown; cachedAt: number }>
}

const store = new Store<StoreSchema>({
  name: 'lol-guide-data',
  defaults: {
    settings: {},
    favoriteChampions: [],
    championStatsCache: {},
  },
})

// キャッシュTTL: 1時間（ミリ秒）
const CACHE_TTL_MS = 60 * 60 * 1000

/**
 * ストアを初期化する（起動時に呼ぶ）
 */
export function initDatabase(): void {
  // electron-store は自動初期化される
  // 古いキャッシュを起動時にクリーンアップ
  cleanExpiredCache()
}

/**
 * 設定値を取得する
 */
export function getSetting(key: string, defaultValue?: string): string | undefined {
  const settings = store.get('settings')
  return settings[key] ?? defaultValue
}

/**
 * 設定値を保存する
 */
export function setSetting(key: string, value: string): void {
  const settings = store.get('settings')
  settings[key] = value
  store.set('settings', settings)
}

/**
 * お気に入りチャンピオン一覧を取得する
 */
export function getFavoriteChampions(): Array<{ championId: number; championName: string }> {
  return store.get('favoriteChampions').map(({ championId, championName }) => ({
    championId,
    championName,
  }))
}

/**
 * お気に入りチャンピオンを追加する
 */
export function addFavoriteChampion(championId: number, championName: string): void {
  const favorites = store.get('favoriteChampions')
  if (!favorites.some((f) => f.championId === championId)) {
    favorites.push({ championId, championName, addedAt: new Date().toISOString() })
    store.set('favoriteChampions', favorites)
  }
}

/**
 * お気に入りチャンピオンを削除する
 */
export function removeFavoriteChampion(championId: number): void {
  const favorites = store.get('favoriteChampions').filter((f) => f.championId !== championId)
  store.set('favoriteChampions', favorites)
}

/**
 * チャンピオン統計をキャッシュする
 */
export function cacheChampionStats(championId: number, data: unknown): void {
  const cache = store.get('championStatsCache')
  cache[String(championId)] = { data, cachedAt: Date.now() }
  store.set('championStatsCache', cache)
}

/**
 * キャッシュされたチャンピオン統計を取得する（TTL: 1時間）
 */
export function getCachedChampionStats(championId: number): unknown | null {
  const cache = store.get('championStatsCache')
  const entry = cache[String(championId)]
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    delete cache[String(championId)]
    store.set('championStatsCache', cache)
    return null
  }
  return entry.data
}

/**
 * 期限切れキャッシュを削除する
 */
function cleanExpiredCache(): void {
  const cache = store.get('championStatsCache')
  const now = Date.now()
  let changed = false
  for (const key of Object.keys(cache)) {
    if (now - cache[key].cachedAt > CACHE_TTL_MS) {
      delete cache[key]
      changed = true
    }
  }
  if (changed) store.set('championStatsCache', cache)
}

/**
 * 後方互換性のため（呼び出し元を壊さないように残す）
 */
export function closeDatabase(): void {
  // electron-store はファイルベースのため close 不要
}
