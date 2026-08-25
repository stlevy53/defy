// Per-effect tests for the PLAN card-action slice. One test per effect family (families that
// share a factory are covered by a representative member), plus precondition gating. Conservation
// is asserted after every applyAction / resolveDecision via the local `apply` / `resolve` wrappers.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createGame } from '../setup'
import { applyAction, legalActions, resolveDecision } from '../actions'
import { assertConservation } from '../zones'
import { maquisEffectId, unregisterEffect } from './registry'
import { registerPlanEffects, PLAN_EFFECTS } from './plan'
import { canFireEffect } from './preconditions'
import type { Action, GameState } from '../types'

beforeAll(() => registerPlanEffects())
// Guard against cross-file registry leakage regardless of vitest isolation settings.
afterAll(() => {
  for (const id of Object.keys(PLAN_EFFECTS)) unregisterEffect(id)
})

const isSpy = (c: { dataId: string }) => c.dataId === 'spy'

/** applyAction + conservation check. */
function apply(state: GameState, action: Action): GameState {
  const next = applyAction(state, action)
  assertConservation(next)
  return next
}

/** resolveDecision + conservation check. */
function resolve(state: GameState, selection: string[]): GameState {
  const next = resolveDecision(state, { selection })
  assertConservation(next)
  return next
}

/** First seed (1..1000) whose fresh game satisfies `pred`. */
function seedWhere(pred: (s: GameState) => boolean): GameState {
  for (let seed = 1; seed <= 1000; seed++) {
    const s = createGame({ seed })
    if (pred(s)) return s
  }
  throw new Error('no seed found in 1..1000')
}

const handHas = (dataId: string) => (s: GameState) => s.hand.some((c) => c.dataId === dataId)

/** Move a Spy from the Hidden deck into the hand (mutates a fresh, unfrozen createGame result). */
function injectSpyIntoHand(s: GameState): void {
  if (s.hand.some(isSpy)) return
  const i = s.hidden.deck.findIndex(isSpy)
  if (i === -1) throw new Error('no spy in hidden deck to inject')
  s.hand.push(s.hidden.deck.splice(i, 1)[0])
}

/** Remove every Spy from the hand back into the Hidden deck (to force a no-spy precondition). */
function stripSpiesFromHand(s: GameState): void {
  for (let i = s.hand.length - 1; i >= 0; i--) {
    if (isSpy(s.hand[i])) s.hidden.deck.push(s.hand.splice(i, 1)[0])
  }
}

/** Play a hand card on a side and return the resulting state (conservation-checked). */
function play(state: GameState, dataId: string, side: 'hidden' | 'revealed'): GameState {
  const card = state.hand.find((c) => c.dataId === dataId)
  if (!card) throw new Error(`test: ${dataId} not in hand`)
  return apply(state, { type: 'PlayMaquis', uid: card.uid, side })
}

const useAction = (state: GameState, dataId: string): GameState =>
  apply(state, { type: 'UseAction', uid: dataId }) // maquis uid === dataId at setup

describe('draw effects', () => {
  it('Manuela hidden draws 1 from the Hidden deck', () => {
    let s = seedWhere(handHas('manuela'))
    s = play(s, 'manuela', 'hidden')
    const handBefore = s.hand.length
    const deckBefore = s.hidden.deck.length
    s = useAction(s, 'manuela')
    expect(s.hand.length).toBe(handBefore + 1)
    expect(s.hidden.deck.length).toBe(deckBefore - 1)
    expect(s.pendingDecision).toBeNull()
  })

  it('Carlos revealed draws 2 from the Hidden deck', () => {
    let s = seedWhere(handHas('carlos'))
    s = play(s, 'carlos', 'revealed')
    const handBefore = s.hand.length
    const deckBefore = s.hidden.deck.length
    s = useAction(s, 'carlos')
    expect(s.hand.length).toBe(handBefore + 2)
    expect(s.hidden.deck.length).toBe(deckBefore - 2)
  })
})

