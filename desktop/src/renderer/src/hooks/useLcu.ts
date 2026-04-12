/**
 * LCU API カスタムフック
 *
 * - 起動時に自動接続を試みる
 * - 3秒ごとにポーリングしてチャンピオン選択状態を更新
 * - メインプロセスからのプッシュ通知も受け取る
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChampSelectSession, LcuSummoner, GameflowPhase } from '../../../types/lcu'

interface UseLcuResult {
  isConnected: boolean
  isConnecting: boolean
  summoner: LcuSummoner | null
  champSelect: ChampSelectSession | null
  gameflowPhase: GameflowPhase | null
  connect: () => Promise<void>
  refresh: () => Promise<void>
}

export function useLcu(): UseLcuResult {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [summoner, setSummoner] = useState<LcuSummoner | null>(null)
  const [champSelect, setChampSelect] = useState<ChampSelectSession | null>(null)
  const [gameflowPhase, setGameflowPhase] = useState<GameflowPhase | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * LCU接続後にサモナー情報などを取得する
   */
  const fetchInitialData = useCallback(async () => {
    try {
      const [summonerData, phase] = await Promise.all([
        window.electronAPI.lcu.getSummoner(),
        window.electronAPI.lcu.getGameflowPhase()
      ])
      setSummoner(summonerData)
      setGameflowPhase(phase)

      if (phase === 'ChampSelect') {
        const session = await window.electronAPI.lcu.getChampSelect()
        setChampSelect(session)
      }
    } catch (err) {
      console.error('[useLcu] 初期データ取得エラー:', err)
    }
  }, [])

  /**
   * 手動で接続を試みる
   */
  const connect = useCallback(async () => {
    if (isConnecting) return
    setIsConnecting(true)
    try {
      const connected = await window.electronAPI.lcu.connect()
      setIsConnected(connected)
      if (connected) {
        await fetchInitialData()
      }
    } catch (err) {
      console.error('[useLcu] 接続エラー:', err)
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }, [isConnecting, fetchInitialData])

  /**
   * 現在の状態を手動で更新する
   */
  const refresh = useCallback(async () => {
    if (!isConnected) return
    await fetchInitialData()
  }, [isConnected, fetchInitialData])

  /**
   * ポーリングループ（3秒ごと）
   * チャンピオン選択中のリアルタイム更新用
   */
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
        } else {
          setChampSelect(null)
        }
      } catch {
        // 接続切断の場合はメインプロセスからプッシュ通知が来る
      }
    }, 3000)
  }, [isConnected])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // メインプロセスからのイベント購読
  useEffect(() => {
    // 接続状態変化の通知
    window.electronAPI.on('lcu:connectionChanged', (connected: unknown) => {
      const isNowConnected = connected as boolean
      setIsConnected(isNowConnected)
      if (isNowConnected) {
        fetchInitialData()
      } else {
        setSummoner(null)
        setChampSelect(null)
        setGameflowPhase(null)
        stopPolling()
      }
    })

    // フェーズ変化の通知
    window.electronAPI.on('lcu:phaseChanged', (phase: unknown) => {
      setGameflowPhase(phase as GameflowPhase)
      if (phase !== 'ChampSelect') {
        setChampSelect(null)
      }
    })

    // チャンピオン選択更新の通知
    window.electronAPI.on('lcu:champSelectUpdate', (session: unknown) => {
      setChampSelect(session as ChampSelectSession)
    })

    // クリーンアップ
    return () => {
      window.electronAPI.off('lcu:connectionChanged')
      window.electronAPI.off('lcu:phaseChanged')
      window.electronAPI.off('lcu:champSelectUpdate')
    }
  }, [fetchInitialData, stopPolling])

  // 接続状態が変化したときにポーリングを開始/停止
  useEffect(() => {
    if (isConnected) {
      startPolling()
    } else {
      stopPolling()
    }
    return stopPolling
  }, [isConnected, startPolling, stopPolling])

  // 初回マウント時に自動接続を試みる
  useEffect(() => {
    connect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    isConnecting,
    summoner,
    champSelect,
    gameflowPhase,
    connect,
    refresh
  }
}
