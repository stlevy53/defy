import { describe, it, expect } from 'vitest'
import { createGame } from './setup'
import { missions } from '../data'
import type { GameState } from './types'

const countEnemies = (s: GameState): number =>
  s.enemyDeck.length +
  s.enemyDiscard.length +
  s.missionRow.reduce((n, m) => n + m.enemies.length, 0)

const countMaquis = (s: GameState): number => {
  const zones = [
    ...s.hidden.deck,
    ...s.hidden.discard,
    ...s.recruit.deck,
    ...s.recruit.revealed,
    ...s.hand,
  ]
  return zones.filter((c) => c.dataId !== 'spy').length + s.inPlay.length
}

const countSpiesInPlay = (s: GameState): number => {
  const zones = [...s.hidden.deck, ...s.hidden.discard, ...s.hand]
  return zones.filter((c) => c.dataId === 'spy').length
}

describe('createGame produces a legal initial state', () => {
  const s = createGame({ seed: 12345 })

  it('starts in PLAN, round 1, no result', () => {
    expect(s.phase).toBe('PLAN')
    expect(s.round).toBe(1)
    expect(s.result).toBeNull()
  })

  it('deals a hand of 5 and a Hidden deck of the remaining 10 (12 Maquis + 3 Spies - 5)', () => {
    expect(s.hand).toHaveLength(5)
    expect(s.hidden.deck).toHaveLength(10)
    expect(s.hidden.discard).toHaveLength(0)
  })

  it('has a Recruit deck of 12 and empty Revealed pile', () => {
    expect(s.recruit.deck).toHaveLength(12)
    expect(s.recruit.revealed).toHaveLength(0)
  })

  it('has 4 available Missions (all face-up) and a Mission deck of 6', () => {
    expect(s.missionRow).toHaveLength(4)
    expect(s.missionRow.every((m) => !m.faceDown)).toBe(true)
    expect(s.missionDeck).toHaveLength(6)
  })

  it('deals each available Mission Enemies equal to its Garrison', () => {
    for (const slot of s.missionRow) {
      const data = missions.find((m) => m.id === slot.dataId)!
      expect(slot.enemies).toHaveLength(data.garrison)
    }
  })

  it('conserves all cards: 24 Maquis, 6 Spies, 32 Enemies, 8 Civilians, 10 Missions in play', () => {
    expect(countMaquis(s)).toBe(24)
    expect(countSpiesInPlay(s) + s.spiesAvailable).toBe(6)
    expect(countSpiesInPlay(s)).toBe(3)
    expect(countEnemies(s)).toBe(32)
    expect(s.civilianDeck.length + s.graveyard.length).toBe(8)
    expect(s.missionRow.length + s.missionDeck.length).toBe(10)
  })

  it('all available missions are Era 1; mission deck is Era 2 then Era 3', () => {
    for (const slot of s.missionRow) {
      expect(missions.find((m) => m.id === slot.dataId)!.era).toBe(1)
    }
    const eras = s.missionDeck.map((c) => missions.find((m) => m.id === c.dataId)!.era)
    expect(eras).toEqual([...eras].sort())
    expect(eras.filter((e) => e === 2)).toHaveLength(3)
    expect(eras.filter((e) => e === 3)).toHaveLength(3)
  })
})

describe('determinism', () => {
  it('same seed yields identical state', () => {
    expect(createGame({ seed: 42 })).toEqual(createGame({ seed: 42 }))
  })

  it('different seeds generally differ', () => {
    const a = createGame({ seed: 1 })
    const b = createGame({ seed: 2 })
    expect(a.hand.map((c) => c.uid)).not.toEqual(b.hand.map((c) => c.uid))
  })
})
