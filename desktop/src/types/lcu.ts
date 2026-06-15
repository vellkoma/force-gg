// LCU API 型定義

export interface LcuCredentials {
  port: number
  password: string
  protocol: 'https'
}

export interface ChampSelectPlayer {
  cellId: number
  championId: number
  summonerId: number
  assignedPosition: string
  spell1Id: number
  spell2Id: number
  // 選択状態
  championPickIntent: number
  selectedSkinId: number
  wardSkinId: number
}

export interface ChampSelectAction {
  id: number
  actorCellId: number
  type: 'ban' | 'pick' | 'ten_bans_reveal'
  championId: number
  completed: boolean
  isAllyAction: boolean
  isInProgress: boolean
}

export interface ChampSelectTimer {
  phase: 'PLANNING' | 'BAN_PICK' | 'FINALIZATION' | 'GAME_STARTING'
  adjustedTimeLeftInPhase: number
  totalTimeInPhase: number
  internalNowInEpochMs: number
  isInfinite: boolean
}

export interface ChampSelectSession {
  actions: ChampSelectAction[][]
  myTeam: ChampSelectPlayer[]
  theirTeam: ChampSelectPlayer[]
  timer: ChampSelectTimer
  localPlayerCellId: number
  isSpectating: boolean
  benchEnabled: boolean
  benchChampions: Array<{ championId: number; isPriority: boolean }>
  bans?: {
    myTeamBans: number[]
    theirTeamBans: number[]
    numBans: number
  }
  chatDetails: {
    chatRoomName: string
    chatRoomPassword: string
  }
}

export interface LcuSummoner {
  summonerId: number
  puuid: string
  displayName: string
  internalName: string
  nameChangeFlag: boolean
  percentCompleteForNextLevel: number
  privacy: 'PUBLIC' | 'PRIVATE'
  profileIconId: number
  summonerLevel: number
  accountId: number
  xpSinceLastLevel: number
  xpUntilNextLevel: number
  /** Riot ID タグライン（例: JP1）— LCU v2以降で返される */
  tagLine?: string
  /** Riot ID ゲーム名（displayName と同じ場合が多い） */
  gameName?: string
}

export type GameflowPhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'InProgress'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'EndOfGame'
  | 'Reconnect'

export interface LcuReadyCheck {
  state: 'Invalid' | 'InProgress' | 'EveryoneReady' | 'StrangerWarning'
  playerResponse: 'None' | 'Accepted' | 'Declined'
  timer: number
  dodgeWarning: 'None' | 'Warning' | 'Penalty'
}

export interface LcuRankedStats {
  queueMap: Record<string, LcuQueueStats>
}

export interface LcuQueueStats {
  queueType: string
  tier: string
  division: string
  leaguePoints: number
  wins: number
  losses: number
  miniSeriesProgress: string
}
