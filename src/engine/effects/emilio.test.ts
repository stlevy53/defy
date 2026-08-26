// Emilio's copy meta-effect. Emilio (hidden) copies the hidden action of another hidden Maquis in
// play whose action fires in the current phase, delegating to that Maquis's registered handler —
// including nested decisions. Registers the real PLAN effects; conservation after every action.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { produce } from 'immer'
import { createGame } from '../setup'
import { applyAction, legalActions, resolveDecision } from '../actions'
import { assertConservation } from '../zones'
import { unregisterEffect, maquisEffectId } from './registry'
import { registerPlanEffects, PLAN_EFFECTS } from './plan'
import { canFireEffect } from './preconditions'
import type { Action, GameState, Side } from '../types'

beforeAll(() => registerPlanEffects())
afterAll(() => {
  for (const id of Object.keys(PLAN_EFFECTS)) unregisterEffect(id)
})

function apply(state: GameState, action: Action): GameState {
  const next = applyAction(state, action)
  assertConservation(next)
  return next
}
function resolve(state: GameState, selection: string[]): GameState {
  const next = resolveDecision(state, { selection })
  assertConservation(next)
  return next
}

/** First fresh game whose hand contains all of `ids`. */
function seedWithHand(...ids: string[]): GameState {
  for (let seed = 1; seed <= 3000; seed++) {
    const s = createGame({ seed })
    if (ids.every((id) => s.hand.some((c) => c.dataId === id))) return s
  }
  throw new Error(`no seed with ${ids.join(' + ')} in hand`)
}

const play = (s: GameState, dataId: string, side: Side) =>
  apply(s, { type: 'PlayMaquis', uid: s.hand.find((c) => c.dataId === dataId)!.uid, side })

describe('Emilio copies a hidden action', () => {
  it('copies a simple draw (Manuela): delegates and draws a card', () => {
    let s = seedWithHand('emilio', 'manuela')
    s = play(s, 'emilio', 'hidden')
    s = play(s, 'manuela', 'hidden')

    const handBefore = s.hand.length
    const deckBefore = s.hidden.deck.length
    s = apply(s, { type: 'UseAction', uid: 'emilio' })
    expect(s.pendingDecision?.kind).toBe('selectTarget')
    expect((s.pendingDecision as { candidates: string[] }).candidates).toContain('manuela')

    s = resolve(s, ['manuela'])
    expect(s.pendingDecision).toBeNull()
    expect(s.hand.length).toBe(handBefore + 1)
    expect(s.hidden.deck.length).toBe(deckBefore - 1)
  })

  it('copies a multi-stage action (Juana look-top-3), threading nested decisions', () => {
    let s = seedWithHand('emilio', 'juana')
    s = play(s, 'emilio', 'hidden')
    s = play(s, 'juana', 'hidden')
    const top = s.hidden.deck.slice(0, 3).map((c) => c.uid)

    s = apply(s, { type: 'UseAction', uid: 'emilio' }) // -> selectTarget
    s = resolve(s, ['juana']) // -> Juana's selectCards (discard)
    expect(s.pendingDecision?.kind).toBe('selectCards')
    s = resolve(s, [top[0]]) // -> Juana's orderCards (reorder the kept)
    expect(s.pendingDecision?.kind).toBe('orderCards')
    s = resolve(s, [top[2], top[1]])
    expect(s.pendingDecision).toBeNull()

    expect(s.hidden.discard.map((c) => c.uid)).toContain(top[0])
    expect(s.hidden.deck[0].uid).toBe(top[2])
    expect(s.hidden.deck[1].uid).toBe(top[1])
  })
})

describe('Emilio precondition', () => {
  it('is not offered when there is no valid Maquis to copy', () => {
    let s = seedWithHand('emilio')
    s = play(s, 'emilio', 'hidden') // only Emilio in play — nothing to copy
    expect(canFireEffect(maquisEffectId('emilio', 'hidden'), s)).toBe(false)
    expect(legalActions(s).some((a) => a.type === 'UseAction' && a.uid === 'emilio')).toBe(false)
  })

  it('is not offered when the only copy target cannot complete (Antonio, no Spy in hand)', () => {
    let s = seedWithHand('emilio', 'antonio')
    s = play(s, 'emilio', 'hidden')
    s = play(s, 'antonio', 'hidden')
    s = produce(s, (d) => {
      const spies = d.hand.filter((c) => c.dataId === 'spy')
      d.hand = d.hand.filter((c) => c.dataId !== 'spy')
      d.hidden.discard.push(...spies)
    })
    expect(canFireEffect(maquisEffectId('emilio', 'hidden'), s)).toBe(false)
    expect(legalActions(s).some((a) => a.type === 'UseAction' && a.uid === 'emilio')).toBe(false)
    // Sides stay unlocked — the player can still flip Carlos / Antonio without spending Emilio.
    expect(legalActions(s).some((a) => a.type === 'MoveMaquis')).toBe(true)
  })

  it('is offered when another hidden Maquis can complete even if Antonio cannot', () => {
    let s = seedWithHand('emilio', 'antonio', 'manuela')
    s = play(s, 'emilio', 'hidden')
    s = play(s, 'antonio', 'hidden')
    s = play(s, 'manuela', 'hidden')
    s = produce(s, (d) => {
      const spies = d.hand.filter((c) => c.dataId === 'spy')
      d.hand = d.hand.filter((c) => c.dataId !== 'spy')
      d.hidden.discard.push(...spies)
    })
    expect(canFireEffect(maquisEffectId('emilio', 'hidden'), s)).toBe(true)
    s = apply(s, { type: 'UseAction', uid: 'emilio' })
    expect(s.pendingDecision?.kind).toBe('selectTarget')
    const candidates = (s.pendingDecision as { candidates: string[] }).candidates
    expect(candidates).toContain('manuela')
    expect(candidates).not.toContain('antonio')
  })
})