describe('look at top 3, discard, reorder', () => {
  it('Juana hidden discards one of the top 3 and reorders the rest onto the Hidden deck', () => {
    let s = seedWhere(handHas('juana'))
    s = play(s, 'juana', 'hidden')
    const top = s.hidden.deck.slice(0, 3).map((c) => c.uid)

    s = useAction(s, 'juana')
    expect(s.pendingDecision?.kind).toBe('selectCards')

    s = resolve(s, [top[0]]) // discard the first of the three
    expect(s.pendingDecision?.kind).toBe('orderCards')

    s = resolve(s, [top[2], top[1]]) // put the kept two back reversed
    expect(s.pendingDecision).toBeNull()
    expect(s.hidden.discard.map((c) => c.uid)).toContain(top[0])
    expect(s.hidden.deck[0].uid).toBe(top[2])
    expect(s.hidden.deck[1].uid).toBe(top[1])
  })

  it('Juana still looks at 3 when the Hidden deck is nearly empty (reshuffles the discard)', () => {
    const s0 = seedWhere(handHas('juana'))
    // Deplete the Hidden deck to a single card, banking the rest in the discard.
    while (s0.hidden.deck.length > 1) s0.hidden.discard.push(s0.hidden.deck.pop()!)
    expect(s0.hidden.deck.length).toBe(1)
    expect(s0.hidden.discard.length).toBeGreaterThanOrEqual(2)

    let s = play(s0, 'juana', 'hidden')
    s = useAction(s, 'juana')
    expect(s.pendingDecision?.kind).toBe('selectCards')
    expect((s.pendingDecision as { candidates: string[] }).candidates).toHaveLength(3) // reshuffled discard tops the deck back up
    assertConservation(s)
  })

  it('Roberto hidden operates on the Enemy deck', () => {
    let s = seedWhere(handHas('roberto'))
    s = play(s, 'roberto', 'hidden')
    const top = s.enemyDeck.slice(0, 3).map((e) => e.uid)
    const discardBefore = s.enemyDiscard.length

    s = useAction(s, 'roberto')
    s = resolve(s, [top[0]]) // discard one enemy
    s = resolve(s, [top[1], top[2]]) // keep the rest in place
    expect(s.enemyDiscard.length).toBe(discardBefore + 1)
    expect(s.enemyDiscard.map((e) => e.uid)).toContain(top[0])
    expect(s.enemyDeck[0].uid).toBe(top[1])
  })
})

describe('spy effects', () => {
  it('Celia hidden discards a Spy and draws a card', () => {
    const s0 = seedWhere(handHas('celia'))
    injectSpyIntoHand(s0)
    let s = play(s0, 'celia', 'hidden')
    const spyDiscardBefore = s.hidden.discard.filter(isSpy).length
    s = useAction(s, 'celia')
    expect(s.hidden.discard.filter(isSpy).length).toBe(spyDiscardBefore + 1)
    expect(s.hand.some(isSpy)).toBe(false) // the (only injected) spy left the hand
  })

  it('Celia hidden still dumps a Spy when the Hidden deck and discard are both empty', () => {
    const s0 = seedWhere(handHas('celia'))
    injectSpyIntoHand(s0)
    // Empty the Hidden pool so a naive discard-then-draw would shuffle the Spy back in.
    s0.removedFromGame.push(...s0.hidden.deck, ...s0.hidden.discard)
    s0.hidden.deck = []
    s0.hidden.discard = []
    let s = play(s0, 'celia', 'hidden')
    expect(legalActions(s).some((a) => a.type === 'UseAction' && a.uid === 'celia')).toBe(true)

    const spiesInHand = s.hand.filter(isSpy).length
    s = useAction(s, 'celia')
    expect(s.hand.filter(isSpy).length).toBe(spiesInHand - 1)
    expect(s.hidden.discard.filter(isSpy).length).toBe(1)
    expect(s.hidden.deck.length).toBe(0)
    expect(s.log.some((line) => line.includes('no card drawn'))).toBe(true)
  })

  it('Manuela revealed removes a Spy from the game (conservation still balances)', () => {
    const s0 = seedWhere(handHas('manuela'))
    injectSpyIntoHand(s0)
    let s = play(s0, 'manuela', 'revealed')
    expect(s.removedFromGame.length).toBe(0)
    s = useAction(s, 'manuela')
    expect(s.removedFromGame.filter(isSpy).length).toBe(1)
  })
})

