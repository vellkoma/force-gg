import { useState, useEffect } from 'react'

let iconCache: Map<number, string> | null = null
let nameCache: Map<number, string> | null = null
let descCache: Map<number, string> | null = null
let fetchPromise: Promise<void> | null = null

function ensureLoaded(): Promise<void> {
  if (iconCache && nameCache && descCache) return Promise.resolve()
  if (fetchPromise) return fetchPromise
  fetchPromise = window.electronAPI.lcu.fetchAugments()
    .then((augments) => {
      const icons = new Map<number, string>()
      const names = new Map<number, string>()
      const descs = new Map<number, string>()
      for (const aug of augments) {
        if (aug.id && aug.iconSmall) icons.set(aug.id, aug.iconSmall)
        if (aug.id && aug.name) names.set(aug.id, aug.name)
        if (aug.id && aug.description) descs.set(aug.id, aug.description)
      }
      iconCache = icons
      nameCache = names
      descCache = descs
      console.log(`[AugmentMap] ${icons.size}件ロード, IDサンプル:`, [...icons.keys()].slice(0, 5))
    })
    .catch((e) => {
      console.error('[AugmentMap] 失敗:', e)
      iconCache = new Map()
      nameCache = new Map()
      descCache = new Map()
    })
  return fetchPromise
}

// id → アイコン URL
export function useAugmentMap(): Map<number, string> {
  const [map, setMap] = useState<Map<number, string>>(iconCache ?? new Map())
  useEffect(() => {
    if (iconCache) return
    ensureLoaded().then(() => setMap(iconCache!))
  }, [])
  return map
}

// id → 日本語名（nameTRA）
export function useAugmentNameMap(): Map<number, string> {
  const [map, setMap] = useState<Map<number, string>>(nameCache ?? new Map())
  useEffect(() => {
    if (nameCache) return
    ensureLoaded().then(() => setMap(nameCache!))
  }, [])
  return map
}

// id → 日本語説明文（descriptionTRA）
export function useAugmentDescMap(): Map<number, string> {
  const [map, setMap] = useState<Map<number, string>>(descCache ?? new Map())
  useEffect(() => {
    if (descCache) return
    ensureLoaded().then(() => setMap(descCache!))
  }, [])
  return map
}
