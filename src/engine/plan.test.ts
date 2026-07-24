// PLAN-phase slice tests: legalActions, PlayMaquis, UseAction (stub + real handler),
// ChooseMission, the decision suspend/resume loop, conservation, and determinism.

import { describe, it, expect, afterEach } from 'vitest'
import { createGame } from './setup'
import { applyAction, legalActions, resolveDecision } from './actions'
import { assertConservation } from './zones'
import { registerEffect, unregisterEffect, maquisEffectId } from './effects/registry'
import { maquis as maquisData } from '../data'
import type { Action, GameState } from './types'

const SEED = 42

/** First non-spy card in hand, or throw. */
function firstMaquisInHand(state: GameState) {
  const card = state.hand.find((c) => c.dataId !== 'spy')
  if (!card) throw new Error('test setup: no maquis in hand')
  return card
}

/**
 * Deterministically find a seed whose starting hand contains a Maquis with a
 * PLAN or PLAN/ATTACK action on its hidden side (so UseAction is exercisable).
 */
function seedWithPlanActionInHand(): { seed: number; uid: string; dataId: string } {
  for (let seed = 1; seed <= 100; seed++) {
    const state = createGame({ seed })
    for (const card of state.hand) {
      if (card.dataId === 'spy') continue
      // Emilio's action has a precondition (needs another valid Maquis in play to copy), so it
      // isn't a clean "offered once when played alone" example — skip it here.
      if (card.dataId === 'emilio') continue
      const data = maquisData.find((m) => m.id === card.dataId)!
      const t = data.hidden.actionType
      if (t === 'PLAN' || t === 'PLAN/ATTACK') {
        return { seed, uid: card.uid, dataId: card.dataId }
      }
    }
  }
  throw new Error('no suitable seed found in 1..100')
}

