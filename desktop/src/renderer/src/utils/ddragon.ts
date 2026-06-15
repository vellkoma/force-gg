// 動的に最新バージョンを取得して使用する
let VERSION = '15.24.1'
let versionReady = false
const versionCallbacks: Array<() => void> = []

export async function initDdragonVersion(): Promise<void> {
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
    const versions: string[] = await res.json()
    if (versions[0]) VERSION = versions[0]
  } catch {
    // フォールバック: ハードコード版を使用
  } finally {
    versionReady = true
    versionCallbacks.forEach((cb) => cb())
    versionCallbacks.length = 0
  }
}

/** バージョン確定後に解決する Promise（既に確定済みなら即解決） */
export function waitForVersion(): Promise<void> {
  if (versionReady) return Promise.resolve()
  return new Promise((resolve) => versionCallbacks.push(resolve))
}

export function getDdragonVersion(): string {
  return VERSION
}

const CDN = () => `https://ddragon.leagueoflegends.com/cdn/${VERSION}`

// サモナースペル ID → DDragon キー名
const SPELL_KEY: Record<number, string> = {
  1:  'SummonerBoost',
  3:  'SummonerExhaust',
  4:  'SummonerFlash',
  6:  'SummonerHaste',
  7:  'SummonerHeal',
  11: 'SummonerSmite',
  12: 'SummonerTeleport',
  13: 'SummonerMana',
  14: 'SummonerDot',
  17: 'SummonerBarrier',
  21: 'SummonerBarrier',
  32: 'SummonerSnowball',
  39: 'SummonerSnowURFSnowball_Mark',
  55: 'SummonerFlashPerilous',
}

// ---------- スタット略称 ----------

// 日本語スタット名 → ゲーム略称（AD/AP/AS など）
const STAT_ABBR_JA: Array<[RegExp, string]> = [
  [/攻撃力/g,          'AD'],
  [/魔力/g,            'AP'],
  [/攻撃速度/g,        'AS'],
  [/体力自動回復/g,    'HP回復'],
  [/マナ自動回復/g,    'MP回復'],
  [/体力/g,            'HP'],
  [/マナ/g,            'MP'],
  [/魔法抵抗力/g,      'MR'],
  [/クールダウン短縮/g,'AH'],
  [/移動速度/g,        'MS'],
  [/クリティカル率/g,  'クリ率'],
  [/ライフスティール/g,'LS'],
  [/オムニヴァンプ/g,  'OV'],
  [/鎧/g,              'AR'],
  [/脅威度/g,          '脅威度'],
]

function abbreviateStat(text: string): string {
  let result = text
  for (const [pattern, abbr] of STAT_ABBR_JA) {
    result = result.replace(pattern, abbr)
  }
  return result
}

// スタット名 → カテゴリ判定
export type StatCategory = 'offense' | 'magic' | 'defense' | 'utility'

export function getStatCategory(stat: string): StatCategory {
  // 数字・%・スペースを除いた略称部分のみで判定（\b は "AD45" に効かないため使わない）
  const label = stat.replace(/[\d.%\s]+/g, '')
  if (label.includes('AD') || label.includes('AS') || label.includes('クリ率') ||
      label.includes('LS') || label.includes('OV') || label.includes('脅威度')) return 'offense'
  if (label.includes('AP') || label.includes('AH')) return 'magic'
  if (label.includes('AR') || label.includes('HP') || label.includes('MR')) return 'defense'
  return 'utility'
}

// カテゴリの表示順序
const CATEGORY_ORDER: StatCategory[] = ['offense', 'magic', 'defense', 'utility']

// ---------- アイテムツールチップ ----------

export interface ItemTooltip {
  stats: string[]    // ["65 AD", "40% AS"] — <stats> から抽出・略称化
  effects: string[]  // パッシブ/アクティブ効果テキスト（数値込み）
}

const itemNameMap = new Map<number, string>()
const itemTooltipDataMap = new Map<number, ItemTooltip>()

