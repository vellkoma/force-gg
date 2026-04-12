// バックエンド GET /api/matches/{puuid} のレスポンス型

export interface ParticipantStats {
  puuid:                            string
  champion_name:                    string
  champion_id:                      number
  kills:                            number
  deaths:                           number
  assists:                          number
  win:                              boolean
  total_damage_dealt_to_champions:  number
  gold_earned:                      number
  cs:                               number
  vision_score:                     number
  summoner1_id:                     number
  summoner2_id:                     number
  item0:                            number
  item1:                            number
  item2:                            number
  item3:                            number
  item4:                            number
  item5:                            number
  item6:                            number
  individual_position:              string
  champ_level:                      number
  team_id:                          number
  participant_id:                   number
  riot_id_game_name:                string
  riot_id_tag_line:                 string
  // クライアント側で計算する派生値
  kda?: number
}

export interface MatchInfo {
  match_id:            string
  game_duration:       number   // 秒
  game_mode:           string
  queue_id:            number
  game_end_timestamp:  number
}

export interface MatchDetail {
  info:         MatchInfo
  participants: ParticipantStats[]
  my_stats:     ParticipantStats | null
}

export interface MatchListResponse {
  puuid:   string
  matches: MatchDetail[]
}

// --- タイムライン型 ---

export interface ParticipantFrameData {
  participant_id: number
  total_gold:     number
  xp:             number
  level:          number
}

export interface TimelineFrame {
  timestamp_ms: number
  second:       number
  data:         ParticipantFrameData[]
}

export interface ParticipantMeta {
  participant_id: number
  puuid:          string
  champion_name:  string  // バックエンドでは空、フロントで補完
  team_id:        number
}

export interface ItemEvent {
  timestamp_ms: number
  second:       number
  item_id:      number
}

export interface MatchTimeline {
  match_id:          string
  my_participant_id: number
  participant_metas: ParticipantMeta[]
  frames:            TimelineFrame[]
  item_purchases:    ItemEvent[]
}

// キューID → 日本語名マッピング
export const QUEUE_LABELS: Record<number, string> = {
  420:  'ランク戦',
  440:  'ランクフレックス',
  400:  'ノーマルドラフト',
  430:  'ノーマルブラインド',
  450:  'ARAM',
  480:  'スウィフトプレイ',
  700:  'クラッシュ',
  900:  'URF',
  1020: 'ワンフォーオール',
  1300: 'ネクサス大混戦',
  1400: '究極のスペルブック',
  1700: 'アリーナ',
  1710: 'アリーナ',
  1810: 'ランダムミッド：メイヘム',
  1820: 'ランダムミッド：メイヘム',
  1830: 'ランダムミッド：メイヘム',
  1840: 'ランダムミッド：メイヘム',
  0:    'カスタム',
}

// ポジション → 日本語ラベル
export const POSITION_LABELS: Record<string, string> = {
  MIDDLE:  'ミッド',
  TOP:     'トップ',
  JUNGLE:  'ジャングル',
  BOTTOM:  'ボット',
  UTILITY: 'サポート',
  NONE:    '不明',
}

// ゲーム時間（秒）を MM:SS 形式に変換するユーティリティ
export function formatGameDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// KDA比率を計算するユーティリティ（deaths=0の場合はPerfect）
export function calcKda(kills: number, deaths: number, assists: number): string {
  if (deaths === 0) return 'Perfect'
  return ((kills + assists) / deaths).toFixed(2)
}
