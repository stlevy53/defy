// Enemy effect handlers (chunk 3a) + Guard/Grunt ordering constraints. Registers the real enemy
// effects; conservation after every action. Effects fire from the resolution framework: DEFEND at
// ChooseMission, DEFEAT on SpendAttackOn, SURVIVE on AdvancePhase.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createGame } from '../setup'
import { applyAction, legalActions, gatingStrikeUids } from '../actions'
import { assertConservation } from '../zones'
import { unregisterEffect } from './registry'
import { registerEnemyEffects, ENEMY_EFFECTS } from './enemies'
import { missions as missionsData } from '../../data'
import type { Action, EnemyInstance, GameState, MissionSlot } from '../types'

beforeAll(() => registerEnemyEffects())
afterAll(() => {
  for (const id of Object.keys(ENEMY_EFFECTS)) unregisterEffect(id)
})

const missionDefense = (dataId: string) => missionsData.find((m) => m.id === dataId)!.defense

function apply(state: GameState, action: Action): GameState {
  const next = applyAction(state, action)
  assertConservation(next)
  return next
}

const chosen = (s: GameState): MissionSlot => s.missionRow.find((x) => x.uid === s.chosenMissionUid)!
const spyCount = (arr: { dataId: string }[]) => arr.filter((c) => c.dataId === 'spy').length

