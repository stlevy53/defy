// Mission effect handlers (chunk 3b). The available row is Era-1 only (Era-2/3 missions arrive via
// AFTERMATH refill, not built yet), and several Era-1 missions have Defense too high to defeat
// reliably from a random hand — so most handlers are exercised directly (they're plain mutations),
// with a couple of end-to-end tests proving the DEFEND/DEFEAT wiring, plus the reveal-limit
// enforcement. Conservation is asserted wherever cards move.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createGame } from '../setup'
import { applyAction, legalActions, resolveDecision } from '../actions'
import { assertConservation } from '../zones'
import { unregisterEffect, missionEffectId } from './registry'
import { registerMissionEffects, MISSION_EFFECTS } from './missions'
import { registerPlanEffects, PLAN_EFFECTS } from './plan'
import type { EffectContext } from './registry'
import type { GameState, MissionSlot, Decision } from '../types'

beforeAll(() => {
  registerMissionEffects()
  registerPlanEffects()
})
afterAll(() => {
  for (const id of [...Object.keys(MISSION_EFFECTS), ...Object.keys(PLAN_EFFECTS)]) unregisterEffect(id)
})

const isSpy = (c: { dataId: string }) => c.dataId === 'spy'
const spyCount = (arr: { dataId: string }[]) => arr.filter(isSpy).length

/** Fresh (unfrozen) game with a chosen mission slot that has enemies. */
function chosenGame(seed = 1): { g: GameState; slot: MissionSlot } {
  const g = createGame({ seed })
  const slot = g.missionRow.find((m) => m.enemies.length > 0)!
  g.chosenMissionUid = slot.uid
  return { g, slot }
}

/** Call a wrapped mission handler directly (the map is a plain object; handlers do plain mutations). */
function fire(missionId: string, g: GameState, trigger: string, responses: string[][] = []): Decision | void {
  const ctx: EffectContext = { state: g, sourceUid: g.chosenMissionUid ?? '', args: { trigger }, responses }
  return MISSION_EFFECTS[missionEffectId(missionId)](ctx) as Decision | void
}

// --- DEFEAT handlers --------------------------------------------------------

