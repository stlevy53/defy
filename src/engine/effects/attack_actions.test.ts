// ATTACK effects (chunk 2): enemy discard/move, counter-guerrilla sweep, Consuelo's discard+gain,
// ATTACK draws, and precondition gating. Registers the real ATTACK effects; conservation after
// every action.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createGame } from '../setup'
import { applyAction, resolveDecision } from '../actions'
import { assertConservation } from '../zones'
import { unregisterEffect, maquisEffectId } from './registry'
import { registerAttackEffects, ATTACK_EFFECTS } from './attack'
import { canFireEffect } from './preconditions'
import type { Action, GameState, Side } from '../types'

beforeAll(() => registerAttackEffects())
afterAll(() => {
  for (const id of Object.keys(ATTACK_EFFECTS)) unregisterEffect(id)
})

const CG = 'counter_guerrilla'

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

const chosen = (s: GameState) => s.missionRow.find((x) => x.uid === s.chosenMissionUid)!

/** Play `dataId` (side), then choose the mission at `missionIndex` -> ATTACK. */
function playThenChoose(s: GameState, dataId: string, side: Side, missionIndex: number): GameState {
  const card = s.hand.find((c) => c.dataId === dataId)!
  let next = apply(s, { type: 'PlayMaquis', uid: card.uid, side })
  return apply(next, { type: 'ChooseMission', uid: next.missionRow[missionIndex].uid })
}

/** First seed where `dataId` is in hand and mission `missionIndex` satisfies `missionPred`. */
function findSeed(dataId: string, missionPred: (slot: GameState['missionRow'][number]) => boolean) {
  for (let seed = 1; seed <= 1000; seed++) {
    const s = createGame({ seed })
    if (!s.hand.some((c) => c.dataId === dataId)) continue
    const mi = s.missionRow.findIndex(missionPred)
    if (mi !== -1) return { s, mi }
  }
  throw new Error(`no seed for ${dataId}`)
}

describe('enemy discard', () => {
  it('Anastasio revealed discards one Enemy (no DEFEAT — discard ≠ defeat)', () => {
    const { s, mi } = findSeed('anastasio', (slot) => slot.enemies.length >= 1)
    let g = playThenChoose(s, 'anastasio', 'revealed', mi)
    const slot = chosen(g)
    const target = slot.enemies[0]
    const before = slot.enemies.length

    g = apply(g, { type: 'UseAction', uid: 'anastasio' })
    expect(g.pendingDecision?.kind).toBe('selectTarget')
    g = resolve(g, [target.uid])
    expect(chosen(g).enemies.length).toBe(before - 1)
    expect(g.enemyDiscard.map((e) => e.uid)).toContain(target.uid)
  })

  it('Paquita revealed discards two Enemies', () => {
    const { s, mi } = findSeed('paquita', (slot) => slot.enemies.length >= 2)
    let g = playThenChoose(s, 'paquita', 'revealed', mi)
    const two = chosen(g).enemies.slice(0, 2).map((e) => e.uid)
    const before = chosen(g).enemies.length

    g = apply(g, { type: 'UseAction', uid: 'paquita' })
    expect(g.pendingDecision?.kind).toBe('selectCards')
    g = resolve(g, two)
    expect(chosen(g).enemies.length).toBe(before - 2)
    for (const uid of two) expect(g.enemyDiscard.map((e) => e.uid)).toContain(uid)
  })
})

describe('Consuelo revealed: discard one Enemy, gain its Defense as Attack', () => {
  it('adds the discarded Enemy defense to Attack Strength', () => {
    const { s, mi } = findSeed('consuelo', (slot) => slot.enemies.length >= 1)
    let g = playThenChoose(s, 'consuelo', 'revealed', mi)
    const target = chosen(g).enemies[0]
    const before = g.attackStrength

    g = apply(g, { type: 'UseAction', uid: 'consuelo' })
    g = resolve(g, [target.uid])
    expect(g.attackStrength).toBe(before + target.defense)
    expect(g.enemyDiscard.map((e) => e.uid)).toContain(target.uid)
  })
})

describe('Adela hidden: move an Enemy to another Mission', () => {
  it('relocates the enemy off the chosen mission', () => {
    const { s, mi } = findSeed('adela', (slot) => slot.enemies.length >= 1)
    let g = playThenChoose(s, 'adela', 'hidden', mi)
    const slot = chosen(g)
    const enemy = slot.enemies[0]
    const dest = g.missionRow.find((m) => m.uid !== slot.uid && !m.faceDown)!
    const destBefore = dest.enemies.length

    g = apply(g, { type: 'UseAction', uid: 'adela' })
    g = resolve(g, [enemy.uid]) // which enemy
    g = resolve(g, [dest.uid]) // to which mission
    expect(chosen(g).enemies.map((e) => e.uid)).not.toContain(enemy.uid)
    const destNow = g.missionRow.find((m) => m.uid === dest.uid)!
    expect(destNow.enemies.map((e) => e.uid)).toContain(enemy.uid)
    expect(destNow.enemies.length).toBe(destBefore + 1)
  })
})

describe('Soledad revealed: discard all Counter-guerrillas', () => {
  it('removes every counter-guerrilla from the chosen mission', () => {
    const { s, mi } = findSeed('soledad', (slot) => slot.enemies.some((e) => e.typeId === CG))
    let g = playThenChoose(s, 'soledad', 'revealed', mi)
    const cgUids = chosen(g).enemies.filter((e) => e.typeId === CG).map((e) => e.uid)
    expect(cgUids.length).toBeGreaterThan(0)

    g = apply(g, { type: 'UseAction', uid: 'soledad' }) // no decision — sweeps immediately
    expect(g.pendingDecision).toBeNull()
    expect(chosen(g).enemies.some((e) => e.typeId === CG)).toBe(false)
    for (const uid of cgUids) expect(g.enemyDiscard.map((e) => e.uid)).toContain(uid)
  })
})

describe('ATTACK draw', () => {
  it('Nicolás hidden draws one card from the Hidden deck', () => {
    const { s, mi } = findSeed('nicolas', () => true)
    let g = playThenChoose(s, 'nicolas', 'hidden', mi)
    const handBefore = g.hand.length
    const deckBefore = g.hidden.deck.length
    g = apply(g, { type: 'UseAction', uid: 'nicolas' })
    expect(g.hand.length).toBe(handBefore + 1)
    expect(g.hidden.deck.length).toBe(deckBefore - 1)
  })
})

describe('precondition gating', () => {
  it('a discard-Enemy action is fireable only while the chosen mission has enemies', () => {
    // canFireEffect is a pure function of state; drive it directly (no mission has a garrison
    // of 1, so we can't empty one through a single in-game discard).
    const s = createGame({ seed: 1 })
    const slot = s.missionRow[0]
    s.chosenMissionUid = slot.uid
    const id = maquisEffectId('emilio', 'revealed')
    expect(canFireEffect(id, s)).toBe(true)

    s.enemyDiscard.push(...slot.enemies) // empty it (keep the tally balanced)
    slot.enemies = []
    expect(canFireEffect(id, s)).toBe(false)
  })
})