/** description HTML からスタット行と効果テキストを抽出する */
function parseItemDescription(html: string): { stats: string[]; effects: string[] } {
  const stats: string[] = []
  const effects: string[] = []

  // ① <stats>...</stats> → 略称化したスタット行
  const statsMatch = html.match(/<stats>([\s\S]*?)<\/stats>/i)
  if (statsMatch) {
    const lines = statsMatch[1].split(/<br\s*\/?>/i)
    for (const line of lines) {
      const clean = line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (clean) stats.push(abbreviateStat(clean))
    }
  }

  // ② <li>...</li> タグで passive/active 効果を取得
  const liRe = /<li>([\s\S]*?)<\/li>/gi
  let m: RegExpExecArray | null
  while ((m = liRe.exec(html)) !== null) {
    const text = cleanEffectText(m[1])
    if (text) effects.push(text.length > 180 ? text.slice(0, 180) + '…' : text)
  }

  // ③ <li> がなければ <passive>/<active> ラベルを直接探す
  if (effects.length === 0) {
    const body = html.replace(/<stats>[\s\S]*?<\/stats>/gi, '').replace(/<\/?mainText>/gi, '')
    const labelRe = /<(?:passive|active|uniquePassive)>([\s\S]*?)<\/(?:passive|active|uniquePassive)>([\s\S]*?)(?=<(?:passive|active|uniquePassive)>|<li>|$)/gi
    while ((m = labelRe.exec(body)) !== null) {
      const label   = m[1].replace(/<[^>]+>/g, '').trim()
      const content = m[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      const full = content ? `${label}: ${content}` : label
      const stripped = stripPlaceholders(full)
      if (stripped.length > 3) effects.push(stripped.length > 180 ? stripped.slice(0, 180) + '…' : stripped)
    }
  }

  return { stats, effects }
}

/** HTML タグをクリーニングし、{{ }} プレースホルダーを {?} に変換する */
function cleanEffectText(html: string): string {
  return html
    .replace(/<passive>/gi, '').replace(/<\/passive>/gi, ': ')
    .replace(/<active>/gi, '').replace(/<\/active>/gi, ': ')
    .replace(/<uniquePassive>/gi, '').replace(/<\/uniquePassive>/gi, ': ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{[^}]*\}\}/g, '{?}')  // 未解決プレースホルダー → {?}
    .replace(/\s+/g, ' ')
    .replace(/:\s+:/g, ':')
    .trim()
}

/** {{ varName }} プレースホルダーを {?} に変換する */
function stripPlaceholders(text: string): string {
  return text.replace(/\{\{[^}]*\}\}/g, '{?}').replace(/\s{2,}/g, ' ').trim()
}

/**
 * DDragon から ja_JP（スタット）と en_US（効果テキスト数値）を並列取得してマップに格納する。
 * ja_JP の効果テキストは {{ }} プレースホルダーが多いため、en_US を effects 用として使用する。
 */
export async function initItemNames(): Promise<void> {
  await waitForVersion()
  try {
    const [jaRes, enRes] = await Promise.all([
      fetch(`${CDN()}/data/ja_JP/item.json`),
      fetch(`${CDN()}/data/en_US/item.json`),
    ])
    type DdragonItem = { name: string; description?: string }
    const jaData = await jaRes.json() as { data: Record<string, DdragonItem> }
    const enData = await enRes.json() as { data: Record<string, DdragonItem> }

    for (const [id, jaItem] of Object.entries(jaData.data)) {
      const numId = parseInt(id, 10)
      itemNameMap.set(numId, jaItem.name)

      // スタットは日本語（略称化）
      const { stats } = parseItemDescription(jaItem.description ?? '')

      // 効果は ja_JP 優先。ja_JP に効果がない場合のみ en_US にフォールバック
      const enItem = enData.data[id]
      const { effects: jaEffects } = parseItemDescription(jaItem.description ?? '')
      const { effects: enEffects } = parseItemDescription(enItem?.description ?? '')
      const effects = jaEffects.length > 0 ? jaEffects : enEffects

      // カテゴリ順にソート
      const sorted = [...stats].sort((a, b) => {
        const order = CATEGORY_ORDER.indexOf(getStatCategory(a)) - CATEGORY_ORDER.indexOf(getStatCategory(b))
        return order
      })

      itemTooltipDataMap.set(numId, { stats: sorted, effects })
    }
  } catch {
    // フォールバック: アイテム情報なし
  }
}

export const dd = {
  championIcon: (name: string) => `${CDN()}/img/champion/${name}.png`,
  profileIcon: (id: number | null | undefined) =>
    id && id > 0 ? `${CDN()}/img/profileicon/${id}.png` : null,
  itemIcon: (id: number) => (id > 0 ? `${CDN()}/img/item/${id}.png` : null),
  itemName: (id: number): string | null => itemNameMap.get(id) ?? null,
  itemTooltip: (id: number): ItemTooltip | null => itemTooltipDataMap.get(id) ?? null,
  spellIcon: (key: string) => `${CDN()}/img/spell/${key}.png`,
  spellIconById: (id: number) => {
    const key = SPELL_KEY[id]
    return key ? `${CDN()}/img/spell/${key}.png` : null
  },
}
