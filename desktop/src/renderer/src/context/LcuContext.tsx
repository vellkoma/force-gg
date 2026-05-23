import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { ChampSelectSession, LcuSummoner, GameflowPhase, LcuReadyCheck } from '../../../types/lcu'

interface LcuState {
  isConnected: boolean
  isConnecting: boolean
  summoner: LcuSummoner | null
  champSelect: ChampSelectSession | null
  gameflowPhase: GameflowPhase | null
  readyCheck: LcuReadyCheck | null
  connect: () => Promise<void>
  refresh: () => Promise<void>
}

const LcuContext = createContext<LcuState | null>(null)

export function LcuProvider({ children }: { children: ReactNode }): JSX.Element {
  // 初回チェック中は isConnecting: true にして「未接続」UI が瞬間表示されるのを防ぐ
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(true)
  const [summoner, setSummoner] = useState<LcuSummoner | null>(null)
  const [champSelect, setChampSelect] = useState<ChampSelectSession | null>(null)
  const [gameflowPhase, setGameflowPhase] = useState<GameflowPhase | null>(null)
  const [readyCheck, setReadyCheck] = useState<LcuReadyCheck | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchInitialData = useCallback(async () => {
    try {
      const [summonerData, phase] = await Promise.all([
        window.electronAPI.lcu.getSummoner(),
        window.electronAPI.lcu.getGameflowPhase(),
      ])
      setSummoner(summonerData)
      setGameflowPhase(phase)
      if (phase === 'ChampSelect') {
        const session = await window.electronAPI.lcu.getChampSelect()
        setChampSelect(session)
      }
    } catch (err) {
      console.error('[LcuContext] 初期データ取得エラー:', err)
    }
  }, [])

  const connect = useCallback(async () => {
    if (isConnecting) return
    setIsConnecting(true)
    try {
      const connected = await window.electronAPI.lcu.connect()
      setIsConnected(connected)
      if (connected) await fetchInitialData()
    } catch {
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }, [isConnecting, fetchInitialData])

  const refresh = useCallback(async () => {
    if (!isConnected) return
    await fetchInitialData()
  }, [isConnected, fetchInitialData])

  // ポーリング（3秒）
  const startPolling = useCallback(() => {
    if (pollingRef.current) return
    pollingRef.current = setInterval(async () => {
      if (!isConnected) return
      try {
        const phase = await window.electronAPI.lcu.getGameflowPhase()
        setGameflowPhase(phase)
        if (phase === 'ChampSelect') {
          const session = await window.electronAPI.lcu.getChampSelect()
          setChampSelect(session)
          setReadyCheck(null)
        } else if (phase === 'ReadyCheck') {
          const rc = await window.electronAPI.lcu.getReadyCheck()
          setReadyCheck(rc)
          setChampSelect(null)
        } else {
          setChampSelect(null)
          setReadyCheck(null)
        }
      } catch { /* メインプロセスからプッシュ通知で処理 */ }
    }, 1500)
  }, [isConnected])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // メインプロセスからのイベント購読
  useEffect(() => {
    window.electronAPI.on('lcu:connectionChanged', (connected: unknown) => {
      const now = connected as boolean
      setIsConnected(now)
      if (now) {
        fetchInitialData()
      } else {
        setSummoner(null)
        setChampSelect(null)
        setGameflowPhase(null)
        setReadyCheck(null)
        stopPolling()
      }
    })
    window.electronAPI.on('lcu:phaseChanged', (phase: unknown) => {
      setGameflowPhase(phase as GameflowPhase)
      if (phase !== 'ChampSelect') setChampSelect(null)
      if (phase !== 'ReadyCheck') setReadyCheck(null)
    })
    window.electronAPI.on('lcu:champSelectUpdate', (session: unknown) => {
      setChampSelect(session as ChampSelectSession)
    })
    return () => {
      window.electronAPI.off('lcu:connectionChanged')
      window.electronAPI.off('lcu:phaseChanged')
      window.electronAPI.off('lcu:champSelectUpdate')
    }
  }, [fetchInitialData, stopPolling])

  // 接続状態に合わせてポーリング制御
  useEffect(() => {
    if (isConnected) startPolling()
    else stopPolling()
    return stopPolling
  }, [isConnected, startPolling, stopPolling])

  // アプリ起動時に一度だけ接続試行
  useEffect(() => {
    window.electronAPI.lcu.connect().then(async (connected) => {
      setIsConnected(connected)
      if (connected) await fetchInitialData()
    }).finally(() => {
      setIsConnecting(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LcuContext.Provider
      value={{ isConnected, isConnecting, summoner, champSelect, gameflowPhase, readyCheck, connect, refresh }}
    >
      {children}
    </LcuContext.Provider>
  )
}

export function useLcu(): LcuState {
  const ctx = useContext(LcuContext)
  if (!ctx) throw new Error('useLcu は LcuProvider 内で使用してください')
  return ctx
}
