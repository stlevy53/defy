// M2 ACCEPTANCE GATE — the rulebook's worked first turn (Resist! rulebook pp. 11–13).
// The engine is "correct" when it reproduces this turn. Because our state is seed-based and the
// example uses a specific hand + garrison, we build a conservation-valid fixture that matches the
// illustrated setup, then script the exact Action/Decision sequence and assert intermediate state.
//
// Scenario: hand = Paquita, Consuelo, Abel, Roberto, + a Spy. Chosen mission = Destroy the Railroad
// Bridge (Defense 8), garrison = a Grunt (Def 1), a Guard (Def 1), a Military.
//   PLAN:   play Paquita hidden, use her scout to flip the Railroad Bridge enemies, choose it.
//   ATTACK: Consuelo (revealed) discards the Grunt (+1 Attack); play Abel (hidden) and Roberto
//           (revealed); fire Abel's "+1 per revealed" last → Attack Strength 9. Defeat the Guard
//           (its DEFEND gates the Mission), then the Mission (its DEFEAT discards an enemy
//           elsewhere). The undefeated Military's SURVIVE removes a hidden Maquis from the game.
//   AFTERMATH: no civilian loss; mission succeeded (score 2); refill. Continue.
//   RECOVER: cleanup + draw a fresh 5; not all Spies → next round.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { applyAction, resolveDecision, legalActions } from './actions'
import { assertConservation } from './zones'
import { registerPlanEffects, PLAN_EFFECTS } from './effects/plan'
import { registerAttackEffects, ATTACK_EFFECTS } from './effects/attack'
import { registerEnemyEffects, ENEMY_EFFECTS } from './effects/enemies'
import { registerMissionEffects, MISSION_EFFECTS } from './effects/missions'
import { unregisterEffect } from './effects/registry'
import { maquis as maquisData, missions as missionsData, enemyTypes, civilians as civiliansData } from '../data'
import type { Action, EnemyInstance, GameState, MissionSlot } from './types'

beforeAll(() => {
  registerPlanEffects()
  registerAttackEffects()
  registerEnemyEffects()
  registerMissionEffects()
})
afterAll(() => {
  for (const id of [
    ...Object.keys(PLAN_EFFECTS),
    ...Object.keys(ATTACK_EFFECTS),
    ...Object.keys(ENEMY_EFFECTS),
    ...Object.keys(MISSION_EFFECTS),
  ]) {
    unregisterEffect(id)
  }
})

function apply(s: GameState, a: Action): GameState {
  const next = applyAction(s, a)
  assertConservation(next)
  return next
}
function resolve(s: GameState, selection: string[]): GameState {
  const next = resolveDecision(s, { selection })
  assertConservation(next)
  return next
}

/** Build a conservation-valid GameState matching the rulebook's worked-example setup. */
function buildWorkedExample(): GameState {
  // --- Maquis (24) + Spies (6: 3 instances + 3 in the aside supply) ---
  const handMaquisIds = ['paquita', 'consuelo', 'abel', 'roberto']
  const allMaquis = maquisData.map((m) => ({ uid: m.id, dataId: m.id }))
  const others = allMaquis.filter((m) => !handMaquisIds.includes(m.dataId))
  const hand = [
    ...handMaquisIds.map((id) => ({ uid: id, dataId: id })),
    { uid: 'spy-0', dataId: 'spy' },
  ]
  const hidden = {
    deck: [...others.slice(0, 10), { uid: 'spy-1', dataId: 'spy' }, { uid: 'spy-2', dataId: 'spy' }],
    discard: [] as { uid: string; dataId: string }[],
  }
  const recruit = { deck: others.slice(10), revealed: [] as { uid: string; dataId: string }[] }

  // --- Enemies (32) ---
  const allEnemies: EnemyInstance[] = []
  for (const t of enemyTypes) {
    t.defenseValues.forEach((d, i) =>
      allEnemies.push({ uid: `enemy-${t.id}-${i}`, typeId: t.id, defense: d, baseDefense: d, faceUp: false }),
    )
  }
  const take = (pred: (e: EnemyInstance) => boolean): EnemyInstance => {
    const idx = allEnemies.findIndex(pred)
    return allEnemies.splice(idx, 1)[0]
  }
  const grunt = take((e) => e.typeId === 'grunt' && e.defense === 1)
  const guard = take((e) => e.typeId === 'guard' && e.defense === 1)
  const military = take((e) => e.typeId === 'military')
  const railroadEnemies = [grunt, guard, military]

  // --- Missions (10 in play: 4 available Era-1 + 6 in the deck) ---
  const era1 = missionsData.filter((m) => m.era === 1).map((m) => m.id)
  const otherEra1 = era1.filter((id) => id !== 'railroad_bridge').slice(0, 3)
  const missionRow: MissionSlot[] = [
    { uid: 'railroad_bridge', dataId: 'railroad_bridge', faceDown: false, defeated: false, enemies: railroadEnemies },
  ]
  for (const id of otherEra1) {
    const g = missionsData.find((m) => m.id === id)!.garrison
    missionRow.push({ uid: id, dataId: id, faceDown: false, defeated: false, enemies: allEnemies.splice(0, g) })
  }
  const era2 = missionsData.filter((m) => m.era === 2).map((m) => m.id).slice(0, 3)
  const era3 = missionsData.filter((m) => m.era === 3).map((m) => m.id).slice(0, 3)
  const missionDeck = [...era2, ...era3].map((id) => ({ uid: id, dataId: id }))

  const state: GameState = {
    rng: 777,
    phase: 'PLAN',
    round: 1,
    hidden,
    recruit,
    hand,
    inPlay: [],
    missionRow,
    missionDeck,
    defeatedMissions: [],
    enemyDeck: allEnemies, // whatever's left after dealing the garrisons
    enemyDiscard: [],
    civilianDeck: civiliansData.map((c) => ({ uid: c.id, dataId: c.id })),
    graveyard: [],
    spiesAvailable: 3,
    removedFromGame: [],
    chosenMissionUid: null,
    attackStrength: 0,
    missionDefenseOverride: null,
    attackRevealLimit: null,
    revealedInAttack: 0,
    ignoreMissionEffect: false,
    recoverDrawModifier: 0,
    failedMissions: 0,
    pendingDecision: null,
    effectQueue: [],
    result: null,
    log: [],
  }
  return state
}

