// チャンピオンの基本情報（Data Dragon API に準拠）
export interface Champion {
  id: string          // 例: "Ahri"
  key: string         // 数値ID文字列 例: "103"
  name: string        // 例: "アーリ"
  title: string       // 例: "九尾の妖狐"
  blurb: string       // 短い説明文
  image: ChampionImage
  tags: ChampionTag[]
  info: ChampionInfo
  stats: ChampionStats
  partype: string     // リソースタイプ（マナ等）
}

export interface ChampionImage {
  full:   string   // 例: "Ahri.png"
  sprite: string
  group:  string
  x:      number
  y:      number
  w:      number
  h:      number
}

export interface ChampionInfo {
  attack:     number  // 0〜10
  defense:    number
  magic:      number
  difficulty: number
}

export interface ChampionStats {
  hp:                 number
  hpperlevel:         number
  mp:                 number
  mpperlevel:         number
  movespeed:          number
  armor:              number
  armorperlevel:      number
  spellblock:         number
  spellblockperlevel: number
  attackrange:        number
  hpregen:            number
  hpregenperlevel:    number
  mpregen:            number
  mpregenperlevel:    number
  crit:               number
  critperlevel:       number
  attackdamage:       number
  attackdamageperlevel: number
  attackspeedperlevel: number
  attackspeed:        number
}

export type ChampionTag =
  | 'Fighter'
  | 'Tank'
  | 'Mage'
  | 'Assassin'
  | 'Support'
  | 'Marksman'

// タグの日本語ラベル
export const CHAMPION_TAG_LABELS: Record<ChampionTag, string> = {
  Fighter:   'ファイター',
  Tank:      'タンク',
  Mage:      'メイジ',
  Assassin:  'アサシン',
  Support:   'サポート',
  Marksman:  'マークスマン',
}

// バックエンドAPIが返すチャンピオンの簡易型（一覧用）
// image_url はバックエンドが組み立て済みのURL
export interface ChampionListItem {
  id:        string
  key:       string
  name:      string
  title:     string
  image_url: string
  tags:      ChampionTag[]
}

// バックエンドAPIのレスポンス型
export interface ChampionsResponse {
  champions: ChampionListItem[]
  version:   string
  total?:    number
}

// バックエンド GET /api/champions/:id のレスポンス（ChampionDetail）
// Pydantic snake_case でシリアライズされる
// フィールド名は Pydantic の alias（Data Dragon 形式）でシリアライズされる
export interface ChampionDetailStats {
  hp:                   number
  hpperlevel:           number
  mp:                   number
  mpperlevel:           number
  armor:                number
  armorperlevel:        number
  spellblock:           number
  spellblockperlevel:   number
  attackdamage:         number
  attackdamageperlevel: number
  attackspeed:          number
  movespeed:            number
  attackrange:          number
  crit:                 number
  critperlevel:         number
}

export interface ChampionDetailData {
  id:        string
  key:       string
  name:      string
  title:     string
  image_url: string
  tags:      ChampionTag[]
  blurb:     string
  stats:     ChampionDetailStats
  partype:   string
}

// チャンピオン統計（ランク別勝率等）
export interface ChampionStats2 {
  championId:  string
  winRate:     number   // 0.0〜1.0
  pickRate:    number
  banRate:     number
  avgKills:    number
  avgDeaths:   number
  avgAssists:  number
  gamesPlayed: number
  tier:        string   // "S+", "S", "A", "B", "C"
  rank:        number   // チャンピオン内のランキング
}