describe('legalActions in PLAN', () => {
  it('offers both sides for every non-spy hand card, no spy plays, all 4 missions', () => {
    const state = createGame({ seed: SEED })
    const actions = legalActions(state)

    const nonSpy = state.hand.filter((c) => c.dataId !== 'spy')
    const plays = actions.filter((a) => a.type === 'PlayMaquis')
    expect(plays).toHaveLength(nonSpy.length * 2)
    for (const card of nonSpy) {
      expect(plays).toContainEqual({ type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
      expect(plays).toContainEqual({ type: 'PlayMaquis', uid: card.uid, side: 'revealed' })
    }
    const spyUids = state.hand.filter((c) => c.dataId === 'spy').map((c) => c.uid)
    for (const a of plays) {
      expect(spyUids).not.toContain((a as { uid: string }).uid)
    }

    const missions = actions.filter((a) => a.type === 'ChooseMission')
    expect(missions).toHaveLength(4)

    // Nothing in play yet, so no card actions.
    expect(actions.filter((a) => a.type === 'UseAction')).toHaveLength(0)
  })
})

describe('PlayMaquis', () => {
  it('moves a card from hand to inPlay on the chosen side', () => {
    const state = createGame({ seed: SEED })
    const card = firstMaquisInHand(state)

    const next = applyAction(state, { type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
    expect(next.hand.find((c) => c.uid === card.uid)).toBeUndefined()
    expect(next.inPlay).toContainEqual({
      uid: card.uid,
      dataId: card.dataId,
      side: 'hidden',
      actionUsed: false,
    })
    assertConservation(next)

    // Original state untouched (Immer).
    expect(state.hand.find((c) => c.uid === card.uid)).toBeDefined()
    expect(state.inPlay).toHaveLength(0)
  })

  it('supports the revealed side too', () => {
    const state = createGame({ seed: SEED })
    const card = firstMaquisInHand(state)
    const next = applyAction(state, { type: 'PlayMaquis', uid: card.uid, side: 'revealed' })
    expect(next.inPlay[0].side).toBe('revealed')
    assertConservation(next)
  })

  it('rejects spies and cards not in hand', () => {
    const state = createGame({ seed: SEED })
    expect(() =>
      applyAction(state, { type: 'PlayMaquis', uid: 'nope', side: 'hidden' }),
    ).toThrow(/not in hand/)

    // Find a seed with a spy in hand to assert the spy rejection.
    for (let seed = 1; seed <= 200; seed++) {
      const s = createGame({ seed })
      const spy = s.hand.find((c) => c.dataId === 'spy')
      if (spy) {
        expect(() =>
          applyAction(s, { type: 'PlayMaquis', uid: spy.uid, side: 'hidden' }),
        ).toThrow(/never playable/)
        return
      }
    }
    throw new Error('no seed with a spy in hand found in 1..200')
  })
})

describe('UseAction', () => {
  const found = seedWithPlanActionInHand()

  it('is offered for a played card with a PLAN-usable action, once', () => {
    let state = createGame({ seed: found.seed })
    state = applyAction(state, { type: 'PlayMaquis', uid: found.uid, side: 'hidden' })

    const offer = legalActions(state).filter(
      (a): a is Extract<Action, { type: 'UseAction' }> => a.type === 'UseAction',
    )
    expect(offer.map((a) => a.uid)).toContain(found.uid)

    // Unregistered effect -> [stub] log, action consumed, queue drained.
    const after = applyAction(state, { type: 'UseAction', uid: found.uid })
    expect(after.inPlay.find((c) => c.uid === found.uid)?.actionUsed).toBe(true)
    expect(after.effectQueue).toHaveLength(0)
    expect(after.pendingDecision).toBeNull()
    expect(after.log.some((l) => l.includes('[stub]'))).toBe(true)
    expect(
      legalActions(after).filter((a) => a.type === 'UseAction' && a.uid === found.uid),
    ).toHaveLength(0)
    expect(() => applyAction(after, { type: 'UseAction', uid: found.uid })).toThrow(
      /already used/,
    )
    assertConservation(after)
  })
})

describe('decision suspend/resume (effect-queue driver)', () => {
  const found = seedWithPlanActionInHand()
  const effectId = maquisEffectId(found.dataId, 'hidden')

  afterEach(() => unregisterEffect(effectId))

  it('suspends on a Decision, resumes via resolveDecision, and completes', () => {
    // Test handler: "look at the top 2 of the Hidden deck, discard up to 2".
    registerEffect(effectId, ({ state, responses }) => {
      const top2 = state.hidden.deck.slice(0, 2).map((c) => c.uid)
      if (responses.length === 0) {
        return {
          kind: 'selectCards',
          from: 'hidden.deck',
          min: 0,
          max: 2,
          prompt: 'Discard up to 2 of the top 2 cards',
          candidates: top2,
        }
      }
      const chosen = responses[0]
      for (const uid of chosen) {
        const idx = state.hidden.deck.findIndex((c) => c.uid === uid)
        state.hidden.discard.push(state.hidden.deck.splice(idx, 1)[0])
      }
    })

    let state = createGame({ seed: found.seed })
    state = applyAction(state, { type: 'PlayMaquis', uid: found.uid, side: 'hidden' })
    const deckBefore = state.hidden.deck.map((c) => c.uid)

    // Suspends: pendingDecision set, task still queued, no legal actions offered.
    state = applyAction(state, { type: 'UseAction', uid: found.uid })
    expect(state.pendingDecision).not.toBeNull()
    expect(state.pendingDecision!.kind).toBe('selectCards')
    expect(state.effectQueue).toHaveLength(1)
    expect(legalActions(state)).toHaveLength(0)
    expect(() =>
      applyAction(state, { type: 'ChooseMission', uid: state.missionRow[0].uid }),
    ).toThrow(/decision is pending/)

    // Invalid responses rejected.
    expect(() => resolveDecision(state, { selection: ['bogus-uid'] })).toThrow(
      /not a candidate/,
    )

    // Resume: discard the top card.
    const pick = deckBefore[0]
    state = resolveDecision(state, { selection: [pick] })
    expect(state.pendingDecision).toBeNull()
    expect(state.effectQueue).toHaveLength(0)
    expect(state.hidden.discard.map((c) => c.uid)).toContain(pick)
    expect(state.hidden.deck.map((c) => c.uid)).not.toContain(pick)
    assertConservation(state)

    // Play resumes normally afterwards.
    expect(legalActions(state).length).toBeGreaterThan(0)
  })
})

describe('ChooseMission', () => {
  it('flips the garrison face-up, records the choice, and moves to ATTACK', () => {
    const state = createGame({ seed: SEED })
    const slot = state.missionRow[1]
    expect(slot.enemies.every((e) => !e.faceUp)).toBe(true)

    const next = applyAction(state, { type: 'ChooseMission', uid: slot.uid })
    expect(next.chosenMissionUid).toBe(slot.uid)
    expect(next.phase).toBe('ATTACK')
    const chosen = next.missionRow.find((s) => s.uid === slot.uid)!
    expect(chosen.enemies.every((e) => e.faceUp)).toBe(true)
    // Other garrisons stay face-down.
    for (const other of next.missionRow.filter((s) => s.uid !== slot.uid)) {
      expect(other.enemies.every((e) => !e.faceUp)).toBe(true)
    }
    assertConservation(next)

    // Now in ATTACK: the remaining hand must be played out (attack resolution is a later
    // sub-slice). Plays are offered; ChooseMission is not, and is rejected outside PLAN.
    const nonSpy = next.hand.filter((c) => c.dataId !== 'spy')
    expect(legalActions(next).filter((a) => a.type === 'PlayMaquis')).toHaveLength(nonSpy.length * 2)
    expect(legalActions(next).some((a) => a.type === 'ChooseMission')).toBe(false)
    expect(() => applyAction(next, { type: 'ChooseMission', uid: slot.uid })).toThrow(
      /only legal during PLAN/,
    )
  })
})

describe('scripted PLAN sequence', () => {
  it('holds conservation after every action and is deterministic', () => {
    const run = (): GameState => {
      let state = createGame({ seed: SEED })
      assertConservation(state)
      const [a, b] = state.hand.filter((c) => c.dataId !== 'spy')
      for (const action of [
        { type: 'PlayMaquis', uid: a.uid, side: 'hidden' },
        { type: 'PlayMaquis', uid: b.uid, side: 'revealed' },
        { type: 'ChooseMission', uid: state.missionRow[0].uid },
      ] as Action[]) {
        state = applyAction(state, action)
        assertConservation(state)
      }
      return state
    }

    const s1 = run()
    const s2 = run()
    expect(s1).toEqual(s2)
    expect(s1.inPlay).toHaveLength(2)
    expect(s1.phase).toBe('ATTACK')
  })
})
