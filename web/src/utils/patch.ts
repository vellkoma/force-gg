/**
 * DDragon形式のバージョン文字列を表示用に変換する
 *
 * DDragon: "16.9"  → 表示: "26.9（16.9）"
 * DDragon: "16.9.1" → 表示: "26.9（16.9）"（ビルド番号は除去）
 */
export function formatPatch(ddragonVersion: string): string {
  const parts = ddragonVersion.split('.')
  if (parts.length < 2) return ddragonVersion

  const major = parseInt(parts[0], 10)
  if (isNaN(major)) return ddragonVersion

  const minor   = parts[1]
  const hotfix  = parts[2] && parts[2] !== '1' ? `.${parts[2]}` : ''
  const internalPatch = `${major}.${minor}${hotfix}`
  const displayMajor  = major + 10
  return `${displayMajor}.${minor}${hotfix}（${internalPatch}）`
}

/**
 * ユーザー入力の 26.x 形式を DDragon の 16.x 形式に正規化する
 * 両方の形式を受け付ける
 *
 * "26.9" → "16.9"
 * "16.9" → "16.9"（そのまま）
 */
export function normalizePatch(input: string): string {
  const parts = input.split('.')
  if (parts.length < 2) return input
  const major = parseInt(parts[0], 10)
  if (isNaN(major)) return input
  const normalized = major >= 20 ? major - 10 : major
  return `${normalized}.${parts[1]}`
}