/** Play every non-Spy hand card (hidden) then choose mission `mi` -> ATTACK, play-out complete. */
function playOutThenChoose(s0: GameState, mi: number): GameState {
  let s = s0
  for (const card of s.hand.filter((c) => c.dataId !== 'spy')) {
    s = apply(s, { type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
  }
  return apply(s, { type: 'ChooseMission', uid: s.missionRow[mi].uid })
}

/** First fresh game where some mission slot satisfies `pred`; returns the game and that index. */
function findSeedMission(pred: (slot: MissionSlot) => boolean): { s: GameState; mi: number } {
  for (let seed = 1; seed <= 1000; seed++) {
    const s = createGame({ seed })
    const mi = s.missionRow.findIndex(pred)
    if (mi !== -1) return { s, mi }
  }
  throw new Error('no seed/mission found')
}

const hasType = (t: string) => (slot: MissionSlot) => slot.enemies.some((e) => e.typeId === t)

describe('SURVIVE effects (fire at AdvancePhase on undefeated enemies)', () => {
  it('Counter-Guerrilla draws a Civilian into the Graveyard, one per survivor', () => {
    const { s, mi } = findSeedMission(hasType('counter_guerrilla'))
    let g = playOutThenChoose(s, mi)
    const cg = chosen(g).enemies.filter((e) => e.typeId === 'counter_guerrilla').length
    const gyBefore = g.graveyard.length
    const civBefore = g.civilianDeck.length
    g = apply(g, { type: 'AdvancePhase' })
    expect(g.graveyard.length).toBe(gyBefore + cg)
    expect(g.civilianDeck.length).toBe(civBefore - cg)
  })

  it('Military removes a hidden Maquis in play from the game', () => {
    const { s, mi } = findSeedMission(hasType('military'))
    let g = playOutThenChoose(s, mi)
    const mil = chosen(g).enemies.filter((e) => e.typeId === 'military').length
    const hiddenInPlay = g.inPlay.filter((m) => m.side === 'hidden').length
    g = apply(g, { type: 'AdvancePhase' })
    expect(g.removedFromGame.length).toBe(Math.min(mil, hiddenInPlay))
  })

  it('Spy Master adds a Spy to the Hidden discard pile (bounded by the supply)', () => {
    const { s, mi } = findSeedMission(hasType('spy_master'))
    let g = playOutThenChoose(s, mi)
    const sm = chosen(g).enemies.filter((e) => e.typeId === 'spy_master').length
    const availBefore = g.spiesAvailable
    const discSpyBefore = spyCount(g.hidden.discard)
    const added = Math.min(sm, availBefore)
    g = apply(g, { type: 'AdvancePhase' })
    expect(g.spiesAvailable).toBe(availBefore - added)
    expect(spyCount(g.hidden.discard)).toBe(discSpyBefore + added)
  })

  it('Radio Operator places face-down Enemies on the other Missions', () => {
    const { s, mi } = findSeedMission(hasType('radio_operator'))
    let g = playOutThenChoose(s, mi)
    const otherBefore = g.missionRow
      .filter((m) => m.uid !== g.chosenMissionUid)
      .reduce((n, m) => n + m.enemies.length, 0)
    const deckBefore = g.enemyDeck.length
    g = apply(g, { type: 'AdvancePhase' })
    const otherAfter = g.missionRow
      .filter((m) => m.uid !== g.chosenMissionUid)
      .reduce((n, m) => n + m.enemies.length, 0)
    const placed = deckBefore - g.enemyDeck.length
    expect(placed).toBeGreaterThan(0)
    expect(otherAfter - otherBefore).toBe(placed)
  })
})

describe('DEFEND effects (fire at ChooseMission)', () => {
  it('Engineer raises non-Engineer Enemy Defense by 1 (per Engineer)', () => {
    const { s, mi } = findSeedMission(
      (slot) => hasType('engineer')(slot) && slot.enemies.some((e) => e.typeId !== 'engineer'),
    )
    const engCount = s.missionRow[mi].enemies.filter((e) => e.typeId === 'engineer').length
    const before = s.missionRow[mi].enemies.map((e) => ({ uid: e.uid, typeId: e.typeId, def: e.defense }))

    const g = playOutThenChoose(s, mi) // ChooseMission fires Engineer DEFEND
    const slot = chosen(g)
    for (const b of before) {
      const now = slot.enemies.find((e) => e.uid === b.uid)!.defense
      expect(now).toBe(b.typeId === 'engineer' ? b.def : b.def + engCount)
    }
  })
})

describe('DEFEAT effects (fire on SpendAttackOn)', () => {
  it('Jailor draws a Recruit card into the Hidden discard pile when defeated', () => {
    // Mission with a jailor, no grunts (so the jailor is a legal target), affordable after play-out.
    let g: GameState | null = null
    let jailorUid = ''
    search: for (let seed = 1; seed <= 1000; seed++) {
      const s = createGame({ seed })
      for (let mi = 0; mi < s.missionRow.length; mi++) {
        const slot = s.missionRow[mi]
        if (slot.enemies.some((e) => e.typeId === 'grunt')) continue
        const jailor = slot.enemies.find((e) => e.typeId === 'jailor')
        if (!jailor) continue
        const cand = playOutThenChoose(s, mi)
        if (cand.attackStrength >= jailor.defense) {
          g = cand
          jailorUid = jailor.uid
          break search
        }
      }
    }
    if (!g) throw new Error('no jailor scenario found')

    const recruitBefore = g.recruit.deck.length
    const discBefore = g.hidden.discard.length
    g = apply(g, { type: 'SpendAttackOn', targetUid: jailorUid })
    expect(g.recruit.deck.length).toBe(recruitBefore - 1)
    expect(g.hidden.discard.length).toBe(discBefore + 1)
  })
})

describe('Guard/Grunt ordering constraints', () => {
  it('Grunts must be defeated before other Enemies', () => {
    const { s, mi } = findSeedMission(
      (slot) => hasType('grunt')(slot) && slot.enemies.some((e) => e.typeId !== 'grunt'),
    )
    const g = playOutThenChoose(s, mi)
    const slot = chosen(g)
    const nonGrunt = slot.enemies.find((e) => e.typeId !== 'grunt')!
    // No non-grunt enemy is offered as a target while grunts remain.
    expect(
      legalActions(g).some((a) => a.type === 'SpendAttackOn' && a.targetUid === nonGrunt.uid),
    ).toBe(false)
    expect(() => applyAction(g, { type: 'SpendAttackOn', targetUid: nonGrunt.uid })).toThrow(
      /blocked|not enough/,
    )
  })

  it('Guards must be defeated before the Mission', () => {
    // Mission with a guard, affordable after play-out (so the block — not affordability — is what stops it).
    let g: GameState | null = null
    search: for (let seed = 1; seed <= 1000; seed++) {
      const s = createGame({ seed })
      for (let mi = 0; mi < s.missionRow.length; mi++) {
        if (!s.missionRow[mi].enemies.some((e) => e.typeId === 'guard')) continue
        const cand = playOutThenChoose(s, mi)
        if (cand.attackStrength >= missionDefense(chosen(cand).dataId)) {
          g = cand
          break search
        }
      }
    }
    if (!g) throw new Error('no guarded-mission scenario found')
    const slot = chosen(g)
    expect(legalActions(g).some((a) => a.type === 'SpendAttackOn' && a.targetUid === slot.uid)).toBe(false)
    expect(() => applyAction(g, { type: 'SpendAttackOn', targetUid: slot.uid })).toThrow(/blocked/)
  })
})

describe('gatingStrikeUids (what the UI pulses on a blocked click)', () => {
  const enemy = (uid: string, typeId: string): EnemyInstance => ({
    uid,
    typeId,
    defense: 1,
    baseDefense: 1,
    faceUp: true,
  })
  const slot = (enemies: EnemyInstance[]): MissionSlot => ({
    uid: 'mission',
    dataId: 'valley',
    faceDown: false,
    defeated: false,
    enemies,
  })

  it('points at remaining Grunts when another Enemy is clicked', () => {
    const s = slot([enemy('grunt-1', 'grunt'), enemy('grunt-2', 'grunt'), enemy('guard-1', 'guard')])
    expect(gatingStrikeUids(s, 'guard-1')).toEqual(['grunt-1', 'grunt-2'])
  })

  it('points at remaining Guards when the Mission is clicked', () => {
    const s = slot([enemy('grunt-1', 'grunt'), enemy('guard-1', 'guard')])
    expect(gatingStrikeUids(s, 'mission')).toEqual(['guard-1'])
  })

  it('is empty for a Grunt, and for the Mission once Guards are gone', () => {
    const s = slot([enemy('grunt-1', 'grunt'), enemy('military-1', 'military')])
    expect(gatingStrikeUids(s, 'grunt-1')).toEqual([])
    expect(gatingStrikeUids(s, 'mission')).toEqual([])
    expect(gatingStrikeUids(s, 'military-1')).toEqual(['grunt-1'])
  })
})
