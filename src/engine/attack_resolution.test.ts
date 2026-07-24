// ATTACK sub-slice 2: attack resolution. Base-attack accrual, DEFEND queued at ChooseMission,
// SpendAttackOn (enemy + mission), insufficient-strength rejection, mandatory-play-out gating,
// and AdvancePhase (undefeated enemies -> discard, -> AFTERMATH). Mission/enemy effects are
// still `[stub]`; these tests exercise the resolution framework. Conservation after every action.

import { describe, it, expect } from 'vitest'
import { createGame } from './setup'
import { applyAction, legalActions } from './actions'
import { assertConservation } from './zones'
import { maquis as maquisData, missions as missionsData } from '../data'
import type { Action, GameState, MissionSlot } from './types'

function apply(state: GameState, action: Action): GameState {
  const next = applyAction(state, action)
  assertConservation(next)
  return next
}

const missionDefense = (dataId: string) => missionsData.find((m) => m.id === dataId)!.defense

/** Play every non-Spy hand card (hidden) during PLAN, then choose a mission -> enter ATTACK with
 *  the play-out already complete. Uses raw applyAction (no per-step assert) for speed in search. */
function playOutThenChoose(seed: number, missionIndex: number): GameState {
  let s = createGame({ seed })
  for (const card of s.hand.filter((c) => c.dataId !== 'spy')) {
    s = applyAction(s, { type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
  }
  return applyAction(s, { type: 'ChooseMission', uid: s.missionRow[missionIndex].uid })
}

const chosen = (s: GameState): MissionSlot => s.missionRow.find((x) => x.uid === s.chosenMissionUid)!

describe('base Attack Strength accrual', () => {
  it('banks each played Maquis base attack (hidden/revealed) as it is played', () => {
    const s0 = createGame({ seed: 7 })
    const a = s0.hand.find((c) => c.dataId !== 'spy')!
    const aAttack = maquisData.find((m) => m.id === a.dataId)!.hidden.attack
    const s1 = apply(s0, { type: 'PlayMaquis', uid: a.uid, side: 'hidden' })
    expect(s1.attackStrength).toBe(aAttack)

    const b = s1.hand.find((c) => c.dataId !== 'spy')!
    const bAttack = maquisData.find((m) => m.id === b.dataId)!.revealed.attack
    const s2 = apply(s1, { type: 'PlayMaquis', uid: b.uid, side: 'revealed' })
    expect(s2.attackStrength).toBe(aAttack + bAttack)
  })
})

describe('DEFEND queued at ChooseMission', () => {
  it('queues (and stubs) one DEFEND per mission + per garrison enemy', () => {
    const s0 = createGame({ seed: 7 })
    const slot = s0.missionRow[0]
    const s1 = apply(s0, { type: 'ChooseMission', uid: slot.uid })
    expect(s1.phase).toBe('ATTACK')
    expect(s1.effectQueue).toHaveLength(0)
    expect(s1.pendingDecision).toBeNull()
    const stubs = s1.log.filter((l) => l.includes('[stub]'))
    expect(stubs).toHaveLength(1 + slot.enemies.length)
  })
})

describe('mandatory play-out gating', () => {
  it('offers no attack/advance and rejects them while a Maquis remains unplayed', () => {
    const s0 = createGame({ seed: 7 })
    const s1 = apply(s0, { type: 'ChooseMission', uid: s0.missionRow[0].uid }) // hand still full
    expect(s1.hand.some((c) => c.dataId !== 'spy')).toBe(true)

    const acts = legalActions(s1)
    expect(acts.some((a) => a.type === 'SpendAttackOn')).toBe(false)
    expect(acts.some((a) => a.type === 'AdvancePhase')).toBe(false)

    const enemy = chosen(s1).enemies[0]
    expect(() => applyAction(s1, { type: 'SpendAttackOn', targetUid: enemy.uid })).toThrow(/play out/)
    expect(() => applyAction(s1, { type: 'AdvancePhase' })).toThrow(/play out/)
  })
})

describe('SpendAttackOn', () => {
  /** A legal, affordable enemy target given the Grunt ordering constraint. */
  function legalAffordableEnemy(s: GameState) {
    const slot = chosen(s)
    const gruntsRemain = slot.enemies.some((e) => e.typeId === 'grunt')
    return slot.enemies.find(
      (e) => e.defense <= s.attackStrength && (e.typeId === 'grunt' || !gruntsRemain),
    )
  }

  /** A play-out-complete ATTACK state whose chosen mission has a legal, affordable enemy but whose
   *  mission Defense exceeds the current Attack Strength. */
  function enemyScenario(): GameState {
    for (let seed = 1; seed <= 800; seed++) {
      for (let mi = 0; mi < 4; mi++) {
        const s = playOutThenChoose(seed, mi)
        if (s.attackStrength > 0 && legalAffordableEnemy(s) && missionDefense(chosen(s).dataId) > s.attackStrength) {
          return s
        }
      }
    }
    throw new Error('no enemy scenario found')
  }

  it('defeats an affordable enemy: spends its Defense, discards it, queues DEFEAT', () => {
    let s = enemyScenario()
    assertConservation(s)
    const enemy = legalAffordableEnemy(s)!
    const strengthBefore = s.attackStrength
    const discardBefore = s.enemyDiscard.length

    s = apply(s, { type: 'SpendAttackOn', targetUid: enemy.uid })
    expect(s.attackStrength).toBe(strengthBefore - enemy.defense)
    expect(chosen(s).enemies.map((e) => e.uid)).not.toContain(enemy.uid)
    expect(s.enemyDiscard.map((e) => e.uid)).toContain(enemy.uid)
    expect(s.enemyDiscard.length).toBe(discardBefore + 1)
    expect(s.log.some((l) => l.includes('DEFEAT') || l.includes('[stub]'))).toBe(true)
  })

  it('rejects a target that costs more than the remaining Attack Strength', () => {
    const s = enemyScenario()
    // The mission Defense exceeds strength in this scenario.
    expect(() => applyAction(s, { type: 'SpendAttackOn', targetUid: s.chosenMissionUid! })).toThrow(
      /not enough Attack Strength/,
    )
  })

  it('defeats the mission when affordable: flags it, keeps it in the row, queues DEFEAT', () => {
    // Find a scenario where the mission itself is affordable.
    let s: GameState | null = null
    outer: for (let seed = 1; seed <= 800; seed++) {
      for (let mi = 0; mi < 4; mi++) {
        const cand = playOutThenChoose(seed, mi)
        // Mission must be affordable AND unguarded (Guards gate the Mission).
        if (
          cand.attackStrength >= missionDefense(chosen(cand).dataId) &&
          !chosen(cand).enemies.some((e) => e.typeId === 'guard')
        ) {
          s = cand
          break outer
        }
      }
    }
    if (!s) throw new Error('no mission-defeat scenario found')
    assertConservation(s)
    const slot = chosen(s)
    const cost = missionDefense(slot.dataId)
    const strengthBefore = s.attackStrength

    const next = apply(s, { type: 'SpendAttackOn', targetUid: slot.uid })
    const slotNow = next.missionRow.find((x) => x.uid === slot.uid)!
    expect(slotNow.defeated).toBe(true)
    expect(next.attackStrength).toBe(strengthBefore - cost)
    // still in the row (moves to Defeated Missions in AFTERMATH)
    expect(next.missionRow.some((x) => x.uid === slot.uid)).toBe(true)
    // cannot defeat it twice
    expect(() => applyAction(next, { type: 'SpendAttackOn', targetUid: slot.uid })).toThrow(
      /already defeated/,
    )
  })
})

describe('AdvancePhase (ATTACK -> AFTERMATH)', () => {
  it('discards undefeated enemies (SURVIVE queued) and moves to AFTERMATH', () => {
    let s = playOutThenChoose(7, 0)
    assertConservation(s)
    const slot = chosen(s)
    const undefeated = slot.enemies.map((e) => e.uid)
    const discardBefore = s.enemyDiscard.length

    s = apply(s, { type: 'AdvancePhase' })
    expect(s.phase).toBe('AFTERMATH')
    expect(chosen(s).enemies).toHaveLength(0)
    for (const uid of undefeated) expect(s.enemyDiscard.map((e) => e.uid)).toContain(uid)
    expect(s.enemyDiscard.length).toBe(discardBefore + undefeated.length)
    // AFTERMATH offers the End-vs-Continue choice (its automatic steps have already resolved).
    expect(legalActions(s).some((a) => a.type === 'EndResistance')).toBe(true)
  })
})
