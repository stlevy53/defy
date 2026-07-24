// ATTACK modifier effects (chunk 1): attack-value bonuses, Benigno's defense reduction, and
// Ricardo's mission-Defense halving. Registers the real ATTACK effects; conservation checked
// after every action.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createGame } from '../setup'
import { applyAction } from '../actions'
import { assertConservation } from '../zones'
import { unregisterEffect } from './registry'
import { registerAttackEffects, ATTACK_EFFECTS } from './attack'
import { civilians as civilianData, missions as missionsData } from '../../data'
import type { Action, GameState, Side } from '../types'

beforeAll(() => registerAttackEffects())
afterAll(() => {
  for (const id of Object.keys(ATTACK_EFFECTS)) unregisterEffect(id)
})

const civVal = (dataId: string) => civilianData.find((c) => c.id === dataId)!.civilians
const missionDefense = (dataId: string) => missionsData.find((m) => m.id === dataId)!.defense

function apply(state: GameState, action: Action): GameState {
  const next = applyAction(state, action)
  assertConservation(next)
  return next
}

function findSeed(pred: (s: GameState) => boolean): GameState {
  for (let seed = 1; seed <= 1000; seed++) {
    const s = createGame({ seed })
    if (pred(s)) return s
  }
  throw new Error('no seed found in 1..1000')
}

const play = (s: GameState, dataId: string, side: Side): GameState => {
  const card = s.hand.find((c) => c.dataId === dataId)!
  return apply(s, { type: 'PlayMaquis', uid: card.uid, side })
}

/** UseAction on a card whose maquis uid === dataId (true at setup). */
const use = (s: GameState, dataId: string): GameState => apply(s, { type: 'UseAction', uid: dataId })

const others = (s: GameState, exclude: string) =>
  s.hand.filter((c) => c.dataId !== 'spy' && c.dataId !== exclude)

describe('attack-value modifiers', () => {
  it('Soledad hidden: +1 Attack per revealed Maquis in play', () => {
    let s = findSeed((st) => st.hand.some((c) => c.dataId === 'soledad') && others(st, 'soledad').length >= 2)
    const [x, y] = others(s, 'soledad')
    s = play(s, x.dataId, 'revealed')
    s = play(s, y.dataId, 'revealed')
    s = play(s, 'soledad', 'hidden')
    s = apply(s, { type: 'ChooseMission', uid: s.missionRow[0].uid }) // -> ATTACK

    const revealedCount = s.inPlay.filter((m) => m.side === 'revealed').length
    expect(revealedCount).toBe(2)
    const before = s.attackStrength
    s = use(s, 'soledad')
    expect(s.attackStrength).toBe(before + revealedCount)
  })

  it('Marcelino revealed: +1 Attack per other Maquis in play', () => {
    let s = findSeed((st) => st.hand.some((c) => c.dataId === 'marcelino') && others(st, 'marcelino').length >= 2)
    const [x, y] = others(s, 'marcelino')
    s = play(s, x.dataId, 'hidden')
    s = play(s, y.dataId, 'hidden')
    s = play(s, 'marcelino', 'revealed')
    s = apply(s, { type: 'ChooseMission', uid: s.missionRow[0].uid })

    const otherCount = s.inPlay.filter((m) => m.uid !== 'marcelino').length
    expect(otherCount).toBe(2)
    const before = s.attackStrength
    s = use(s, 'marcelino')
    expect(s.attackStrength).toBe(before + otherCount)
  })

  it('Abel revealed: +1 Attack per civilian in the Graveyard', () => {
    const s0 = findSeed((st) => st.hand.some((c) => c.dataId === 'abel'))
    // Seed the Graveyard with two civilian cards (mutate the unfrozen createGame result).
    const c1 = s0.civilianDeck.shift()!
    const c2 = s0.civilianDeck.shift()!
    s0.graveyard.push(c1, c2)
    const expectedBonus = civVal(c1.dataId) + civVal(c2.dataId)

    let s = play(s0, 'abel', 'revealed')
    s = apply(s, { type: 'ChooseMission', uid: s.missionRow[0].uid })
    const before = s.attackStrength
    s = use(s, 'abel')
    expect(s.attackStrength).toBe(before + expectedBonus)
  })
})

describe('defense modifiers', () => {
  it('Benigno revealed: −1 Defense to each Enemy with Defense ≥ 2 at the chosen mission', () => {
    // Choose a mission that has at least one Enemy with Defense ≥ 2.
    let s = findSeed(
      (st) =>
        st.hand.some((c) => c.dataId === 'benigno') &&
        st.missionRow.some((slot) => slot.enemies.some((e) => e.defense >= 2)),
    )
    const mi = s.missionRow.findIndex((slot) => slot.enemies.some((e) => e.defense >= 2))
    s = play(s, 'benigno', 'revealed')
    s = apply(s, { type: 'ChooseMission', uid: s.missionRow[mi].uid })

    const slot = s.missionRow.find((x) => x.uid === s.chosenMissionUid)!
    const before = slot.enemies.map((e) => ({ uid: e.uid, def: e.defense }))
    s = use(s, 'benigno')

    const after = s.missionRow.find((x) => x.uid === s.chosenMissionUid)!
    for (const b of before) {
      const now = after.enemies.find((e) => e.uid === b.uid)!.defense
      expect(now).toBe(b.def >= 2 ? b.def - 1 : b.def)
    }
  })

  it('Ricardo revealed: halves the chosen mission Defense (rounded up)', () => {
    let s = findSeed((st) => st.hand.some((c) => c.dataId === 'ricardo'))
    s = play(s, 'ricardo', 'revealed')
    const missionDataId = s.missionRow[0].dataId
    s = apply(s, { type: 'ChooseMission', uid: s.missionRow[0].uid })
    const original = missionDefense(missionDataId)
    expect(s.missionDefenseOverride).toBeNull()

    s = use(s, 'ricardo')
    expect(s.missionDefenseOverride).toBe(Math.ceil(original / 2))
  })
})