describe('Jacinto revealed: discard a Maquis, draw two', () => {
  it('discards the chosen Maquis and draws two', () => {
    let s = seedWhere((st) => handHas('jacinto')(st) && st.hand.filter((c) => !isSpy(c)).length >= 2)
    s = play(s, 'jacinto', 'revealed')
    const target = s.hand.find((c) => !isSpy(c))!
    const handBefore = s.hand.length
    const deckBefore = s.hidden.deck.length

    s = useAction(s, 'jacinto')
    expect(s.pendingDecision?.kind).toBe('selectCards')
    s = resolve(s, [target.uid])

    expect(s.hidden.discard.map((c) => c.uid)).toContain(target.uid)
    // -1 discarded +2 drawn
    expect(s.hand.length).toBe(handBefore - 1 + 2)
    expect(s.hidden.deck.length).toBe(deckBefore - 2)
  })
})

describe('Revealed-pile pick', () => {
  it('Celia revealed moves a card from the Revealed pile to the hand', () => {
    const s0 = seedWhere(handHas('celia'))
    const moved = s0.recruit.deck.shift()! // seed the Revealed pile
    s0.recruit.revealed.push(moved)
    let s = play(s0, 'celia', 'revealed')

    expect(canFireEffect(maquisEffectId('celia', 'revealed'), s)).toBe(true)
    s = useAction(s, 'celia')
    s = resolve(s, [moved.uid])
    expect(s.hand.map((c) => c.uid)).toContain(moved.uid)
    expect(s.recruit.revealed.map((c) => c.uid)).not.toContain(moved.uid)
  })

  it('Juana revealed places a Revealed-pile card on top of the Hidden deck', () => {
    const s0 = seedWhere(handHas('juana'))
    const moved = s0.recruit.deck.shift()!
    s0.recruit.revealed.push(moved)
    let s = play(s0, 'juana', 'revealed')
    s = useAction(s, 'juana')
    s = resolve(s, [moved.uid])
    expect(s.hidden.deck[0].uid).toBe(moved.uid)
  })
})

describe('Scout effects', () => {
  it('Paquita hidden flips all Enemies at one chosen Mission face-up', () => {
    let s = seedWhere(handHas('paquita'))
    s = play(s, 'paquita', 'hidden')
    s = useAction(s, 'paquita')
    expect(s.pendingDecision?.kind).toBe('selectTarget')

    const target = s.missionRow.find((slot) => !slot.faceDown && slot.enemies.length > 0)!
    s = resolve(s, [target.uid])
    const flipped = s.missionRow.find((slot) => slot.uid === target.uid)!
    expect(flipped.enemies.every((e) => e.faceUp)).toBe(true)
    // other garrisons untouched
    for (const other of s.missionRow.filter((slot) => slot.uid !== target.uid)) {
      expect(other.enemies.every((e) => !e.faceUp)).toBe(true)
    }
  })

  it('Pilar hidden flips 1–2 Enemies then discards one of them', () => {
    let s = seedWhere(
      (st) => handHas('pilar')(st) && st.missionRow.some((slot) => slot.enemies.length >= 2),
    )
    s = play(s, 'pilar', 'hidden')
    s = useAction(s, 'pilar')
    expect(s.pendingDecision?.kind).toBe('selectTarget')

    const target = s.missionRow.find((slot) => slot.enemies.length >= 2)!
    s = resolve(s, [target.uid]) // choose the mission
    expect(s.pendingDecision?.kind).toBe('selectCards')

    const twoEnemies = target.enemies.slice(0, 2).map((e) => e.uid)
    s = resolve(s, twoEnemies) // flip two
    expect(s.pendingDecision?.kind).toBe('selectCards')
    // Faces must be up *before* the discard pick, so the player can see what they're choosing.
    const afterFlip = s.missionRow.find((slot) => slot.uid === target.uid)!
    expect(afterFlip.enemies.filter((e) => twoEnemies.includes(e.uid)).every((e) => e.faceUp)).toBe(true)

    s = resolve(s, [twoEnemies[0]]) // discard one of the flipped
    const slotNow = s.missionRow.find((slot) => slot.uid === target.uid)!
    expect(slotNow.enemies.map((e) => e.uid)).not.toContain(twoEnemies[0])
    expect(s.enemyDiscard.map((e) => e.uid)).toContain(twoEnemies[0])
    // the other flipped enemy remains at the mission, now face-up
    const survivor = slotNow.enemies.find((e) => e.uid === twoEnemies[1])!
    expect(survivor.faceUp).toBe(true)
  })
})

