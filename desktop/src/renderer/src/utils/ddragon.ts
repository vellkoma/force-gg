const VERSION = '15.24.1'
const CDN = `https://ddragon.leagueoflegends.com/cdn/${VERSION}`

export const dd = {
  championIcon: (name: string) => `${CDN}/img/champion/${name}.png`,
  profileIcon: (id: number) => `${CDN}/img/profileicon/${id}.png`,
  itemIcon: (id: number) => (id > 0 ? `${CDN}/img/item/${id}.png` : null),
  spellIcon: (key: string) => `${CDN}/img/spell/${key}.png`,
}
