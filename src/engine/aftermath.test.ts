// AFTERMATH + RECOVER: civilian loss, mission success (+ refill + Era-2 reachability), mission
// failure and the 2nd-failure loss, EndResistance scoring tiers, the Continue → RECOVER round
// loop, and the all-Spy-hand loss. No effects are registered — these test the phase machinery,
// which runs regardless of the (stubbed) card effects. Conservation asserted where cards move.

import { describe, it, expect } from 'vitest'
import { createGame } from './setup'
import { applyAction, legalActions } from './actions'
import { assertConservation } from './zones'
import { missions as missionsData, civilians as civiliansData } from '../data'
import type { Action, GameState } from './types'

const isSpy = (c: { dataId: string }) => c.dataId === 'spy'
const vp = (dataId: string) => missionsData.find((m) => m.id === dataId)!.victoryPoints
const era = (dataId: string) => missionsData.find((m) => m.id === dataId)!.era
const civVal = (dataId: string) => civiliansData.find((c) => c.id === dataId)!.civilians

function apply(state: GameState, action: Action): GameState {
  const next = applyAction(state, action)
  assertConservation(next)
  return next
}

/** Play every non-Spy hand card (hidden) then choose the first available (non-failed) mission. */
function playoutAndChoose(s0: GameState): GameState {
  let s = s0
  for (const c of s.hand.filter((c) => c.dataId !== 'spy')) {
    s = apply(s, { type: 'PlayMaquis', uid: c.uid, side: 'hidden' })
  }
  const slot = s.missionRow.find((m) => !m.faceDown)!
  return apply(s, { type: 'ChooseMission', uid: slot.uid })
}

describe('mission failure and the round loop', () => {
  it('counts a failure, continues to a new round, and loses on the second failure', () => {
    let s = playoutAndChoose(createGame({ seed: 3 }))
    s = apply(s, { type: 'AdvancePhase' }) // never spent -> the mission fails
    expect(s.phase).toBe('AFTERMATH')
    expect(s.failedMissions).toBe(1)
    expect(s.result).toBeNull()

    s = apply(s, { type: 'Continue' })
    expect(s.phase).toBe('PLAN')
    expect(s.round).toBe(2)
    expect(s.attackStrength).toBe(0)
    expect(s.chosenMissionUid).toBeNull()
    expect(s.hand.length).toBeLessThanOrEqual(5)

    // Round 2: fail again.
    s = playoutAndChoose(s)
    s = apply(s, { type: 'AdvancePhase' })
    expect(s.result).toEqual({ outcome: 'loss', reason: 'missions' })
    expect(s.phase).toBe('GAME_OVER')
    expect(legalActions(s)).toHaveLength(0)
  })
})

describe('mission success', () => {
  it('banks the mission, refills the row from the Mission deck, and makes an Era-2 mission reachable', () => {
    // Border (Defense 3) is reachable. Play the hand revealed to bank attack, then defeat it.
    let g: GameState | null = null
    let borderUid = ''
    search: for (let seed = 1; seed <= 2000; seed++) {
      const g0 = createGame({ seed })
      const border = g0.missionRow.find((m) => m.dataId === 'border')
      if (!border || border.enemies.some((e) => e.typeId === 'guard')) continue
      let s = g0
      for (const c of s.hand.filter((c) => c.dataId !== 'spy')) {
        s = applyAction(s, { type: 'PlayMaquis', uid: c.uid, side: 'revealed' })
      }
      s = applyAction(s, { type: 'ChooseMission', uid: border.uid })
      if (s.attackStrength >= 3 && s.pendingDecision === null) {
        g = s
        borderUid = border.uid
        break search
      }
    }
    if (!g) throw new Error('no border scenario found')

    let s = apply(g, { type: 'SpendAttackOn', targetUid: borderUid })
    const deckBefore = s.missionDeck.length
    s = apply(s, { type: 'AdvancePhase' })

    expect(s.defeatedMissions.map((m) => m.dataId)).toContain('border')
    expect(s.missionRow.some((m) => m.dataId === 'border')).toBe(false)
    expect(s.missionDeck.length).toBe(deckBefore - 1)
    // The refilled slot is the Era-2 mission that was on top of the deck.
    const refilled = s.missionRow.find((m) => era(m.dataId) === 2)
    expect(refilled).toBeDefined()
    expect(s.phase).toBe('AFTERMATH')

    // Continue -> next round; the new Era-2 mission is now choosable.
    s = apply(s, { type: 'Continue' })
    expect(s.phase).toBe('PLAN')
    expect(legalActions(s).some((a) => a.type === 'ChooseMission' && a.uid === refilled!.uid)).toBe(true)
  })
})

