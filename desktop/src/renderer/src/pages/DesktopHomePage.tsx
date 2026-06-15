import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLcu } from '../context/LcuContext'
import type { LcuQueueStats } from '../../../types/lcu'
import { useChampionMap } from '../hooks/useChampionMap'
import {
  useMatchHistory,
  getQueueLabel,
  formatDuration,
  formatTimeAgo,
  type MatchDetail,
  type ParticipantStats,
} from '../hooks/useMatchHistory'
import { dd, getStatCategory } from '../utils/ddragon'
import { useAugmentMap, useAugmentNameMap, useAugmentDescMap } from '../hooks/useAugmentMap'
import type { GameflowPhase } from '../../../types/lcu'
import type { FavoriteChampion } from '../../../preload/index.d'

const PHASE_LABELS: Record<GameflowPhase, string> = {
  None: 'アイドル',
  Lobby: 'ロビー',
  Matchmaking: 'マッチング中',
  ReadyCheck: 'マッチ承認',
  ChampSelect: 'チャンピオン選択中',
  InProgress: 'ゲーム中',
  WaitingForStats: '結果待ち',
  PreEndOfGame: '試合終了',
  EndOfGame: '結果画面',
  Reconnect: '再接続',
}

const PHASE_COLORS: Record<GameflowPhase, string> = {
  None: 'text-gray-400',
  Lobby: 'text-blue-400',
  Matchmaking: 'text-yellow-400',
  ReadyCheck: 'text-orange-400',
  ChampSelect: 'text-green-400',
  InProgress: 'text-red-400',
  WaitingForStats: 'text-purple-400',
  PreEndOfGame: 'text-purple-400',
  EndOfGame: 'text-gray-300',
  Reconnect: 'text-red-500',
}

// ---------- アコーディオン詳細（BLITZスタイル） ----------