describe('M2 acceptance gate — rulebook worked first turn', () => {
  it('reproduces PLAN → ATTACK → AFTERMATH → RECOVER exactly', () => {
    let s = buildWorkedExample()
    assertConservation(s)
    const railroad = s.missionRow.find((m) => m.dataId === 'railroad_bridge')!
    const gruntUid = railroad.enemies.find((e) => e.typeId === 'grunt')!.uid
    const guardUid = railroad.enemies.find((e) => e.typeId === 'guard')!.uid

    // --- PLAN ---
    s = apply(s, { type: 'PlayMaquis', uid: 'paquita', side: 'hidden' })
    s = apply(s, { type: 'UseAction', uid: 'paquita' }) // scout: flip all enemies at one mission
    expect(s.pendingDecision?.kind).toBe('selectTarget')
    s = resolve(s, [railroad.uid])
    expect(s.missionRow.find((m) => m.uid === railroad.uid)!.enemies.every((e) => e.faceUp)).toBe(true)

    s = apply(s, { type: 'ChooseMission', uid: railroad.uid })
    expect(s.phase).toBe('ATTACK')

    // --- ATTACK ---
    s = apply(s, { type: 'PlayMaquis', uid: 'consuelo', side: 'revealed' })
    s = apply(s, { type: 'UseAction', uid: 'consuelo' }) // discard an enemy, gain its Defense
    s = resolve(s, [gruntUid]) // discard the Grunt (+1 Attack from its Defense of 1)
    expect(s.enemyDiscard.map((e) => e.uid)).toContain(gruntUid)

    s = apply(s, { type: 'PlayMaquis', uid: 'abel', side: 'hidden' })
    s = apply(s, { type: 'PlayMaquis', uid: 'roberto', side: 'revealed' })
    // Fire Abel's "+1 per revealed Maquis" now that both Consuelo and Roberto are revealed.
    s = apply(s, { type: 'UseAction', uid: 'abel' })

    // Attack Strength = Paquita 1 + Consuelo 0 (+1 grunt) + Abel 1 + Roberto 4 + Abel-action 2 = 9.
    expect(s.attackStrength).toBe(9)

    // The Guard's DEFEND gates the Mission — it can't be attacked while the Guard stands.
    expect(legalActions(s).some((a) => a.type === 'SpendAttackOn' && a.targetUid === railroad.uid)).toBe(false)

    s = apply(s, { type: 'SpendAttackOn', targetUid: guardUid }) // Guard (Def 1)
    expect(s.attackStrength).toBe(8)

    s = apply(s, { type: 'SpendAttackOn', targetUid: railroad.uid }) // Mission (Def 8)
    expect(s.attackStrength).toBe(0)
    // Railroad Bridge's DEFEAT: discard an enemy from another mission.
    expect(s.pendingDecision?.kind).toBe('selectTarget')
    const elsewhere = (s.pendingDecision as { candidates: string[] }).candidates[0]
    s = resolve(s, [elsewhere])
    expect(s.enemyDiscard.map((e) => e.uid)).toContain(elsewhere)

    // --- ADVANCE → AFTERMATH ---
    s = apply(s, { type: 'AdvancePhase' })
    expect(s.phase).toBe('AFTERMATH')
    // The undefeated Military's SURVIVE removed one of the two hidden Maquis (Paquita/Abel).
    expect(s.removedFromGame).toHaveLength(1)
    expect(['paquita', 'abel']).toContain(s.removedFromGame[0].dataId)
    // Mission succeeded → banked with 2 VP, and the row refilled from the Mission deck.
    expect(s.defeatedMissions.map((m) => m.dataId)).toContain('railroad_bridge')
    expect(s.missionRow.some((m) => m.dataId === 'railroad_bridge')).toBe(false)
    expect(s.result).toBeNull()

    // --- CONTINUE → RECOVER → next round ---
    s = apply(s, { type: 'Continue' })
    expect(s.phase).toBe('PLAN')
    expect(s.round).toBe(2)
    expect(s.hand).toHaveLength(5)
    expect(s.hand.every((c) => c.dataId === 'spy')).toBe(false)
    // Per-round scratch was reset.
    expect(s.attackStrength).toBe(0)
    expect(s.chosenMissionUid).toBeNull()
  })
})