describe('EndResistance scoring', () => {
  const scoredWith = (defeated: string[]): GameState => {
    const g = createGame({ seed: 1 })
    g.phase = 'AFTERMATH'
    g.defeatedMissions = defeated.map((id) => ({ uid: id, dataId: id }))
    return applyAction(g, { type: 'EndResistance' })
  }

  it('sums Victory Points and maps to the right tier', () => {
    const draw = scoredWith(['valley']) // 2 VP
    expect(draw.result).toEqual({ outcome: 'win', tier: 'Draw', points: vp('valley') })

    const major = scoredWith(['police_station', 'franco_hq', 'cg_headquarters', 'caves', 'prison', 'farmhouse_e3'])
    const majorPts = ['police_station', 'franco_hq', 'cg_headquarters', 'caves', 'prison', 'farmhouse_e3'].reduce((n, id) => n + vp(id), 0)
    expect(majorPts).toBeGreaterThanOrEqual(22)
    expect(major.result).toEqual({ outcome: 'win', tier: 'Major Victory', points: majorPts })
  })

  it('all 10 missions defeated is an Epic Victory regardless of points', () => {
    const ten = missionsData.slice(0, 10).map((m) => m.id)
    const s = scoredWith(ten)
    expect(s.result?.tier).toBe('Epic Victory')
  })
})

describe('civilian loss', () => {
  it('loses when the Graveyard reaches 5 civilians at AFTERMATH', () => {
    const g = createGame({ seed: 4 })
    // Play out the hand into play so the play-out is complete, then set up ATTACK.
    for (const c of [...g.hand]) {
      if (c.dataId === 'spy') continue
      g.inPlay.push({ uid: c.uid, dataId: c.dataId, side: 'hidden', actionUsed: false })
    }
    g.hand = g.hand.filter(isSpy)
    g.phase = 'ATTACK'
    g.chosenMissionUid = g.missionRow[0].uid
    // Fill the Graveyard to >= 5 civilians.
    let sum = 0
    while (sum < 5 && g.civilianDeck.length > 0) {
      const c = g.civilianDeck.shift()!
      g.graveyard.push(c)
      sum += civVal(c.dataId)
    }
    const s = apply(g, { type: 'AdvancePhase' })
    expect(s.result).toEqual({ outcome: 'loss', reason: 'civilians' })
    expect(s.phase).toBe('GAME_OVER')
  })
})

describe('enemy Defense reset on reshuffle', () => {
  it('restores the printed Defense when a modified enemy is reshuffled back into the Enemy deck', () => {
    const g = createGame({ seed: 7 })

    // Funnel every enemy into the discard and empty the deck, so the next refill must reshuffle.
    const pooled = [...g.enemyDeck]
    g.enemyDeck = []
    for (const slot of g.missionRow) {
      pooled.push(...slot.enemies)
      slot.enemies = []
    }
    g.enemyDiscard = pooled

    // Simulate an in-round Defense modifier (Engineer/Mayor's House +1) that survived into discard.
    const modified = g.enemyDiscard[0]
    modified.defense = modified.baseDefense + 5
    const modifiedUid = modified.uid
    const printed = modified.baseDefense

    // A completed play-out with a defeated chosen mission (a success): AFTERMATH refills the row
    // from the Mission deck, dealing enemies from the freshly reshuffled Enemy deck.
    for (const c of g.hand.filter((c) => c.dataId !== 'spy')) {
      g.inPlay.push({ uid: c.uid, dataId: c.dataId, side: 'hidden', actionUsed: false })
    }
    g.hand = g.hand.filter(isSpy)
    g.phase = 'ATTACK'
    const chosen = g.missionRow[0]
    g.chosenMissionUid = chosen.uid
    chosen.defeated = true // success -> no enemies remain in the slot
    expect(g.missionDeck.length).toBeGreaterThan(0) // a mission exists to refill into

    const s = apply(g, { type: 'AdvancePhase' })

    // The enemy is back in circulation (a new garrison or the deck) at its printed Defense — not
    // the mutated value it carried into the discard.
    const found =
      s.enemyDeck.find((e) => e.uid === modifiedUid) ??
      s.enemyDiscard.find((e) => e.uid === modifiedUid) ??
      s.missionRow.flatMap((m) => m.enemies).find((e) => e.uid === modifiedUid)
    expect(found).toBeDefined()
    expect(found!.defense).toBe(printed)
  })
})

describe('all-Spy hand loss (RECOVER)', () => {
  it('loses when the new hand is all Spies', () => {
    const g = createGame({ seed: 1 })
    g.phase = 'AFTERMATH'
    g.chosenMissionUid = null
    g.inPlay = []
    // Put every Spy on top of the Hidden deck and everything else out of the draw path.
    const pool = [...g.hand, ...g.hidden.deck, ...g.hidden.discard]
    g.hand = []
    g.hidden.deck = pool.filter(isSpy)
    g.hidden.discard = []
    for (const c of pool.filter((c) => !isSpy(c))) g.recruit.deck.push(c)
    expect(g.hidden.deck.length).toBeGreaterThan(0)

    const s = apply(g, { type: 'Continue' })
    expect(s.result).toEqual({ outcome: 'loss', reason: 'spies' })
    expect(s.hand.every(isSpy)).toBe(true)
  })
})