function Tooltip({
  children,
  name,
  stats,
  effects,
}: {
  children: React.ReactNode
  name: string | null | undefined
  stats?: string[]
  effects?: string[]
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  if (!name) return <>{children}</>

  const hasStats = stats && stats.length > 0
  const hasEffects = effects && effects.length > 0

  return (
    <div
      className="inline-flex"
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {children}
      {rect &&
        createPortal(
          <div
            className="fixed pointer-events-none z-[9999]"
            style={{
              left: rect.left + rect.width / 2,
              top: rect.top - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-[#0d1117] border border-[#2a3a4a] rounded-md shadow-2xl px-3 py-2.5 max-w-[300px]">
              {/* アイテム名 */}
              <p className="text-[#c89b3c] text-[12px] font-bold whitespace-nowrap">{name}</p>
              {/* スタット（カテゴリ横並び：攻撃  45AD  30%AS） */}
              {hasStats && (() => {
                type Cat = 'offense' | 'magic' | 'defense' | 'utility'
                const groups: Record<Cat, string[]> = { offense: [], magic: [], defense: [], utility: [] }
                for (const s of stats!) groups[getStatCategory(s)].push(s)
                const catMeta: { key: Cat; label: string; numColor: string; labelColor: string }[] = [
                  { key: 'offense', label: '攻撃',  numColor: 'text-white',      labelColor: 'text-orange-300' },
                  { key: 'magic',   label: '魔法',  numColor: 'text-white',      labelColor: 'text-blue-300'   },
                  { key: 'defense', label: '防御',  numColor: 'text-white',      labelColor: 'text-green-300'  },
                  { key: 'utility', label: 'その他',numColor: 'text-white',      labelColor: 'text-gray-400'   },
                ]
                const activeGroups = catMeta.filter(c => groups[c.key].length > 0)
                return (
                  <div className="mt-1.5 space-y-1">
                    {activeGroups.map(({ key, label, numColor, labelColor }) => (
                      <div key={key} className="flex items-baseline gap-2 text-[11px]">
                        {/* カテゴリラベル（固定幅） */}
                        <span className={`text-[9px] font-bold w-8 shrink-0 ${labelColor}`}>{label}</span>
                        {/* スタット横並び */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0">
                          {groups[key].map((s, i) => {
                            // "45AD", "45 AD", "30%AS", "30% AS" のいずれも対応
                            const m = s.match(/^([\d.]+%?)\s*(.+)/)
                            return m ? (
                              <span key={i} className="tabular-nums">
                                <span className={`font-bold ${numColor}`}>{m[1]}</span>
                                <span className={labelColor}>{m[2].trim()}</span>
                              </span>
                            ) : (
                              <span key={i} className="text-gray-200">{s}</span>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
              {/* パッシブ/アクティブ効果 */}
              {hasEffects && (
                <div className={`space-y-1 ${hasStats ? 'mt-1.5 border-t border-[#1e2a3a] pt-1.5' : 'mt-1'}`}>
                  {effects!.slice(0, 2).map((e, i) => (
                    <p key={i} className="text-[10px] text-gray-400 leading-relaxed whitespace-normal">{e}</p>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

function SpellIcon({ id }: { id: number }) {
  const url = dd.spellIconById(id)
  if (!url) return <div className="w-5 h-5 bg-[#0a0e1a] rounded" />
  return (
    <img src={url} alt="" className="w-5 h-5 rounded object-cover"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
  )
}

const ARENA_QUEUES = [1700, 1710]

function BLITZPlayerRow({
  p, maxDamage, teamKills, isMe, teamColor, augmentMap, showAugments, championMap
}: {
  p: ParticipantStats
  maxDamage: number
  teamKills: number
  isMe: boolean
  teamColor: 'blue' | 'red'
  augmentMap: Map<number, string>
  showAugments: boolean
  championMap: Map<number, string>
}) {
  const augmentNameMap = useAugmentNameMap()
  const augmentDescMap = useAugmentDescMap()
  const kdaNum = p.deaths === 0 ? (p.kills + p.assists) : (p.kills + p.assists) / p.deaths
  const kdaStr = p.deaths === 0 ? `${p.kills + p.assists}:1` : kdaNum.toFixed(1)
  const kdaGold = kdaNum >= 5
  const killPct = teamKills > 0 ? Math.round(((p.kills + p.assists) / teamKills) * 100) : 0
  const dmgPct = maxDamage > 0 ? (p.total_damage_dealt_to_champions / maxDamage) * 100 : 0
  const augmentIds = [p.playerAugment1, p.playerAugment2, p.playerAugment3, p.playerAugment4]
  // champion_id から DDragon キーを引く（Riot API の championName はキー形式と異なる場合がある）
  const champKey = championMap.get(p.champion_id) ?? p.champion_name

  return (
    <tr className={`border-t border-[#1a2433] text-sm ${isMe ? 'bg-[#c89b3c]/5' : ''}`}>
      {/* チャンピオン + 名前 */}
      <td className="py-2 pl-4 pr-2">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <img
              src={dd.championIcon(champKey)}
              alt={champKey}
              className="w-9 h-9 rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className="absolute -bottom-0.5 -right-0.5 text-[9px] bg-[#0a0e1a] border border-[#1e2a3a] px-0.5 rounded-sm leading-tight text-gray-400 font-semibold">
              {p.champ_level}
            </span>
          </div>
          <span className={`truncate max-w-[100px] font-medium ${isMe ? 'text-[#c89b3c]' : 'text-gray-200'}`}>
            {p.riot_id_game_name || p.champion_name}
          </span>
        </div>
      </td>
      {/* アイテム + スペル */}
      <td className="py-2 px-2">
        <div className="flex items-center gap-1">
          {[p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].map((id, i) => {
            const tip = id > 0 ? dd.itemTooltip(id) : null
            return (
              <Tooltip key={i} name={id > 0 ? dd.itemName(id) : null} stats={tip?.stats} effects={tip?.effects}>
                <div className="w-7 h-7 rounded bg-[#1a2433] overflow-hidden shrink-0">
                  {id > 0 && (
                    <img src={dd.itemIcon(id) ?? ''} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>
              </Tooltip>
            )
          })}
          {(() => {
            const tip = p.item6 > 0 ? dd.itemTooltip(p.item6) : null
            return (
              <Tooltip name={p.item6 > 0 ? dd.itemName(p.item6) : null} stats={tip?.stats} effects={tip?.effects}>
                <div className="w-7 h-7 rounded-full bg-[#1a2433] overflow-hidden shrink-0 mx-0.5">
                  {p.item6 > 0 && (
                    <img src={dd.itemIcon(p.item6) ?? ''} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>
              </Tooltip>
            )
          })()}
          <div className="flex flex-col gap-0.5 ml-1 shrink-0">
            <SpellIcon id={p.summoner1_id} />
            <SpellIcon id={p.summoner2_id} />
          </div>
        </div>
      </td>
      {/* オーグメント */}
      {showAugments && (
        <td className="py-2 px-2">
          <div className="flex flex-wrap gap-1">
            {augmentIds.filter(Boolean).map((id, i) => {
              const iconUrl = augmentMap.get(id) ?? null
              const augDesc = augmentDescMap.get(id)
              return (
                <Tooltip key={i} name={augmentNameMap.get(id)} effects={augDesc ? [augDesc] : undefined}>
                  <div className="w-7 h-7 rounded bg-[#1a2433] overflow-hidden shrink-0">
                    {iconUrl && (
                      <img src={iconUrl} alt="" className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                  </div>
                </Tooltip>
              )
            })}
          </div>
        </td>
      )}
      {/* KDA */}
      <td className="py-2 px-3 text-center whitespace-nowrap">
        <p className="tabular-nums font-semibold">{p.kills}/{p.deaths}/{p.assists}</p>
        <p className={`text-xs tabular-nums ${kdaGold ? 'text-[#c89b3c] font-semibold' : 'text-gray-500'}`}>{kdaStr} KDA</p>
      </td>
      {/* CS + キル関与率 */}
      <td className="py-2 px-3 text-center whitespace-nowrap">
        <p className="tabular-nums">{p.cs}CS</p>
        <p className="text-xs text-gray-500">キル関与率</p>
        <p className={`text-xs ${killPct >= 70 ? 'text-[#c89b3c]' : 'text-gray-400'}`}>{killPct}%</p>
      </td>
      {/* ダメージ */}
      <td className="py-2 px-3 pr-4">
        <p className="tabular-nums text-right text-gray-300 whitespace-nowrap">
          {p.total_damage_dealt_to_champions.toLocaleString()} ダメージ
        </p>
        <div className="w-full bg-[#0a0e1a] rounded-full h-1.5 mt-1">
          <div
            className={`h-1.5 rounded-full ${teamColor === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`}
            style={{ width: `${dmgPct}%` }}
          />
        </div>
      </td>
    </tr>
  )
}

function BLITZTeamSection({
  players, myPuuid, win, teamColor, augmentMap, showAugments, championMap
}: {
  players: ParticipantStats[]
  myPuuid: string
  win: boolean
  teamColor: 'blue' | 'red'
  augmentMap: Map<number, string>
  showAugments: boolean
  championMap: Map<number, string>
}) {
  const maxDamage = Math.max(...players.map(p => p.total_damage_dealt_to_champions), 1)
  const teamKills = players.reduce((s, p) => s + p.kills, 0)
  const teamDeaths = players.reduce((s, p) => s + p.deaths, 0)
  const teamAssists = players.reduce((s, p) => s + p.assists, 0)
  const teamGold = players.reduce((s, p) => s + p.gold_earned, 0)

  return (
    <div>
      <div className={`flex items-center justify-between px-4 py-2.5 ${teamColor === 'blue' ? 'bg-blue-900/20' : 'bg-red-900/20'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${teamColor === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
            {teamColor === 'blue' ? 'チーム1' : 'チーム2'}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${win ? 'bg-blue-600/30 text-blue-300' : 'bg-red-800/30 text-red-400'}`}>
            {win ? '勝利' : '敗北'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 tabular-nums">
            {teamKills} / <span className="text-gray-600">{teamDeaths}</span> / {teamAssists}
          </span>
          {teamGold > 0 && (
            <span className="text-xs text-[#c89b3c] tabular-nums">
              {(teamGold / 1000).toFixed(1)}k
            </span>
          )}
        </div>
      </div>
      <table className="w-full">
        <tbody>
          {players.map(p => (
            <BLITZPlayerRow
              key={p.participant_id}
              p={p}
              maxDamage={maxDamage}
              teamKills={teamKills}
              isMe={p.puuid === myPuuid}
              teamColor={teamColor}
              augmentMap={augmentMap}
              showAugments={showAugments}
              championMap={championMap}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MatchAccordionDetail({
  match, myPuuid, augmentMap, championMap
}: {
  match: MatchDetail
  myPuuid: string
  augmentMap: Map<number, string>
  championMap: Map<number, string>
}) {
  const blue = match.participants.filter(p => p.team_id === 100)
  const red  = match.participants.filter(p => p.team_id === 200)
  const blueWin = blue[0]?.win ?? false
  // CDragon に存在するaugment IDを持つ参加者がいる場合のみ列を表示
  const showAugments = match.participants.some((p) =>
    [p.playerAugment1, p.playerAugment2, p.playerAugment3, p.playerAugment4].some((id) => id > 0 && augmentMap.has(id))
  )

  return (
    <div className="border-t border-[#1e2a3a] bg-[#060a10]">
      <BLITZTeamSection players={blue} myPuuid={myPuuid} win={blueWin} teamColor="blue" augmentMap={augmentMap} showAugments={showAugments} championMap={championMap} />
      <div className="h-px bg-[#1e2a3a]" />
      <BLITZTeamSection players={red} myPuuid={myPuuid} win={!blueWin} teamColor="red" augmentMap={augmentMap} showAugments={showAugments} championMap={championMap} />
    </div>
  )
}

// ---------- メイン行 ----------

function MatchRow({
  match,
  myPuuid,
  augmentMap,
  championMap,
}: {
  match: MatchDetail
  myPuuid: string
  augmentMap: Map<number, string>
  championMap: Map<number, string>
}) {
  const [open, setOpen] = useState(false)
  const augmentNameMap = useAugmentNameMap()
  const augmentDescMap = useAugmentDescMap()
  const me: ParticipantStats | undefined =
    match.my_stats ?? match.participants.find((p) => p.puuid === myPuuid)
  if (!me) return null

  const win = me.win
  const kda =
    me.deaths === 0
      ? `${me.kills + me.assists}:1`
      : ((me.kills + me.assists) / me.deaths).toFixed(2)

  const augments = [me.playerAugment1, me.playerAugment2, me.playerAugment3, me.playerAugment4].filter(Boolean)
  // CDragon に存在するIDが1件以上ある場合のみ表示（unknown IDは非表示）
  const hasAugments = augments.some((id) => augmentMap.has(id))

  return (
    <div className={`rounded-lg border-l-2 bg-[#080c14] overflow-hidden ${win ? 'border-blue-500' : 'border-red-600'}`}>
      {/* クリックで開閉 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-[#0f1923] transition-colors"
      >
        {/* チャンピオンアイコン */}
        <div className="relative shrink-0">
          <img
            src={dd.championIcon(me.champion_name)}
            alt={me.champion_name}
            className="w-12 h-12 rounded-full object-cover border border-[#1e2a3a]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <span className="absolute -bottom-0.5 -right-0.5 text-[10px] bg-[#0a0e1a] border border-[#1e2a3a] px-1 rounded leading-tight font-semibold">
            {me.champ_level}
          </span>
        </div>

        {/* 結果 + モード */}
        <div className="w-20 shrink-0">
          <p className={`text-sm font-bold ${win ? 'text-blue-400' : 'text-red-400'}`}>
            {win ? '勝利' : '敗北'}
          </p>
          <p className="text-xs text-gray-500 truncate">{getQueueLabel(match.info.queue_id)}</p>
        </div>

        {/* KDA */}
        <div className="shrink-0 min-w-[70px]">
          <p className="text-sm font-semibold tabular-nums">
            {me.kills}/{me.deaths}/{me.assists}
          </p>
          <p className="text-xs text-gray-500">KDA {kda}</p>
        </div>

        {/* アイテム */}
        <div className="flex items-center gap-1 shrink-0">
          {[me.item0, me.item1, me.item2, me.item3, me.item4, me.item5].map((id, i) => {
            const tip = id > 0 ? dd.itemTooltip(id) : null
            return (
              <Tooltip key={i} name={id > 0 ? dd.itemName(id) : null} stats={tip?.stats} effects={tip?.effects}>
                <div className="w-8 h-8 rounded bg-[#1a2433] overflow-hidden shrink-0">
                  {id > 0 && (
                    <img src={dd.itemIcon(id) ?? ''} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>
              </Tooltip>
            )
          })}
          {(() => {
            const tip = me.item6 > 0 ? dd.itemTooltip(me.item6) : null
            return (
              <Tooltip name={me.item6 > 0 ? dd.itemName(me.item6) : null} stats={tip?.stats} effects={tip?.effects}>
                <div className="w-8 h-8 rounded-full bg-[#1a2433] overflow-hidden shrink-0 ml-0.5">
                  {me.item6 > 0 && (
                    <img src={dd.itemIcon(me.item6) ?? ''} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>
              </Tooltip>
            )
          })()}
        </div>

        <div className="flex-1" />

        {/* オーグメント */}
        {hasAugments && (
          <div className="flex items-center gap-1 shrink-0">
            {augments.map((id, i) => {
              const iconUrl = augmentMap.get(id) ?? null
              const augDesc = augmentDescMap.get(id)
              return (
                <Tooltip key={i} name={augmentNameMap.get(id)} effects={augDesc ? [augDesc] : undefined}>
                  <div className="w-8 h-8 rounded bg-[#1a2433] overflow-hidden shrink-0">
                    {iconUrl && (
                      <img src={iconUrl} alt="" className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                  </div>
                </Tooltip>
              )
            })}
          </div>
        )}

        {/* 時刻 + 時間 */}
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">{formatTimeAgo(match.info.game_end_timestamp)}</p>
          <p className="text-xs text-gray-600">{formatDuration(match.info.game_duration)}</p>
        </div>

        {/* 展開アイコン */}
        <svg
          viewBox="0 0 24 24" fill="currentColor"
          className={`w-4 h-4 text-gray-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {/* アコーディオン詳細 */}
      {open && <MatchAccordionDetail match={match} myPuuid={myPuuid} augmentMap={augmentMap} championMap={championMap} />}
    </div>
  )
}

const TIER_LABEL: Record<string, string> = {
  IRON: 'アイアン',
  BRONZE: 'ブロンズ',
  SILVER: 'シルバー',
  GOLD: 'ゴールド',
  PLATINUM: 'プラチナ',
  EMERALD: 'エメラルド',
  DIAMOND: 'ダイヤモンド',
  MASTER: 'マスター',
  GRANDMASTER: 'グランドマスター',
  CHALLENGER: 'チャレンジャー',
}

function rankIconUrl(tier: string): string {
  const t = tier.toLowerCase()
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/images/ranked-emblem/emblem-${t}.png`
}

const HONOR_COLORS: Record<number, string> = {
  1: 'text-gray-400 border-gray-600',
  2: 'text-green-400 border-green-700',
  3: 'text-blue-400 border-blue-700',
  4: 'text-purple-400 border-purple-700',
  5: 'text-[#c89b3c] border-[#c89b3c]',
}

function HonorBadge({ level }: { level: number }) {
  const color = HONOR_COLORS[level] ?? 'text-gray-400 border-gray-600'
  return (
    <div className={`flex items-center gap-1.5 border rounded-lg px-2 py-1 ${color}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
      </svg>
      <span className="text-sm font-bold">Lv. {level}</span>
    </div>
  )
}

const PODIUM_ORDER = [1, 0, 2] // 表彰台：2位・1位・3位の順に並べる

function MasteryPodium({
  top3,
  championMap,
}: {
  top3: Array<{ championId: number; championPoints: number }>
  championMap: Map<number, string>
}) {
  const sizes = ['w-10 h-10', 'w-8 h-8', 'w-7 h-7']
  const bases = ['h-6', 'h-4', 'h-3']
  const baseColors = ['bg-[#c89b3c]', 'bg-[#9ca3af]', 'bg-[#b45309]']
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="flex items-end gap-2">
      {PODIUM_ORDER.map((rank) => {
        const champ = top3[rank]
        if (!champ) return null
        const name = championMap.get(champ.championId) ?? ''
        return (
          <div key={rank} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px]">{medals[rank]}</span>
            <img
              src={dd.championIcon(name)}
              alt={name}
              className={`${sizes[rank]} rounded-full object-cover border-2 ${rank === 0 ? 'border-[#c89b3c]' : rank === 1 ? 'border-[#9ca3af]' : 'border-[#b45309]'}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <p className="text-[9px] text-gray-400 tabular-nums">
              {(champ.championPoints / 1000).toFixed(0)}k
            </p>
            <div className={`w-full min-w-[28px] rounded-t ${baseColors[rank]} ${bases[rank]}`} />
          </div>
        )
      })}
    </div>
  )
}

function RankBadge({ rank }: { rank: LcuQueueStats }) {
  if (!rank.tier || rank.tier === 'UNRANKED' || rank.tier === '') {
    return <span className="text-sm text-gray-500">未ランク</span>
  }
  const winRate = rank.wins + rank.losses > 0
    ? Math.round((rank.wins / (rank.wins + rank.losses)) * 100)
    : null
  return (
    <div className="flex items-center gap-2">
      <img
        src={rankIconUrl(rank.tier)}
        alt={rank.tier}
        className="w-10 h-10 object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <div>
        <p className="text-sm font-bold text-white">
          {TIER_LABEL[rank.tier] ?? rank.tier} {rank.division !== 'NA' ? rank.division : ''}
        </p>
        <p className="text-xs text-[#c89b3c]">{rank.leaguePoints} LP</p>
        {winRate !== null && (
          <p className="text-[10px] text-gray-500">
            {rank.wins}勝 {rank.losses}敗 / 勝率 {winRate}%
          </p>
        )}
      </div>
    </div>
  )
}

export function DesktopHomePage(): JSX.Element {
  const navigate = useNavigate()
  const { isConnected, isConnecting, summoner, champSelect, gameflowPhase, connect } = useLcu()
  const [favorites, setFavorites] = useState<FavoriteChampion[]>([])
  const [soloRank, setSoloRank] = useState<LcuQueueStats | null>(null)
  const [flexRank, setFlexRank] = useState<LcuQueueStats | null>(null)
  const [honorLevel, setHonorLevel] = useState<number | null>(null)
  const [masteryInfo, setMasteryInfo] = useState<{ totalScore: number; top3: Array<{ championId: number; championPoints: number }> } | null>(null)
  const championMap = useChampionMap()
  const augmentMap = useAugmentMap()
  const { matches, loading: matchLoading, error: matchError, reload: reloadMatches } = useMatchHistory(
    isConnected ? summoner : null,
    undefined,
    championMap
  )
  useEffect(() => {
    window.electronAPI.favorites.list().then(setFavorites)
  }, [])

  useEffect(() => {
    if (!isConnected || !summoner) return
    window.electronAPI.lcu.getRankedStats().then((stats) => {
      if (!stats?.queueMap) return
      setSoloRank(stats.queueMap['RANKED_SOLO_5x5'] ?? null)
      setFlexRank(stats.queueMap['RANKED_FLEX_SR'] ?? null)
    })
    window.electronAPI.lcu.getHonorProfile().then((h) => {
      setHonorLevel(h?.honorLevel ?? null)
    })
    window.electronAPI.lcu.getMasteryScore(summoner.summonerId, summoner.puuid).then(setMasteryInfo)
  }, [isConnected, summoner])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* LCU 接続ステータス */}
      <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${
                isConnected ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-red-500'
              }`}
            />
            <div>
              <p className="font-medium">
                {isConnected ? 'LoLクライアントに接続中' : 'LoLクライアント未接続'}
              </p>
              <p className="text-sm text-gray-400 mt-0.5">
                {isConnected
                  ? 'チャンピオン選択画面でオーバーレイが表示されます'
                  : 'LoLを起動してから接続してください'}
              </p>
              {/* 現在の状態バッジ */}
              {isConnected && gameflowPhase && gameflowPhase !== 'None' && (
                <span
                  className={`inline-flex items-center gap-1 mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#1e2a3a] border border-[#2a3a4a] ${PHASE_COLORS[gameflowPhase]}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                  {PHASE_LABELS[gameflowPhase]}
                </span>
              )}
            </div>
          </div>
          {!isConnected && (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-4 py-2 bg-[#c89b3c] hover:bg-[#d4a94a] disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded text-sm transition-colors shrink-0"
            >
              {isConnecting ? '接続中...' : 'LoLクライアントに接続'}
            </button>
          )}
        </div>
      </section>

      {/* サモナー情報 */}
      {isConnected && summoner && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-5">
          <div className="flex items-center gap-5">
            {/* プロフィールアイコン + レベル */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-16 h-16 rounded-full bg-[#1e2a3a] overflow-hidden border-2 border-[#c89b3c] flex items-center justify-center">
                {dd.profileIcon(summoner.profileIconId) ? (
                  <img
                    src={dd.profileIcon(summoner.profileIconId)!}
                    alt="プロフィールアイコン"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement
                      el.style.display = 'none'
                      el.parentElement!.innerHTML = `<span class="text-2xl font-bold text-[#c89b3c]">${summoner.displayName.charAt(0).toUpperCase()}</span>`
                    }}
                  />
                ) : (
                  <span className="text-2xl font-bold text-[#c89b3c]">
                    {summoner.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="mt-1.5 text-[11px] font-semibold text-gray-300 bg-[#0a0e1a] border border-[#2a3a4a] px-2 py-0.5 rounded-full">
                Lv. {summoner.summonerLevel}
              </span>
            </div>

            {/* サモナー名 + ランク横並び */}
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-[#c89b3c] truncate mb-3">{summoner.displayName}</p>
              <div className="flex items-center gap-5 flex-wrap">
                {/* ソロ/デュオ */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">ソロ / デュオ</p>
                  {soloRank ? <RankBadge rank={soloRank} /> : <span className="text-sm text-gray-500">未ランク</span>}
                </div>
                <div className="w-px h-10 bg-[#1e2a3a]" />
                {/* フレックス */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">フレックス</p>
                  {flexRank ? <RankBadge rank={flexRank} /> : <span className="text-sm text-gray-500">未ランク</span>}
                </div>
                <div className="w-px h-10 bg-[#1e2a3a]" />
                {/* 名誉レベル */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">名誉</p>
                  {honorLevel !== null
                    ? <HonorBadge level={honorLevel} />
                    : <span className="text-sm text-gray-500">—</span>
                  }
                </div>
                <div className="w-px h-10 bg-[#1e2a3a]" />
                {/* マスタリースコア */}
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                    マスタリースコア {masteryInfo && <span className="text-white normal-case font-bold">{masteryInfo.totalScore.toLocaleString()}</span>}
                  </p>
                  {masteryInfo ? (
                    <button
                      onClick={() => navigate('/mastery')}
                      className="group hover:opacity-80 transition-opacity"
                      title="詳細を見る"
                    >
                      <MasteryPodium top3={masteryInfo.top3} championMap={championMap} />
                    </button>
                  ) : (
                    <span className="text-sm text-gray-500">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* チャンピオン選択中のチームアイコン */}
      {isConnected && gameflowPhase === 'ChampSelect' && champSelect && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">味方チーム</h2>
            <span className="text-xs text-green-400">
              残り {Math.ceil(champSelect.timer.adjustedTimeLeftInPhase / 1000)}秒
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {champSelect.myTeam.map((player) => {
              const key = championMap.get(player.championId)
              return (
                <div
                  key={player.cellId}
                  className="aspect-square bg-[#1e2a3a] rounded border border-[#2a3a4a] overflow-hidden flex items-center justify-center"
                >
                  {player.championId > 0 && key ? (
                    <img src={dd.championIcon(key)} alt={key} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-600 text-xs">?</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 対戦履歴 */}
      {isConnected && summoner && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">直近の対戦履歴</h2>
            <button
              onClick={() => navigate('/matches')}
              className="text-[11px] text-[#c89b3c] hover:text-[#d4a94a] transition-colors"
            >
              すべて見る →
            </button>
          </div>

          {matchLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-xs">
              <div className="w-4 h-4 border-2 border-[#c89b3c] border-t-transparent rounded-full animate-spin" />
              読み込み中...
            </div>
          )}

          {!matchLoading && matchError && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-lg p-3">
              <span className="text-red-400 text-sm shrink-0">⚠</span>
              <div className="min-w-0">
                <p className="text-red-400 text-xs font-semibold">取得エラー</p>
                <p className="text-red-300/70 text-[11px] mt-0.5 break-all">{matchError}</p>
                <button
                  onClick={reloadMatches}
                  className="mt-2 text-[11px] text-[#c89b3c] hover:text-[#d4a94a] underline"
                >
                  再試行
                </button>
              </div>
            </div>
          )}

          {!matchLoading && !matchError && matches.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-xs text-gray-500">マッチ履歴が見つかりませんでした</p>
              <button
                onClick={reloadMatches}
                className="text-[11px] text-[#c89b3c] hover:text-[#d4a94a] underline"
              >
                再読み込み
              </button>
            </div>
          )}

          {!matchLoading && !matchError && matches.length > 0 && (
            <div className="space-y-1.5">
              {matches.slice(0, 5).map((match) => (
                <MatchRow key={match.info.match_id} match={match} myPuuid={summoner.puuid} augmentMap={augmentMap} championMap={championMap} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* お気に入りチャンピオン */}
      {favorites.length > 0 && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            お気に入りチャンピオン
          </h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map((fav) => {
              const key = championMap.get(fav.championId)
              return (
                <div
                  key={fav.championId}
                  className="flex items-center gap-2 bg-[#1e2a3a] px-3 py-2 rounded border border-[#2a3a4a]"
                >
                  {key ? (
                    <img
                      src={dd.championIcon(key)}
                      alt={fav.championName}
                      className="w-6 h-6 rounded object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-[#2a3a4a]" />
                  )}
                  <span className="text-sm">{fav.championName}</span>
                  <button
                    onClick={async () => {
                      await window.electronAPI.favorites.remove(fav.championId)
                      setFavorites((prev) => prev.filter((f) => f.championId !== fav.championId))
                    }}
                    className="text-gray-500 hover:text-red-400 transition-colors text-xs"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 未接続ガイド */}
      {!isConnected && !isConnecting && (
        <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-8 text-center">
          <div className="text-5xl mb-4">⚔️</div>
          <h2 className="text-lg font-semibold mb-2">LoLクライアントが検出されません</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            League of Legends を起動してから
            <br />
            「LoLクライアントに接続」ボタンを押してください。
            <br />
            <span className="text-[#c89b3c]">チャンピオン選択画面</span>
            になると自動的にオーバーレイが表示されます。
          </p>
        </section>
      )}
    </div>
  )
}

export default DesktopHomePage
