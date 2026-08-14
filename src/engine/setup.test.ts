import { describe, it, expect } from 'vitest'
import { createGame } from './setup'
import { missions } from '../data'
import { resolveDecision, legalActions, assertConservation } from './index'
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
    ...(s.draftPool ?? []),
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

function pickHidden(state: GameState, uid: string): GameState {
  const next = resolveDecision(state, { selection: [uid] })
  assertConservation(next)
  return next
}

function draftCandidate(state: GameState, index: 0 | 1): string {
  const d = state.pendingDecision
  if (d?.kind !== 'selectCards') throw new Error('expected a draft pair')
  return d.candidates[index]
}

describe('draft setup', () => {
  it('starts with 24 Maquis in the pool, an empty hand, and a pair to pick', () => {
    const s = createGame({ seed: 12345, draft: true })
    assertConservation(s)
    expect(s.draftPool).toHaveLength(24)
    expect(s.hand).toHaveLength(0)
    expect(s.hidden.deck).toHaveLength(0)
    expect(s.recruit.deck).toHaveLength(0)
    expect(s.spiesAvailable).toBe(6)
    expect(legalActions(s)).toHaveLength(0)
    expect(s.pendingDecision?.kind).toBe('selectCards')
    expect(s.pendingDecision?.kind === 'selectCards' && s.pendingDecision.from).toBe('draft.pool')
    expect(s.pendingDecision?.kind === 'selectCards' && s.pendingDecision.candidates).toEqual([
      s.draftPool![0].uid,
      s.draftPool![1].uid,
    ])
    expect(s.missionRow).toHaveLength(4)
  })

  it('puts the chosen card in Hidden and the leftover in Recruit', () => {
    const s0 = createGame({ seed: 7, draft: true })
    const keep = draftCandidate(s0, 0)
    const other = draftCandidate(s0, 1)
    const s = pickHidden(s0, keep)
    expect(s.hidden.deck.map((c) => c.uid)).toEqual([keep])
    expect(s.recruit.deck.map((c) => c.uid)).toEqual([other])
    expect(s.draftPool).toHaveLength(22)
    expect(s.pendingDecision?.kind === 'selectCards' && s.pendingDecision.candidates).toHaveLength(2)
  })

  it('after twelve picks: 12/12 split, spies in Hidden, hand of 5, no pending pair', () => {
    let s = createGame({ seed: 99, draft: true })
    for (let i = 0; i < 12; i++) {
      const keep = draftCandidate(s, 0)
      s = pickHidden(s, keep)
    }
    expect(s.pendingDecision).toBeNull()
    expect(s.draftPool).toEqual([])
    expect(s.hand).toHaveLength(5)
    expect(s.hidden.deck).toHaveLength(10)
    expect(s.recruit.deck).toHaveLength(12)
    expect(s.spiesAvailable).toBe(3)
    expect(countSpiesInPlay(s)).toBe(3)
    expect(countMaquis(s)).toBe(24)
    expect(legalActions(s).length).toBeGreaterThan(0)
  })

  it('same seed and same picks yield the same game', () => {
    const run = () => {
      let s = createGame({ seed: 4242, draft: true })
      for (let i = 0; i < 12; i++) {
        const keep = draftCandidate(s, 1)
        s = pickHidden(s, keep)
      }
      return s
    }
    expect(run()).toEqual(run())
  })
})
