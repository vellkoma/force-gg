import type { FC, FormEvent, ChangeEvent } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  onSearch:        (gameName: string, tagLine: string) => void
  initialValue?:   string
  isLoading?:      boolean
}

export const SummonerSearchBar: FC<Props> = ({
  onSearch,
  initialValue = '',
  isLoading    = false,
}) => {
  const [value, setValue]     = useState(initialValue)
  const [error, setError]     = useState('')

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    if (error) setError('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()

    if (!trimmed.includes('#')) {
      setError('GameName#TAG 形式で入力してください（例: ねこ#JP1）')
      return
    }

    const separatorIndex = trimmed.lastIndexOf('#')
    const gameName = trimmed.slice(0, separatorIndex).trim()
    const tagLine  = trimmed.slice(separatorIndex + 1).trim()

    if (!gameName || !tagLine) {
      setError('GameName#TAG 形式で入力してください（例: ねこ#JP1）')
      return
    }

    setError('')
    onSearch(gameName, tagLine)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto" noValidate>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={value}
            onChange={handleChange}
            placeholder="ゲーム名#TAG を入力（例: ねこ#JP1）"
            aria-label="サモナー名を入力"
            aria-describedby={error ? 'search-error' : undefined}
            className={[
              'w-full bg-lol-card border rounded-xl px-4 py-3',
              'text-lol-text placeholder-lol-text-sub',
              'font-sans text-base',
              'outline-none transition-colors duration-200',
              'focus:border-lol-accent focus:ring-1 focus:ring-lol-accent/40',
              error
                ? 'border-lol-error focus:border-lol-error focus:ring-lol-error/40'
                : 'border-lol-border hover:border-lol-border-hover',
            ].join(' ')}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          className="shrink-0 px-6"
        >
          検索
        </Button>
      </div>

      {error && (
        <p
          id="search-error"
          role="alert"
          className="mt-2 text-sm text-lol-error"
        >
          {error}
        </p>
      )}
    </form>
  )
}
