// バックエンド GET /api/summoner/{gameName}/{tagLine} のレスポンス型

export interface AccountInfo {
  puuid:     string
  game_name: string
  tag_line:  string
}

export interface SummonerInfo {
  id:               string
  account_id:       string
  puuid:            string
  profile_icon_id:  number
  summoner_level:   number
}

export interface RankedEntry {
  queue_type:    string   // "RANKED_SOLO_5x5" | "RANKED_FLEX_SR"
  tier:          string   // "IRON" | "BRONZE" | ... | "CHALLENGER"
  rank:          string   // "I" | "II" | "III" | "IV"
  league_points: number
  wins:          number
  losses:        number
  win_rate:      number   // 0.0 〜 1.0（バックエンドが計算済み）または算出
}

export interface SummonerProfile {
  account:      AccountInfo
  summoner:     SummonerInfo
  ranked_stats: RankedEntry[]
}

// ティア名の日本語ラベル
export const TIER_LABELS: Record<string, string> = {
  IRON:        'アイアン',
  BRONZE:      'ブロンズ',
  SILVER:      'シルバー',
  GOLD:        'ゴールド',
  PLATINUM:    'プラチナ',
  EMERALD:     'エメラルド',
  DIAMOND:     'ダイヤモンド',
  MASTER:      'マスター',
  GRANDMASTER: 'グランドマスター',
  CHALLENGER:  'チャレンジャー',
}

// ランク数字の日本語ラベル
export const RANK_LABELS: Record<string, string> = {
  I: 'I', II: 'II', III: 'III', IV: 'IV',
}

// キュータイプの日本語ラベル
export const QUEUE_TYPE_LABELS: Record<string, string> = {
  RANKED_SOLO_5x5: 'ソロ/デュオ',
  RANKED_FLEX_SR:  'フレックス',
}

// ランクカラー（TailwindCSS クラス名）
export const RANK_COLOR_CLASSES: Record<string, string> = {
  IRON:        'text-rank-iron',
  BRONZE:      'text-rank-bronze',
  SILVER:      'text-rank-silver',
  GOLD:        'text-rank-gold',
  PLATINUM:    'text-rank-platinum',
  EMERALD:     'text-rank-emerald',
  DIAMOND:     'text-rank-diamond',
  MASTER:      'text-rank-master',
  GRANDMASTER: 'text-rank-grandmaster',
  CHALLENGER:  'text-rank-challenger',
}

// ランクバッジの背景色クラス
export const RANK_BG_CLASSES: Record<string, string> = {
  IRON:        'bg-rank-iron/20 border-rank-iron/50',
  BRONZE:      'bg-rank-bronze/20 border-rank-bronze/50',
  SILVER:      'bg-rank-silver/20 border-rank-silver/50',
  GOLD:        'bg-rank-gold/20 border-rank-gold/50',
  PLATINUM:    'bg-rank-platinum/20 border-rank-platinum/50',
  EMERALD:     'bg-rank-emerald/20 border-rank-emerald/50',
  DIAMOND:     'bg-rank-diamond/20 border-rank-diamond/50',
  MASTER:      'bg-rank-master/20 border-rank-master/50',
  GRANDMASTER: 'bg-rank-grandmaster/20 border-rank-grandmaster/50',
  CHALLENGER:  'bg-rank-challenger/20 border-rank-challenger/50',
}
