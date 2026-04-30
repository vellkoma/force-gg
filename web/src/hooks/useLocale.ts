export type LoLRegion = 'JP1' | 'KR' | 'NA1' | 'EUW1' | 'EUNE1' | 'BR1' | 'OC1' | 'TR1' | 'RU'

export interface LocaleInfo {
  region:      LoLRegion
  hlCode:      string   // LoL Esports API の hl パラメータ
  leagueId:    string   // 主要 Esports リーグ ID
  leagueName:  string
  dateLocale:  string   // Intl 用ロケール文字列
}

const REGION_MAP: Record<LoLRegion, Omit<LocaleInfo, 'region'>> = {
  JP1:   { hlCode: 'ja-JP', leagueId: '98767991349978712', leagueName: 'LJL',   dateLocale: 'ja-JP' },
  KR:    { hlCode: 'ko-KR', leagueId: '98767991310872058', leagueName: 'LCK',   dateLocale: 'ko-KR' },
  NA1:   { hlCode: 'en-US', leagueId: '98767991299243165', leagueName: 'LCS',   dateLocale: 'en-US' },
  EUW1:  { hlCode: 'en-GB', leagueId: '98767991302996019', leagueName: 'LEC',   dateLocale: 'en-GB' },
  EUNE1: { hlCode: 'en-GB', leagueId: '98767991302996019', leagueName: 'LEC',   dateLocale: 'en-GB' },
  BR1:   { hlCode: 'pt-BR', leagueId: '98767991332355509', leagueName: 'CBLOL', dateLocale: 'pt-BR' },
  OC1:   { hlCode: 'en-AU', leagueId: '98767991338682439', leagueName: 'LCO',   dateLocale: 'en-AU' },
  TR1:   { hlCode: 'tr-TR', leagueId: '98767991343597634', leagueName: 'TCL',   dateLocale: 'tr-TR' },
  RU:    { hlCode: 'ru-RU', leagueId: '98767991355908944', leagueName: 'LCL',   dateLocale: 'ru-RU' },
}

function detectRegion(): LoLRegion {
  const lang = navigator.language.toLowerCase()
  const tz   = Intl.DateTimeFormat().resolvedOptions().timeZone

  if (lang.startsWith('ja') || tz === 'Asia/Tokyo')                return 'JP1'
  if (lang.startsWith('ko') || tz === 'Asia/Seoul')                return 'KR'
  if (lang.startsWith('pt') || tz.startsWith('America/Sao_Paulo')) return 'BR1'
  if (lang.startsWith('tr') || tz === 'Europe/Istanbul')           return 'TR1'
  if (lang.startsWith('ru') || tz === 'Europe/Moscow')             return 'RU'
  if (tz.startsWith('Australia') || tz.startsWith('Pacific/Auckland')) return 'OC1'
  if (tz.startsWith('America/'))                                   return 'NA1'
  if (tz.startsWith('Europe/'))                                    return 'EUW1'
  return 'JP1'
}

let _cached: LocaleInfo | null = null

export function getLocale(): LocaleInfo {
  if (_cached) return _cached
  const region = detectRegion()
  _cached = { region, ...REGION_MAP[region] }
  return _cached
}

export function useLocale(): LocaleInfo {
  return getLocale()
}
