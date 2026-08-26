// Player profile & career store (design: docs/PROFILE_STATS_SPEC.md). One local profile while
// prototyping: a display name plus one compact GameRecord appended when a game reaches GAME_OVER.
// Every career stat and chart is derived from these records at read time (see stats.ts) — no
// pre-aggregated counters that would go stale when we invent a new stat. The record shape is kept
// Steam-cloud-friendly (plain JSON, mission *dataIds* not uids) so the eventual Steam swap is a
// swap of the identity field, not a rewrite.

import type { GameState } from '../engine'
import type { StorageLike } from './coachLaunch'
import { missionOf, graveyardCivilians } from './format'

export const PROFILE_KEY = 'defy.profile.v1'
export const PROFILE_VERSION = 1 as const

/** One finished game — the LOCKED 1 contract. Append-only; never mutated after write.
 *  Every field is derivable from the final GameState + GameResult (no mid-game instrumentation). */
export interface GameRecord {
  // --- Run identity ---
  playedAt: number // Date.now() at GAME_OVER
  seed: number // reproduces the deal from Settings
  draft: boolean // draft setup used?
  durationMs?: number // optional; only when a New Game clock exists

  // --- Official result (from GameResult) ---
  outcome: 'win' | 'loss'
  tier?: string // win only: Draw | Minor Victory | Victory | Major Victory | Epic Victory
  points?: number // win only: official banked VP
  reason?: string // loss only: 'civilians' | 'missions' | 'spies'

  // --- Progress, present even on a loss (from final zones) ---
  defeatedVp: number // sum of victoryPoints over defeatedMissions
  round: number
  failedMissions: number
  civiliansLost: number // SUM of civilian counts in the graveyard (loss threshold is 5)
  missionsDefeated: string[] // dataIds (not uids) so joins survive across builds
}

/** The single local profile document persisted under PROFILE_KEY. */
export interface Profile {
  version: number
  displayName: string
  games: GameRecord[]
}

function emptyProfile(): Profile {
  return { version: PROFILE_VERSION, displayName: '', games: [] }
}

function live(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

/** Read the profile, tolerating a missing / corrupt document by returning an empty one. */
export function loadProfile(storage?: StorageLike | null): Profile {
  const store = storage ?? live()
  if (!store) return emptyProfile()
  try {
    const raw = store.getItem(PROFILE_KEY)
    if (!raw) return emptyProfile()
    const p = JSON.parse(raw) as Partial<Profile>
    if (!p || !Array.isArray(p.games)) return emptyProfile()
    return {
      version: typeof p.version === 'number' ? p.version : PROFILE_VERSION,
      displayName: typeof p.displayName === 'string' ? p.displayName : '',
      games: p.games as GameRecord[],
    }
  } catch {
    return emptyProfile()
  }
}

export function saveProfile(profile: Profile, storage?: StorageLike | null): void {
  const store = storage ?? live()
  if (!store) return
  try {
    store.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    /* quota / private mode — this session just won't remember */
  }
}

export function getDisplayName(storage?: StorageLike | null): string {
  return loadProfile(storage).displayName
}

export function setDisplayName(name: string, storage?: StorageLike | null): Profile {
  const p = loadProfile(storage)
  p.displayName = name
  saveProfile(p, storage)
  return p
}

/** Append one finished-game record and persist. Returns the updated profile. */
export function appendGameRecord(record: GameRecord, storage?: StorageLike | null): Profile {
  const p = loadProfile(storage)
  p.games.push(record)
  saveProfile(p, storage)
  return p
}

/** Wipe the career (keeps the display name) — a playtest reset. */
export function clearGames(storage?: StorageLike | null): Profile {
  const p = loadProfile(storage)
  p.games = []
  saveProfile(p, storage)
  return p
}

/** Serialize the whole profile for a manual backup so a prototype wipe isn't fatal. */
export function exportProfileJson(storage?: StorageLike | null): string {
  return JSON.stringify(loadProfile(storage), null, 2)
}

/** Replace the stored profile from an exported JSON string. Validates the basic shape. */
export function importProfileJson(
  text: string,
  storage?: StorageLike | null,
): { ok: true; count: number } | { ok: false; reason: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'That file is not valid JSON.' }
  }
  const p = parsed as Partial<Profile>
  if (!p || typeof p !== 'object' || !Array.isArray(p.games)) {
    return { ok: false, reason: 'That file is not a DEFY profile.' }
  }
  const profile: Profile = {
    version: typeof p.version === 'number' ? p.version : PROFILE_VERSION,
    displayName: typeof p.displayName === 'string' ? p.displayName : '',
    games: p.games as GameRecord[],
  }
  saveProfile(profile, storage)
  return { ok: true, count: profile.games.length }
}

/** Build the compact record from the final game state. Called once at GAME_OVER (see App.tsx).
 *  `defeatedVp` and `civiliansLost` reuse the same data lookups the live meters use. */
export function buildGameRecord(
  state: GameState,
  seed: number,
  draft: boolean,
  now: number = Date.now(),
): GameRecord {
  const r = state.result
  const defeatedVp = state.defeatedMissions.reduce(
    (n, m) => n + (missionOf(m.dataId)?.victoryPoints ?? 0),
    0,
  )
  return {
    playedAt: now,
    seed,
    draft,
    outcome: r?.outcome ?? 'loss',
    tier: r?.tier,
    points: r?.points,
    reason: r?.reason,
    defeatedVp,
    round: state.round,
    failedMissions: state.failedMissions,
    civiliansLost: graveyardCivilians(state),
    missionsDefeated: state.defeatedMissions.map((m) => m.dataId),
  }
}