describe('Recruit-deck manipulation', () => {
  it('Antonio revealed puts one of the top 3 on the Hidden deck, rest back on Recruit', () => {
    let s = seedWhere(handHas('antonio'))
    s = play(s, 'antonio', 'revealed')
    const top = s.recruit.deck.slice(0, 3).map((c) => c.uid)
    const recruitBefore = s.recruit.deck.length
    const hiddenBefore = s.hidden.deck.length

    s = useAction(s, 'antonio')
    s = resolve(s, [top[0]]) // chosen -> Hidden top
    s = resolve(s, [top[2], top[1]]) // rest back on Recruit
    expect(s.hidden.deck[0].uid).toBe(top[0])
    expect(s.hidden.deck.length).toBe(hiddenBefore + 1)
    expect(s.recruit.deck.length).toBe(recruitBefore - 1)
    expect(s.recruit.deck[0].uid).toBe(top[2])
    expect(s.recruit.deck[1].uid).toBe(top[1])
  })

  it('Ramona hidden puts one of the top 3 on the bottom of the Recruit deck', () => {
    let s = seedWhere(handHas('ramona'))
    s = play(s, 'ramona', 'hidden')
    const top = s.recruit.deck.slice(0, 3).map((c) => c.uid)
    const recruitBefore = s.recruit.deck.length

    s = useAction(s, 'ramona')
    s = resolve(s, [top[0]]) // send top[0] to the bottom
    s = resolve(s, [top[1], top[2]]) // keep the rest on top in order
    expect(s.recruit.deck.length).toBe(recruitBefore) // moved within the deck
    expect(s.recruit.deck[0].uid).toBe(top[1])
    expect(s.recruit.deck[s.recruit.deck.length - 1].uid).toBe(top[0])
  })
})

describe('precondition gating in legalActions', () => {
  it('does not offer Celia hidden (needs a Spy) when the hand has none', () => {
    const s0 = seedWhere(handHas('celia'))
    stripSpiesFromHand(s0)
    const s = play(s0, 'celia', 'hidden')
    expect(canFireEffect(maquisEffectId('celia', 'hidden'), s)).toBe(false)
    expect(legalActions(s).filter((a) => a.type === 'UseAction' && a.uid === 'celia')).toHaveLength(0)
  })

  it('does not offer Celia revealed (needs the Revealed pile) when it is empty', () => {
    const s0 = seedWhere(handHas('celia'))
    expect(s0.recruit.revealed).toHaveLength(0)
    const s = play(s0, 'celia', 'revealed')
    expect(canFireEffect(maquisEffectId('celia', 'revealed'), s)).toBe(false)
    expect(legalActions(s).filter((a) => a.type === 'UseAction' && a.uid === 'celia')).toHaveLength(0)
  })

  it('rejects UseAction thrown at the engine when the precondition fails but is bypassed', () => {
    // legalActions hides it, but applyAction still runs the handler as a safe no-op.
    const s0 = seedWhere(handHas('manuel'))
    stripSpiesFromHand(s0)
    let s = play(s0, 'manuel', 'revealed')
    const removedBefore = s.removedFromGame.length
    s = useAction(s, 'manuel') // no spy -> handler no-ops
    expect(s.removedFromGame.length).toBe(removedBefore)
  })
})
