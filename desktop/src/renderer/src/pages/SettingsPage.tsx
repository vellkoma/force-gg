import { useState, useEffect } from 'react'

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-[#c89b3c]' : 'bg-[#2a3a4a]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="py-3">
      <div className="flex justify-between mb-1.5">
        <p className="text-sm text-gray-200">{label}</p>
        <span className="text-sm text-[#c89b3c]">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#c89b3c]"
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#0f1923] rounded-lg border border-[#1e2a3a] p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 pb-2 border-b border-[#1e2a3a]">
        {title}
      </h2>
      <div className="divide-y divide-[#1e2a3a]/50">{children}</div>
    </section>
  )
}

export function SettingsPage(): JSX.Element {
  const [overlayAutoShow, setOverlayAutoShow] = useState(true)
  const [overlayOpacity, setOverlayOpacity] = useState(90)
  const [loginItem, setLoginItem] = useState(false)
  const [version, setVersion] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [autoShow, opacity, ver] = await Promise.all([
        window.electronAPI.settings.get('overlay_auto_show', 'true'),
        window.electronAPI.settings.get('overlay_opacity', '90'),
        window.electronAPI.app.getVersion(),
      ])
      setOverlayAutoShow(autoShow !== 'false')
      setOverlayOpacity(Number(opacity) || 90)
      setVersion(ver)
    }
    load()
  }, [])

  async function save(key: string, value: string) {
    setSaving(true)
    await window.electronAPI.settings.set(key, value)
    setSaving(false)
  }

  async function handleLoginItem(v: boolean) {
    setLoginItem(v)
    await window.electronAPI.system.setLoginItem(v)
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#c89b3c]">設定</h1>
        {saving && <span className="text-xs text-gray-500">保存中...</span>}
      </div>

      {/* オーバーレイ */}
      <Section title="オーバーレイ">
        <Toggle
          label="チャンピオン選択時に自動表示"
          description="チャンピオン選択画面になると自動的にオーバーレイを表示します"
          checked={overlayAutoShow}
          onChange={(v) => {
            setOverlayAutoShow(v)
            save('overlay_auto_show', String(v))
          }}
        />
        <SliderRow
          label="オーバーレイの不透明度"
          value={overlayOpacity}
          min={50}
          max={100}
          onChange={(v) => {
            setOverlayOpacity(v)
            save('overlay_opacity', String(v))
          }}
        />
      </Section>

      {/* 起動 */}
      <Section title="起動">
        <Toggle
          label="Windows 起動時に自動起動"
          description="サインイン時に force.gg Desktop を自動的に起動します"
          checked={loginItem}
          onChange={handleLoginItem}
        />
      </Section>

      {/* アプリ情報 */}
      <Section title="アプリ情報">
        <div className="flex items-center justify-between py-3">
          <p className="text-sm text-gray-200">バージョン</p>
          <span className="text-sm text-gray-400">v{version}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm text-gray-200">アップデート確認</p>
          </div>
          <button
            onClick={() => window.electronAPI.update.check()}
            className="text-xs border border-[#2a3a4a] hover:border-[#c89b3c]/50 text-gray-400 hover:text-white px-3 py-1.5 rounded transition-colors"
          >
            確認する
          </button>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm text-gray-200">ログフォルダ</p>
            <p className="text-xs text-gray-500 mt-0.5">デバッグ用ログファイルの保存場所</p>
          </div>
          <button
            onClick={() => window.electronAPI.system.openLogFolder()}
            className="text-xs border border-[#2a3a4a] hover:border-[#c89b3c]/50 text-gray-400 hover:text-white px-3 py-1.5 rounded transition-colors"
          >
            開く
          </button>
        </div>
      </Section>
    </div>
  )
}

export default SettingsPage
