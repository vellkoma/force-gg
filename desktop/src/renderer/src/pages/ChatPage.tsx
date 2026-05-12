import { useState, useRef, useEffect, useCallback } from 'react'
import { useLcu } from '../context/LcuContext'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_ACTIONS = [
  '直近10試合を分析して',
  '今のメタで強いチャンピオンは？',
  'ランクを上げるためのアドバイスをください',
  '今のパッチで上手いプレイヤーが意識していることは？',
]

async function fetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
  const token = await window.electronAPI.settings.get('auth_access_token')
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
}

export function ChatPage(): JSX.Element {
  const { summoner } = useLcu()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'こんにちは！force.gg AI コーチです。LoLのパフォーマンス向上をお手伝いします。何でも気軽に聞いてください！',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.settings.get('auth_is_premium', 'false').then((v) => {
      setIsPremium(v === 'true')
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return
      const userMsg: Message = { role: 'user', content: text }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setLoading(true)

      try {
        const res = await fetchWithAuth('/api/coaching/analyze', {
          method: 'POST',
          body: JSON.stringify({
            champion_name: '',
            role: '',
            recent_stats: { query: text, summoner: summoner?.displayName ?? 'unknown' },
            rank: 'PLATINUM',
          }),
        })

        if (res.status === 403) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                'AI コーチング機能はプレミアム会員限定です。設定 → アカウントからアップグレードしてください。',
            },
          ])
          return
        }

        if (!res.ok) throw new Error(`${res.status}`)

        const data = (await res.json()) as {
          summary?: string
          strengths?: string[]
          improvements?: string[]
          tips?: string[]
        }

        const parts: string[] = []
        if (data.summary) parts.push(data.summary)
        if (data.strengths?.length) parts.push(`**強み**: ${data.strengths.join('、')}`)
        if (data.improvements?.length)
          parts.push(`**改善点**: ${data.improvements.join('、')}`)
        if (data.tips?.length) parts.push(`**アドバイス**: ${data.tips.join(' / ')}`)

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: parts.join('\n\n') || '分析完了しました。' },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'エラーが発生しました。しばらくしてから再試行してください。',
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [loading, summoner]
  )

  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー */}
      <div className="border-b border-[#1e2a3a] px-6 py-4 shrink-0">
        <h1 className="text-lg font-bold text-[#c89b3c]">AI コーチング</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {isPremium ? 'Claude AI によるパーソナルコーチング' : 'プレミアム会員で全機能利用可能'}
        </p>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-[#c89b3c] rounded-full flex items-center justify-center text-black text-xs font-bold shrink-0 mt-0.5 mr-2">
                AI
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#c89b3c]/20 border border-[#c89b3c]/30 text-gray-100'
                  : 'bg-[#0f1923] border border-[#1e2a3a] text-gray-200'
              }`}
            >
              {msg.content.split('\n\n').map((para, j) => (
                <p key={j} className={j > 0 ? 'mt-2' : ''}>
                  {para.startsWith('**') ? (
                    <>
                      <strong className="text-[#c89b3c]">
                        {para.slice(2, para.indexOf('**', 2))}
                      </strong>
                      {para.slice(para.indexOf('**', 2) + 2)}
                    </>
                  ) : (
                    para
                  )}
                </p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-[#c89b3c] rounded-full flex items-center justify-center text-black text-xs font-bold shrink-0 mt-0.5 mr-2">
              AI
            </div>
            <div className="bg-[#0f1923] border border-[#1e2a3a] rounded-lg px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-[#c89b3c] rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* クイックアクション */}
      {messages.length <= 1 && (
        <div className="px-6 pb-2 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => send(action)}
              disabled={loading}
              className="text-xs border border-[#2a3a4a] hover:border-[#c89b3c]/50 text-gray-400 hover:text-white px-3 py-1.5 rounded transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* 入力欄 */}
      <div className="border-t border-[#1e2a3a] px-6 py-4 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="質問を入力してください..."
            disabled={loading}
            className="flex-1 bg-[#0f1923] border border-[#1e2a3a] focus:border-[#c89b3c]/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-[#c89b3c] hover:bg-[#d4a94a] disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-semibold rounded-lg text-sm transition-colors"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatPage
