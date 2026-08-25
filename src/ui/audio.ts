// UI-only sound. The engine stays silent — cues fire from dispatch, card-flight diffs, and overlays.
// Missing files are a no-op so we can drop in recordings later, same seam as card art.
// See docs/AUDIO_SPEC.md.

import type { Action } from '../engine'
import type { StorageLike } from './coachLaunch'

export type SfxName =
  | 'play'
  | 'draw'
  | 'discard'
  | 'choose'
  | 'strike'
  | 'slash'
  | 'reinforce'
  | 'defeat'
  | 'loss'
  | 'winDraw'
  | 'winMinor'
  | 'winVictory'
  | 'winMajor'
  | 'winEpic'

export const SFX_NAMES: readonly SfxName[] = [
  'play',
  'draw',
  'discard',
  'choose',
  'strike',
  'slash',
  'reinforce',
  'defeat',
  'loss',
  'winDraw',
  'winMinor',
  'winVictory',
  'winMajor',
  'winEpic',
]

export const SOUND_MUTED_KEY = 'defy.soundMuted'
export const SOUND_VOLUME_KEY = 'defy.soundVolume'
export const DEFAULT_VOLUME = 0.55

/** Logical cue → filename stem (no extension). Lets one Card Flip cover every table move. */
const CUE_FILE: Record<SfxName, string> = {
  play: 'Card Flip',
  draw: 'Card Flip',
  discard: 'Card Flip',
  reinforce: 'Card Flip',
  choose: 'Mission attack selection audio',
  strike: 'Gunshot',
  slash: 'Knife slash',
  defeat: 'Explosion',
  loss: 'Defeat Audio',
  winDraw: 'Draw Audio',
  winMinor: 'Minor Victory Audio',
  winVictory: 'Victory Audio',
  winMajor: 'Major Victory Audio',
  winEpic: 'Overwhelming Victory Audio',
}

/** Card leaving/entering the hand, or any other flight (draft leftover). Spy out is a slash. */
export function flightSfx(info: {
  discard: boolean
  draw: boolean
  spyLeft?: boolean
  other?: boolean
}): SfxName | null {
  if (info.spyLeft) return 'slash'
  if (info.discard || info.draw || info.other) return 'play'
  return null
}

/** Combat/table cues at the UI dispatch boundary. Engine stays silent. */
export function actionSfx(action: Action, missionUids: readonly string[]): SfxName | null {
  switch (action.type) {
    case 'PlayMaquis':
    case 'MoveMaquis':
      return 'play'
    case 'ChooseMission':
      return 'choose'
    case 'SpendAttackOn':
      return missionUids.includes(action.targetUid) ? 'defeat' : 'strike'
    default:
      return null
  }
}

/** Loss, Draw, Minor, Victory, Major, Epic/Overwhelming. */
export function endgameCue(kind: 'win' | 'loss', tier?: string): SfxName {
  if (kind === 'loss') return 'loss'
  switch (tier) {
    case 'Draw':
      return 'winDraw'
    case 'Minor Victory':
      return 'winMinor'
    case 'Major Victory':
      return 'winMajor'
    case 'Epic Victory':
      return 'winEpic'
    default:
      return 'winVictory'
  }
}

const TIER_BY_LEVEL = ['Draw', 'Minor Victory', 'Victory', 'Major Victory', 'Epic Victory'] as const

type PlayFn = (url: string, volume: number) => void

function index(mods: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, url] of Object.entries(mods)) {
    const file = path.split('/').pop()
    if (!file) continue
    out[file.replace(/\.[^.]+$/, '')] = url
  }
  return out
}

const bundled = index(
  import.meta.glob('../assets/audio/*.{ogg,mp3,wav}', { eager: true, import: 'default' }) as Record<
    string,
    string
  >,
)

let urls: Record<string, string> = bundled
let playFn: PlayFn | null = null
let unlocked = false
let lastStingerKey = ''
let injectedStore: StorageLike | null = null
/** One warmed element per url so a click isn't waiting on decode. A still-playing voice is left
 *  running and replaced, so two quick strikes can overlap. */
const voices = new Map<string, HTMLAudioElement>()

function liveStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function store(s?: StorageLike): StorageLike | null {
  return s ?? injectedStore ?? liveStorage()
}

function read(s: StorageLike | null, key: string): string | null {
  if (!s) return null
  try {
    return s.getItem(key)
  } catch {
    return null
  }
}

function write(s: StorageLike | null, key: string, value: string): void {
  if (!s) return
  try {
    s.setItem(key, value)
  } catch {
    /* quota / private mode */
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, n))
}

export function isMuted(storage?: StorageLike): boolean {
  return read(store(storage), SOUND_MUTED_KEY) === '1'
}

export function getVolume(storage?: StorageLike): number {
  const raw = read(store(storage), SOUND_VOLUME_KEY)
  if (raw == null || raw === '') return DEFAULT_VOLUME
  const n = Number(raw)
  return Number.isFinite(n) ? clamp01(n) : DEFAULT_VOLUME
}

export function setMuted(muted: boolean, storage?: StorageLike): void {
  write(store(storage), SOUND_MUTED_KEY, muted ? '1' : '0')
}

export function setVolume(volume: number, storage?: StorageLike): void {
  write(store(storage), SOUND_VOLUME_KEY, String(clamp01(volume)))
}

function warmup(): void {
  if (typeof Audio === 'undefined') return
  for (const stem of new Set(Object.values(CUE_FILE))) {
    const url = urls[stem]
    if (!url || voices.has(url)) continue
    const el = new Audio(url)
    el.preload = 'auto'
    voices.set(url, el)
  }
}

/** Start every cue file loading from disk right away, independent of the autoplay-unlock gesture.
 *  These are bundled local assets — no network round trip — so there's no reason to wait for a
 *  click before decoding them. Call this once at app mount; `unlock()` still calls `warmup()` too
 *  (idempotent — `voices` skips a url it already holds), so a table opened and clicked before this
 *  finishes still warms up correctly, this just gets a head start. */
export function preloadAudio(): void {
  warmup()
}

export function unlock(): void {
  unlocked = true
  warmup()
}

export function isUnlocked(): boolean {
  return unlocked
}

/** First pointer-down anywhere is a user gesture — browsers/Electron block autoplay until then. */
export function installUnlock(): () => void {
  if (typeof window === 'undefined') return () => {}
  const on = () => {
    unlock()
    window.removeEventListener('pointerdown', on, true)
  }
  window.addEventListener('pointerdown', on, true)
  return () => window.removeEventListener('pointerdown', on, true)
}

function defaultPlay(url: string, volume: number): void {
  if (typeof Audio === 'undefined') return
  let el = voices.get(url)
  if (!el || !el.paused) {
    el = new Audio(url)
    el.preload = 'auto'
    voices.set(url, el)
  }
  el.volume = volume
  try {
    el.currentTime = 0
  } catch {
    /* not loaded yet */
  }
  void el.play().catch(() => {
    /* autoplay still blocked, or file failed — never crash the table */
  })
}

export function playSfx(name: SfxName, opts?: { gain?: number; storage?: StorageLike }): void {
  if (!unlocked) return
  if (isMuted(opts?.storage)) return
  const url = urls[CUE_FILE[name]] ?? urls[name]
  if (!url) return
  const vol = clamp01(getVolume(opts?.storage) * (opts?.gain ?? 1))
  if (vol <= 0) return
  ;(playFn ?? defaultPlay)(url, vol)
}

/** Win/loss fire once per overlay. `key` is gameId+outcome so Play again can sound again. */
export function playEndgameSfx(
  kind: 'win' | 'loss',
  key: string,
  opts?: { tier?: string; winLevel?: number; storage?: StorageLike },
): void {
  if (lastStingerKey === key) return
  lastStingerKey = key
  const tier = opts?.tier ?? (kind === 'win' ? TIER_BY_LEVEL[opts?.winLevel ?? 0] : undefined)
  playSfx(endgameCue(kind, tier), { storage: opts?.storage })
}

/** Test seam: inject urls, a fake player, and storage. Production never calls this. */
export function configureAudio(opts: {
  urls?: Record<string, string>
  play?: PlayFn
  storage?: StorageLike
}): void {
  if (opts.urls) urls = opts.urls
  if (opts.play) playFn = opts.play
  if (opts.storage) injectedStore = opts.storage
}

export function resetAudioForTests(): void {
  urls = bundled
  playFn = null
  unlocked = false
  lastStingerKey = ''
  injectedStore = null
  voices.clear()
}