describe('mission DEFEAT effect logic', () => {
  it('Barracks adds a face-down Enemy to every other Mission', () => {
    const { g } = chosenGame(3)
    const otherBefore = g.missionRow
      .filter((m) => m.uid !== g.chosenMissionUid)
      .reduce((n, m) => n + m.enemies.length, 0)
    const deckBefore = g.enemyDeck.length
    fire('barracks', g, 'DEFEAT')
    const placed = deckBefore - g.enemyDeck.length
    const otherAfter = g.missionRow
      .filter((m) => m.uid !== g.chosenMissionUid)
      .reduce((n, m) => n + m.enemies.length, 0)
    expect(placed).toBeGreaterThan(0)
    expect(otherAfter - otherBefore).toBe(placed)
    assertConservation(g)
  })

  it('Border / Valley adjust the Recover draw modifier', () => {
    const { g } = chosenGame()
    fire('border', g, 'DEFEAT')
    expect(g.recoverDrawModifier).toBe(-1)
    fire('valley', g, 'DEFEAT')
    expect(g.recoverDrawModifier).toBe(0)
  })

  it('Officer removes a Spy in hand from the game', () => {
    const { g } = chosenGame()
    if (!g.hand.some(isSpy)) {
      const i = g.hidden.deck.findIndex(isSpy)
      g.hand.push(g.hidden.deck.splice(i, 1)[0])
    }
    fire('officer', g, 'DEFEAT')
    expect(g.removedFromGame.filter(isSpy).length).toBe(1)
    assertConservation(g)
  })

  it('Villa draws a Civilian per undefeated Enemy at the mission', () => {
    const { g, slot } = chosenGame()
    const n = slot.enemies.length
    const gyBefore = g.graveyard.length
    fire('villa', g, 'DEFEAT')
    expect(g.graveyard.length).toBe(gyBefore + Math.min(n, 8))
    assertConservation(g)
  })

  it('Prison moves a Recruit card to the Hidden discard pile', () => {
    const { g } = chosenGame()
    const recruitBefore = g.recruit.deck.length
    const discBefore = g.hidden.discard.length
    fire('prison', g, 'DEFEAT')
    expect(g.recruit.deck.length).toBe(recruitBefore - 1)
    expect(g.hidden.discard.length).toBe(discBefore + 1)
    assertConservation(g)
  })

  it('Caves adds a Spy to the Hidden discard pile', () => {
    const { g } = chosenGame()
    const availBefore = g.spiesAvailable
    const discSpyBefore = spyCount(g.hidden.discard)
    fire('caves', g, 'DEFEAT')
    expect(g.spiesAvailable).toBe(availBefore - 1)
    expect(spyCount(g.hidden.discard)).toBe(discSpyBefore + 1)
    assertConservation(g)
  })

  it('Farmhouse (E3) removes a hidden Maquis in play from the game', () => {
    const { g } = chosenGame()
    const c = g.hand.find((x) => x.dataId !== 'spy')!
    g.hand.splice(g.hand.indexOf(c), 1)
    g.inPlay.push({ uid: c.uid, dataId: c.dataId, side: 'hidden', actionUsed: false })
    fire('farmhouse_e3', g, 'DEFEAT')
    expect(g.removedFromGame.some((x) => x.uid === c.uid)).toBe(true)
    assertConservation(g)
  })

  it('Supply Convoy discards one Enemy from each other Mission', () => {
    const { g } = chosenGame()
    const others = g.missionRow.filter((m) => m.uid !== g.chosenMissionUid && m.enemies.length > 0)
    const discBefore = g.enemyDiscard.length
    fire('supply_convoy', g, 'DEFEAT')
    expect(g.enemyDiscard.length).toBe(discBefore + others.length)
    assertConservation(g)
  })

  it('Railroad Bridge discards a chosen Enemy from another Mission', () => {
    const { g } = chosenGame()
    const d = fire('railroad_bridge', g, 'DEFEAT') as Decision
    expect(d.kind).toBe('selectTarget')
    const target = (d as Extract<Decision, { kind: 'selectTarget' }>).candidates[0]
    const discBefore = g.enemyDiscard.length
    fire('railroad_bridge', g, 'DEFEAT', [[target]])
    expect(g.enemyDiscard.map((e) => e.uid)).toContain(target)
    expect(g.enemyDiscard.length).toBe(discBefore + 1)
    assertConservation(g)
  })

  it('Mountain Pass flips all Enemies at one chosen Mission face-up', () => {
    const { g } = chosenGame()
    const d = fire('mountain_pass', g, 'DEFEAT') as Decision
    expect(d.kind).toBe('selectTarget')
    const targetUid = (d as Extract<Decision, { kind: 'selectTarget' }>).candidates[0]
    fire('mountain_pass', g, 'DEFEAT', [[targetUid]])
    const flipped = g.missionRow.find((m) => m.uid === targetUid)!
    expect(flipped.enemies.every((e) => e.faceUp)).toBe(true)
  })

  it('Mountain Pass still asks which Mission after this garrison is already revealed', () => {
    const { g, slot } = chosenGame()
    for (const e of slot.enemies) e.faceUp = true
    const others = g.missionRow.filter((m) => m.uid !== slot.uid && m.enemies.some((e) => !e.faceUp))
    expect(others.length).toBeGreaterThan(1)

    const d = fire('mountain_pass', g, 'DEFEAT') as Decision
    expect(d.kind).toBe('selectTarget')
    const candidates = (d as Extract<Decision, { kind: 'selectTarget' }>).candidates
    expect(candidates).not.toContain(slot.uid)
    expect(candidates.length).toBe(others.length)
    // Nothing flipped yet — the player has to pick.
    for (const m of others) expect(m.enemies.every((e) => !e.faceUp)).toBe(true)

    const targetUid = candidates.find((uid) => uid !== slot.uid)!
    fire('mountain_pass', g, 'DEFEAT', [[targetUid]])
    expect(g.missionRow.find((m) => m.uid === targetUid)!.enemies.every((e) => e.faceUp)).toBe(true)
    for (const m of g.missionRow.filter((m) => m.uid !== targetUid && m.uid !== slot.uid)) {
      expect(m.enemies.every((e) => !e.faceUp)).toBe(true)
    }
  })

  it('Mountain Pass still asks when only one other Mission has face-down Enemies', () => {
    const { g, slot } = chosenGame()
    for (const e of slot.enemies) e.faceUp = true
    const others = g.missionRow.filter((m) => m.uid !== slot.uid && m.enemies.length > 0)
    expect(others.length).toBeGreaterThan(0)
    for (const m of others.slice(1)) for (const e of m.enemies) e.faceUp = true
    const last = others[0]

    const d = fire('mountain_pass', g, 'DEFEAT') as Decision
    expect(d.kind).toBe('selectTarget')
    expect((d as Extract<Decision, { kind: 'selectTarget' }>).candidates).toEqual([last.uid])
    expect(last.enemies.every((e) => !e.faceUp)).toBe(true)
  })

  it('Farmhouse (E2) moves a chosen Revealed-pile card to the Hidden discard', () => {
    const { g } = chosenGame()
    const moved = g.recruit.deck.shift()!
    g.recruit.revealed.push(moved) // seed the Revealed pile
    const d = fire('farmhouse_e2', g, 'DEFEAT') as Decision
    expect(d.kind).toBe('selectCards')
    fire('farmhouse_e2', g, 'DEFEAT', [[moved.uid]])
    expect(g.hidden.discard.map((c) => c.uid)).toContain(moved.uid)
    assertConservation(g)
  })

  it('Police Station keeps Spies on top of the Hidden deck and discards the rest', () => {
    const { g } = chosenGame()
    // Put a Spy on top of the Hidden deck (move one from hand to keep the tally balanced).
    let spy = g.hidden.deck.find(isSpy)
    if (!spy) {
      const i = g.hand.findIndex(isSpy)
      g.hidden.deck.unshift(g.hand.splice(i, 1)[0])
    } else {
      g.hidden.deck.splice(g.hidden.deck.indexOf(spy), 1)
      g.hidden.deck.unshift(spy)
    }
    const discarded = g.hidden.deck.slice(1, 3).map((c) => c.uid) // the two non-spies below it
    fire('police_station', g, 'DEFEAT')
    expect(isSpy(g.hidden.deck[0])).toBe(true)
    for (const uid of discarded) expect(g.hidden.discard.map((c) => c.uid)).toContain(uid)
    assertConservation(g)
  })
})

