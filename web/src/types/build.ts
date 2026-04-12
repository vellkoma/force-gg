// バックエンド GET /api/champions/:id/builds のレスポンス型

export interface ItemInfo {
  id:          number
  name:        string
  description: string
  image_url:   string
  gold_total:  number
}

export interface RuneInfo {
  id:          number
  name:        string
  icon:        string
  description: string
}

export interface BuildRecommendation {
  champion_id:    string
  version:        string
  core_items:     ItemInfo[]
  rune_primary:   RuneInfo
  rune_secondary: RuneInfo
  source:         string
}
