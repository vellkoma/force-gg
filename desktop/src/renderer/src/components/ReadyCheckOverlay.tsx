import { useState, useEffect, useCallback, useRef } from 'react'
import { useLcu } from '../context/LcuContext'

const TOTAL_SECONDS = 12

export function ReadyCheckOverlay(): JSX.Element | null {
  const { gameflowPhase, readyCheck } = useLcu()
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [minimized, setMinimized] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // ドラッグ状態
  const panelRef = useRef<HTMLDivElement>(null)
  const dragOffset = useRef<{ x: number; y: number } | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null) // null = 初期中央

  const isVisible = gameflowPhase === 'ReadyCheck'

  // フェーズが変わったらリセット
  useEffect(() => {
    if (!isVisible) {
      setMinimized(false)
      setDismissed(false)
      setPos(null)
    }
  }, [isVisible])

  // タイマー管理（readyCheck.timer は経過秒数 → 残り = TOTAL_SECONDS - elapsed）
  useEffect(() => {
    if (!isVisible || readyCheck === null) {
      setTimeLeft(0)
      return
    }
    setTimeLeft(Math.max(0, TOTAL_SECONDS - Math.round(readyCheck.timer)))
  }, [readyCheck, isVisible])

  useEffect(() => {
    if (!isVisible || timeLeft <= 0) return
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [isVisible, timeLeft])

  // ドラッグ処理
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    e.preventDefault()
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragOffset.current) return
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
    }
    const onMouseUp = () => { dragOffset.current = null }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const handleAccept = useCallback(async () => {
    if (accepting || declining) return
    setAccepting(true)
    try {
      await window.electronAPI.lcu.acceptMatch()
    } catch (err) {
      console.error('[ReadyCheck] accept エラー:', err)
    } finally {
      setAccepting(false)
    }
  }, [accepting, declining])

  const handleDecline = useCallback(async () => {
    if (accepting || declining) return
    setDeclining(true)
    try {
      await window.electronAPI.lcu.declineMatch()
    } catch (err) {
      console.error('[ReadyCheck] decline エラー:', err)
    } finally {
      setDeclining(false)
    }
  }, [accepting, declining])

  if (!isVisible || dismissed) return null

  const alreadyResponded =
    readyCheck?.playerResponse === 'Accepted' || readyCheck?.playerResponse === 'Declined'
  const circumference = 2 * Math.PI * 38
  const progress = timeLeft / TOTAL_SECONDS

  // 位置スタイル：ドラッグ後は fixed 座標、初期は画面中央
  const posStyle: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, transform: 'none' }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <>
      {/* 背景オーバーレイ（最小化中は非表示） */}
      {!minimized && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm pointer-events-none" />
      )}

      {/* パネル本体 */}
      <div
        ref={panelRef}
        style={{ ...posStyle, zIndex: 50 }}
        className="bg-[#0a0e1a] border border-[#1e2a3a] rounded-2xl shadow-2xl select-none"
      >
        {/* タイトルバー（ドラッグハンドル） */}
        <div
          onMouseDown={onMouseDown}
          className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2a3a] cursor-grab active:cursor-grabbing rounded-t-2xl"
        >
          <span className="text-[#c89b3c] font-bold text-sm tracking-wide">
            {minimized ? `マッチ承認 ${timeLeft}s` : 'マッチが見つかりました'}
          </span>
          <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
            {/* 最小化 */}
            <button
              onClick={() => setMinimized(v => !v)}
              title={minimized ? '展開' : '最小化'}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-xs"
            >
              {minimized ? '▲' : '▼'}
            </button>
            {/* 閉じる */}
            <button
              onClick={() => setDismissed(true)}
              title="閉じる"
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-red-600/70 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* コンテンツ（最小化時は非表示） */}
        {!minimized && (
          <div className="px-8 py-6 flex flex-col items-center gap-5 w-72">
            <span className="text-gray-400 text-xs">対戦を承認してください</span>

            {/* カウントダウンサークル */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" width="96" height="96">
                <circle cx="48" cy="48" r="38" fill="none" stroke="#1e2a3a" strokeWidth="5" />
                <circle
                  cx="48" cy="48" r="38"
                  fill="none"
                  stroke={timeLeft <= 3 ? '#ef4444' : '#c89b3c'}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className={`text-3xl font-bold tabular-nums ${timeLeft <= 3 ? 'text-red-400' : 'text-white'}`}>
                {timeLeft}
              </span>
            </div>

            {/* 承認済み表示 / ボタン */}
            {alreadyResponded ? (
              <div className={`text-sm font-semibold ${
                readyCheck?.playerResponse === 'Accepted' ? 'text-green-400' : 'text-red-400'
              }`}>
                {readyCheck?.playerResponse === 'Accepted'
                  ? '✓ 承認済み — 他プレイヤーを待機中'
                  : '✕ 拒否済み'}
              </div>
            ) : (
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleAccept}
                  disabled={accepting || declining}
                  className="flex-1 py-3 rounded-xl bg-[#c89b3c] hover:bg-[#d4a94a] active:scale-95 text-black font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#c89b3c]/20"
                >
                  {accepting ? '...' : '承認'}
                </button>
                <button
                  onClick={handleDecline}
                  disabled={accepting || declining}
                  className="flex-1 py-3 rounded-xl bg-[#1e2a3a] hover:bg-[#2a3a4a] active:scale-95 text-gray-300 font-bold text-sm border border-[#2a3a4a] hover:border-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {declining ? '...' : '拒否'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