// --- DEFEND handlers --------------------------------------------------------

describe('mission DEFEND effect logic', () => {
  it("Mayor's House gives every Enemy at the mission +1 Defense", () => {
    const { g, slot } = chosenGame()
    const before = slot.enemies.map((e) => ({ uid: e.uid, def: e.defense }))
    fire('mayor_house', g, 'DEFEND')
    for (const b of before) {
      expect(g.missionRow.find((m) => m.uid === slot.uid)!.enemies.find((e) => e.uid === b.uid)!.defense).toBe(b.def + 1)
    }
  })

  it('Crossroads discards all Maquis in play and zeroes Attack Strength', () => {
    const { g } = chosenGame()
    // Put two Maquis in play (moved from hand) and bank some attack.
    for (const side of ['hidden', 'revealed'] as const) {
      const c = g.hand.find((x) => x.dataId !== 'spy')!
      g.hand.splice(g.hand.indexOf(c), 1)
      g.inPlay.push({ uid: c.uid, dataId: c.dataId, side, actionUsed: false })
    }
    g.attackStrength = 5
    fire('crossroads', g, 'DEFEND')
    expect(g.inPlay).toHaveLength(0)
    expect(g.attackStrength).toBe(0)
    assertConservation(g)
  })

  it('Train Depot (E2/E3) set the ATTACK reveal limit', () => {
    const a = chosenGame().g
    fire('train_depot_e2', a, 'DEFEND')
    expect(a.attackRevealLimit).toBe(0)
    const b = chosenGame().g
    fire('train_depot_e3', b, 'DEFEND')
    expect(b.attackRevealLimit).toBe(1)
  })

  it('is skipped entirely when the mission effect is ignored (Pilar)', () => {
    const { g, slot } = chosenGame()
    g.ignoreMissionEffect = true
    const before = slot.enemies.map((e) => e.defense)
    fire('mayor_house', g, 'DEFEND')
    expect(g.missionRow.find((m) => m.uid === slot.uid)!.enemies.map((e) => e.defense)).toEqual(before)
  })
})

// --- reveal-limit enforcement (actions.ts) ----------------------------------

describe('ATTACK reveal-limit enforcement', () => {
  it('limit 0 (Train Depot E2): no Maquis may be revealed in ATTACK', () => {
    const g = createGame({ seed: 5 })
    g.chosenMissionUid = g.missionRow[0].uid
    g.phase = 'ATTACK'
    g.attackRevealLimit = 0
    const plays = legalActions(g).filter((a) => a.type === 'PlayMaquis')
    expect(plays.length).toBeGreaterThan(0)
    expect(plays.every((a) => a.type === 'PlayMaquis' && a.side === 'hidden')).toBe(true)
    const card = g.hand.find((c) => c.dataId !== 'spy')!
    expect(() => applyAction(g, { type: 'PlayMaquis', uid: card.uid, side: 'revealed' })).toThrow(/limits revealing/)
  })

  it('limit 1 (Train Depot E3): exactly one reveal, then no more', () => {
    const g = createGame({ seed: 5 })
    g.chosenMissionUid = g.missionRow[0].uid
    g.phase = 'ATTACK'
    g.attackRevealLimit = 1
    const first = g.hand.find((c) => c.dataId !== 'spy')!
    const s = applyAction(g, { type: 'PlayMaquis', uid: first.uid, side: 'revealed' })
    expect(s.revealedInAttack).toBe(1)
    expect(legalActions(s).some((a) => a.type === 'PlayMaquis' && a.side === 'revealed')).toBe(false)
    const second = s.hand.find((c) => c.dataId !== 'spy')!
    expect(() => applyAction(s, { type: 'PlayMaquis', uid: second.uid, side: 'revealed' })).toThrow(/limits revealing/)
  })
})

