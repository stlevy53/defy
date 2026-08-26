import { describe, expect, it } from 'vitest'
import type { StorageLike } from './coachLaunch'
import type { GameState } from '../engine'
import {
  appendGameRecord,
  buildGameRecord,
  clearGames,
  exportProfileJson,
  getDisplayName,
  importProfileJson,
  loadProfile,
  PROFILE_KEY,
  setDisplayName,
  type GameRecord,
} from './profile'

function mem(init: Record<string, string> = {}): StorageLike {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v)
    },
  }
}

const rec = (over: Partial<GameRecord> = {}): GameRecord => ({
  playedAt: 1,
  seed: 42,
  draft: false,
  outcome: 'win',
  tier: 'Victory',
  points: 20,
  defeatedVp: 20,
  round: 5,
  failedMissions: 0,
  civiliansLost: 0,
  missionsDefeated: ['border'],
  ...over,
})

describe('profile persistence', () => {
  it('returns an empty profile when nothing is stored', () => {
    const p = loadProfile(mem())
    expect(p.games).toEqual([])
    expect(p.displayName).toBe('')
  })

  it('tolerates corrupt JSON', () => {
    const p = loadProfile(mem({ [PROFILE_KEY]: '{ not json' }))
    expect(p.games).toEqual([])
  })

  it('round-trips the display name', () => {
    const store = mem()
    setDisplayName('Maquis', store)
    expect(getDisplayName(store)).toBe('Maquis')
  })

  it('appends records in order', () => {
    const store = mem()
    appendGameRecord(rec({ seed: 1 }), store)
    appendGameRecord(rec({ seed: 2 }), store)
    const p = loadProfile(store)
    expect(p.games.map((g) => g.seed)).toEqual([1, 2])
  })

  it('clears history but keeps the name', () => {
    const store = mem()
    setDisplayName('Pilar', store)
    appendGameRecord(rec(), store)
    clearGames(store)
    const p = loadProfile(store)
    expect(p.games).toEqual([])
    expect(p.displayName).toBe('Pilar')
  })

  it('exports and re-imports a career', () => {
    const store = mem()
    setDisplayName('Roberto', store)
    appendGameRecord(rec({ seed: 7 }), store)
    const json = exportProfileJson(store)

    const other = mem()
    const r = importProfileJson(json, other)
    expect(r.ok && r.count).toBe(1)
    const p = loadProfile(other)
    expect(p.displayName).toBe('Roberto')
    expect(p.games[0].seed).toBe(7)
  })

  it('rejects a non-profile import', () => {
    expect(importProfileJson('{"foo":1}', mem())).toEqual({ ok: false, reason: 'That file is not a DEFY profile.' })
    expect(importProfileJson('nope', mem()).ok).toBe(false)
  })
})

describe('buildGameRecord', () => {
  // Only the zones buildGameRecord reads; the rest of GameState is irrelevant here.
  const stateWith = (over: Partial<GameState>): GameState =>
    ({ defeatedMissions: [], graveyard: [], round: 1, failedMissions: 0, result: null, ...over }) as unknown as GameState

  it('maps a win result and progress fields', () => {
    const state = stateWith({
      result: { outcome: 'win', tier: 'Victory', points: 20 },
      round: 6,
      failedMissions: 1,
    })
    const r = buildGameRecord(state, 999, true, 12345)
    expect(r).toMatchObject({
      seed: 999,
      draft: true,
      playedAt: 12345,
      outcome: 'win',
      tier: 'Victory',
      points: 20,
      round: 6,
      failedMissions: 1,
      defeatedVp: 0, // no defeated missions in this minimal state
      civiliansLost: 0,
      missionsDefeated: [],
    })
  })

  it('maps a loss result (no points/tier)', () => {
    const state = stateWith({ result: { outcome: 'loss', reason: 'civilians' } })
    const r = buildGameRecord(state, 1, false)
    expect(r.outcome).toBe('loss')
    expect(r.reason).toBe('civilians')
    expect(r.points).toBeUndefined()
    expect(r.tier).toBeUndefined()
  })
})
