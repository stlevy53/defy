// ATTACK sub-slice 1: entering ATTACK and playing out the hand. Covers PlayMaquis/UseAction
// being legal in ATTACK, a PLAN-played card firing its ATTACK action in ATTACK, Spy exclusion,
// and mandatory play-out gating. Attack resolution (SpendAttackOn) and the AFTERMATH transition
// are later sub-slices. Conservation is checked after every action.

import { describe, it, expect } from 'vitest'
import { createGame } from './setup'
import { applyAction, legalActions } from './actions'
import { assertConservation } from './zones'
import { maquis as maquisData } from '../data'
import type { Action, GameState, Side } from './types'

function apply(state: GameState, action: Action): GameState {
  const next = applyAction(state, action)
  assertConservation(next)
  return next
}

const cardData = (dataId: string) => maquisData.find((m) => m.id === dataId)!

/** Enter ATTACK from a fresh game by choosing the first available mission (plays nothing). */
function enterAttack(seed: number): GameState {
  const s = createGame({ seed })
  const next = apply(s, { type: 'ChooseMission', uid: s.missionRow[0].uid })
  expect(next.phase).toBe('ATTACK')
  return next
}

/** First seed (1..1000) whose fresh game satisfies `pred`. */
function seedWhere(pred: (s: GameState) => boolean): number {
  for (let seed = 1; seed <= 1000; seed++) {
    if (pred(createGame({ seed }))) return seed
  }
  throw new Error('no seed found in 1..1000')
}

describe('playing out the hand in ATTACK', () => {
  it('offers both sides for every non-spy hand card and no ChooseMission', () => {
    const state = enterAttack(7)
    const nonSpy = state.hand.filter((c) => c.dataId !== 'spy')
    const plays = legalActions(state).filter((a) => a.type === 'PlayMaquis')
    expect(plays).toHaveLength(nonSpy.length * 2)
    for (const card of nonSpy) {
      expect(plays).toContainEqual({ type: 'PlayMaquis', uid: card.uid, side: 'hidden' as Side })
      expect(plays).toContainEqual({ type: 'PlayMaquis', uid: card.uid, side: 'revealed' as Side })
    }
    expect(legalActions(state).some((a) => a.type === 'ChooseMission')).toBe(false)
  })

  it('moves a card from hand to inPlay when played in ATTACK', () => {
    let state = enterAttack(7)
    const card = state.hand.find((c) => c.dataId !== 'spy')!
    state = apply(state, { type: 'PlayMaquis', uid: card.uid, side: 'revealed' })
    expect(state.hand.find((c) => c.uid === card.uid)).toBeUndefined()
    expect(state.inPlay).toContainEqual({
      uid: card.uid,
      dataId: card.dataId,
      side: 'revealed',
      actionUsed: false,
    })
  })

  it('never offers a Spy as a play', () => {
    // A seed whose starting hand contains a Spy.
    const seed = seedWhere((s) => s.hand.some((c) => c.dataId === 'spy'))
    const state = enterAttack(seed)
    const spyUids = state.hand.filter((c) => c.dataId === 'spy').map((c) => c.uid)
    for (const a of legalActions(state)) {
      if (a.type === 'PlayMaquis') expect(spyUids).not.toContain(a.uid)
    }
  })
})

describe('mandatory play-out gating', () => {
  it('offers no plays once only Spies remain in hand', () => {
    // Seed with exactly one non-spy card would be ideal; instead, play out every non-spy card
    // and assert the offers dry up (only Spies left).
    let state = enterAttack(seedWhere((s) => s.hand.some((c) => c.dataId === 'spy')))
    let guard = 0
    while (state.hand.some((c) => c.dataId !== 'spy') && guard++ < 20) {
      const card = state.hand.find((c) => c.dataId !== 'spy')!
      state = apply(state, { type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
    }
    expect(state.hand.every((c) => c.dataId === 'spy')).toBe(true)
    expect(legalActions(state).filter((a) => a.type === 'PlayMaquis')).toHaveLength(0)
  })
})

describe('a PLAN-played card fires its ATTACK action in ATTACK', () => {
  it('offers UseAction in ATTACK for an ATTACK-side action played during PLAN', () => {
    // Find a seed whose hand holds a Maquis with an ATTACK (not PLAN) hidden action, so that
    // playing it in PLAN leaves the action unusable until ATTACK.
    const seed = seedWhere((s) =>
      s.hand.some((c) => c.dataId !== 'spy' && cardData(c.dataId).hidden.actionType === 'ATTACK'),
    )
    let state = createGame({ seed })
    const card = state.hand.find(
      (c) => c.dataId !== 'spy' && cardData(c.dataId).hidden.actionType === 'ATTACK',
    )!

    // Play it hidden during PLAN — its ATTACK action must NOT be offered yet.
    state = apply(state, { type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
    expect(legalActions(state).some((a) => a.type === 'UseAction' && a.uid === card.uid)).toBe(false)

    // Move to ATTACK; now the ATTACK action is offered.
    state = apply(state, { type: 'ChooseMission', uid: state.missionRow[0].uid })
    expect(state.phase).toBe('ATTACK')
    expect(legalActions(state).some((a) => a.type === 'UseAction' && a.uid === card.uid)).toBe(true)

    // Using it consumes the action (effect is still an unregistered ATTACK stub for now).
    state = apply(state, { type: 'UseAction', uid: card.uid })
    expect(state.inPlay.find((c) => c.uid === card.uid)?.actionUsed).toBe(true)
    expect(state.log.some((l) => l.includes('[stub]'))).toBe(true)
  })
})
