import { useState, useEffect } from 'react'

const VERSION = '15.24.1'
let cache: Map<number, string> | null = null

/** championId (数値) → DDragon キー名 ("Ahri", "VelKoz" など) のマップを返す */
export function useChampionMap(): Map<number, string> {
  const [map, setMap] = useState<Map<number, string>>(cache ?? new Map())

  useEffect(() => {
    if (cache) return
    fetch(`https://ddragon.leagueoflegends.com/cdn/${VERSION}/data/ja_JP/champion.json`)
      .then(r => r.json())
      .then((json: { data: Record<string, { key: string }> }) => {
        const m = new Map<number, string>()
        for (const [id, champ] of Object.entries(json.data)) {
          m.set(Number(champ.key), id)
        }
        cache = m
        setMap(m)
      })
      .catch(() => {})
  }, [])

  return map
}