// --- end-to-end wiring (Era-1 missions, reachable via ChooseMission) ---------

describe('end-to-end wiring', () => {
  it('Bunker DEFEND fires at ChooseMission and prompts a hand discard', () => {
    // Bunker is an Era-1 mission; find a seed where it is in the row and the hand has a Maquis.
    let seed = -1
    for (let s = 1; s <= 1000; s++) {
      const g = createGame({ seed: s })
      if (g.missionRow.some((m) => m.dataId === 'bunker') && g.hand.some((c) => c.dataId !== 'spy')) {
        seed = s
        break
      }
    }
    expect(seed).toBeGreaterThan(0)
    const g = createGame({ seed })
    const bunker = g.missionRow.find((m) => m.dataId === 'bunker')!
    const handMaquis = g.hand.filter((c) => c.dataId !== 'spy').length

    let s = applyAction(g, { type: 'ChooseMission', uid: bunker.uid })
    expect(s.phase).toBe('ATTACK')
    expect(s.pendingDecision?.kind).toBe('selectCards') // Bunker's forced discard
    const pick = (s.pendingDecision as Extract<Decision, { kind: 'selectCards' }>).candidates[0]
    s = resolveDecision(s, { selection: [pick] })
    expect(s.hand.filter((c) => c.dataId !== 'spy').length).toBe(handMaquis - 1)
    expect(s.hidden.discard.some((c) => c.uid === pick)).toBe(true)
    assertConservation(s)
  })

  it('Mountain Pass DEFEAT asks which Mission to flip after ChooseMission reveals this garrison', () => {
    let done: GameState | null = null
    search: for (let seed = 1; seed <= 3000; seed++) {
      const g0 = createGame({ seed })
      const mp = g0.missionRow.find((m) => m.dataId === 'mountain_pass')
      if (!mp || mp.enemies.some((e) => e.typeId === 'guard')) continue
      let s = g0
      for (const c of s.hand.filter((c) => c.dataId !== 'spy')) {
        s = applyAction(s, { type: 'PlayMaquis', uid: c.uid, side: 'revealed' })
      }
      s = applyAction(s, { type: 'ChooseMission', uid: mp.uid })
      while (s.pendingDecision) {
        const d = s.pendingDecision
        const pick =
          d.kind === 'selectTarget' || d.kind === 'selectCards'
            ? d.candidates[0]
            : d.kind === 'chooseOption'
              ? d.options[0]
              : d.cards
        s = resolveDecision(s, { selection: Array.isArray(pick) ? pick : [pick] })
      }
      if (s.attackStrength < 5) continue
      const next = applyAction(s, { type: 'SpendAttackOn', targetUid: mp.uid })
      done = next
      break search
    }
    if (!done) throw new Error('no mountain-pass-defeat scenario found')
    expect(done.pendingDecision?.kind).toBe('selectTarget')
    const d = done.pendingDecision as Extract<Decision, { kind: 'selectTarget' }>
    expect(d.prompt).toMatch(/Flip all Enemies/)
    expect(d.candidates.length).toBeGreaterThan(0)
    expect(d.candidates).not.toContain(done.chosenMissionUid)
    const target = d.candidates[0]
    const after = resolveDecision(done, { selection: [target] })
    expect(after.missionRow.find((m) => m.uid === target)!.enemies.every((e) => e.faceUp)).toBe(true)
    assertConservation(after)
  })

  it('Border DEFEAT fires when the mission is defeated', () => {
    // Border has Defense 3 — reachable. Play the hand revealed to bank attack, then defeat it.
    let done: GameState | null = null
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
        done = applyAction(s, { type: 'SpendAttackOn', targetUid: border.uid })
        break search
      }
    }
    if (!done) throw new Error('no border-defeat scenario found')
    expect(done.recoverDrawModifier).toBe(-1) // Border's DEFEAT effect
    assertConservation(done)
  })
})
