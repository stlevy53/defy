// Card art manifest. Drop a per-card image into src/assets/cards/<category>/<id>.(jpg|png|webp)
// and it is picked up automatically here — no code change needed. Any card without an image
// falls back to the themed text frame in Card.tsx.
//
// Filenames must match the card IDs used in /data:
//   maquis/<maquis id>       e.g. celia.jpg          (one image; shows both Hidden + Revealed halves)
//   enemy/<enemy type id>    e.g. counter_guerrilla.jpg
//   mission/<mission id>     e.g. bunker.jpg
//   civilian/<civilian id>   e.g. civ_1a.jpg
//   spy/spy.(jpg|png|webp)
//   enemy/back.(jpg|png|webp)   optional face-down Enemy card back

type UrlMap = Record<string, string>

/** Turn a glob result ('.../celia.jpg' -> url) into an id->url map keyed by filename (sans ext). */
function index(mods: Record<string, string>): UrlMap {
  const out: UrlMap = {}
  for (const [path, url] of Object.entries(mods)) {
    const file = path.split('/').pop()
    if (!file) continue
    const id = file.replace(/\.[^.]+$/, '')
    out[id] = url
  }
  return out
}

const glob = (mods: Record<string, unknown>) => index(mods as Record<string, string>)

const maquis = glob(import.meta.glob('../assets/cards/maquis/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' }))
const enemy = glob(import.meta.glob('../assets/cards/enemy/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' }))
const mission = glob(import.meta.glob('../assets/cards/mission/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' }))
const civilian = glob(import.meta.glob('../assets/cards/civilian/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' }))
const spy = glob(import.meta.glob('../assets/cards/spy/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' }))

export const maquisArt = (id: string): string | undefined => maquis[id]
export const enemyArt = (typeId: string): string | undefined => enemy[typeId]
export const enemyBackArt = (): string | undefined => enemy['back']
export const missionArt = (id: string): string | undefined => mission[id]
export const civilianArt = (id: string): string | undefined => civilian[id]
export const spyArt = (): string | undefined => spy['spy']
