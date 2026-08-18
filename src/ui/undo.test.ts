import { describe, it, expect } from 'vitest'
import { createGame, applyAction, legalActions, resolveDecision } from '../engine'
import type { GameState } from '../engine'
import { ensureEffectsRegistered } from './bootstrap'
import { canPopUndo, missionGarrisonCommitted, popUndo } from './undo'

ensureEffectsRegistered()

function drain(state: GameState): GameState {
  let s = state
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
  return s
}

function chooseFirstMission(state: GameState): GameState {
  const act = legalActions(state).find((a) => a.type === 'ChooseMission')
  if (!act || act.type !== 'ChooseMission') throw new Error('no ChooseMission')
  return drain(applyAction(state, act))
}

function scoutFlip(state: GameState): GameState {
  return {
    ...state,
    missionRow: state.missionRow.map((m, i) =>
      i === 0 ? { ...m, enemies: m.enemies.map((e) => ({ ...e, faceUp: true })) } : m,
    ),
  }
}

describe('missionGarrisonCommitted', () => {
  it('is false during PLAN (scout is a separate reveal lock)', () => {
    const plan = createGame({ seed: 1 })
    expect(missionGarrisonCommitted(plan)).toBe(false)
    expect(missionGarrisonCommitted(scoutFlip(plan))).toBe(false)
  })

  it('is true after ChooseMission reveals the garrison', () => {
    const plan = createGame({ seed: 1 })
    const attack = chooseFirstMission(plan)
    expect(attack.phase).toBe('ATTACK')
    expect(missionGarrisonCommitted(attack)).toBe(true)
  })
})

describe('canPopUndo', () => {
  it('allows undoing PLAN plays', () => {
    const start = createGame({ seed: 1 })
    const maquis = start.hand.find((c) => c.dataId !== 'spy')!
    const played = applyAction(start, { type: 'PlayMaquis', uid: maquis.uid, side: 'hidden' })
    expect(canPopUndo([start, played])).toBe(true)
  })

  it('blocks undoing ChooseMission once Enemies are face-up', () => {
    const plan = createGame({ seed: 1 })
    const attack = chooseFirstMission(plan)
    expect(canPopUndo([plan, attack])).toBe(false)
  })

  it('still allows undoing a play after the Mission is chosen', () => {
    const plan = createGame({ seed: 1 })
    const attack = chooseFirstMission(plan)
    const play = legalActions(attack).find((a) => a.type === 'PlayMaquis')
    if (!play) return // all-Spy leftover is legal; nothing to undo past the lock anyway
    const played = drain(applyAction(attack, play))
    expect(canPopUndo([plan, attack, played])).toBe(true)
    expect(canPopUndo([plan, attack])).toBe(false)
  })

  it('blocks undoing a PLAN scout that flipped Enemies', () => {
    const start = createGame({ seed: 1 })
    const scouted = scoutFlip(start)
    expect(canPopUndo([start, scouted])).toBe(false)
  })

  it('still allows undoing a PLAN play after Enemies have been scouted', () => {
    const start = createGame({ seed: 1 })
    const scouted = scoutFlip(start)
    const maquis = scouted.hand.find((c) => c.dataId !== 'spy')!
    const played = applyAction(scouted, { type: 'PlayMaquis', uid: maquis.uid, side: 'hidden' })
    expect(canPopUndo([start, scouted, played])).toBe(true)
    expect(canPopUndo([start, scouted])).toBe(false)
  })

  it('keeps the lock after ATTACK clears the garrison toward AFTERMATH', () => {
    let s = chooseFirstMission(createGame({ seed: 1 }))
    const history: GameState[] = [createGame({ seed: 1 }), s]
    for (let i = 0; i < 30 && s.phase === 'ATTACK' && s.result === null; i++) {
      if (s.pendingDecision) {
        s = drain(s)
        history.push(s)
        continue
      }
      const acts = legalActions(s)
      const next = acts.find((a) => a.type === 'AdvancePhase') ?? acts.find((a) => a.type === 'PlayMaquis') ?? acts[0]
      s = drain(applyAction(s, next))
      history.push(s)
    }
    expect(s.phase === 'AFTERMATH' || s.phase === 'GAME_OVER').toBe(true)
    expect(canPopUndo(history)).toBe(true)
    // Walking back through ATTACK is fine; crossing ChooseMission is not.
    while (history.length > 2) history.pop()
    expect(canPopUndo(history)).toBe(false)
  })
})

describe('popUndo', () => {
  it("takes back Anastasio's enemy discard and resets his action in one Undo", () => {
    let start: GameState | undefined
    let mi = -1
    for (let seed = 1; seed <= 2000; seed++) {
      const s = createGame({ seed })
      if (!s.hand.some((c) => c.dataId === 'anastasio')) continue
      mi = s.missionRow.findIndex((m) => m.enemies.length >= 2)
      if (mi === -1) continue
      start = s
      break
    }
    if (!start) throw new Error('no seed with Anastasio and a 2-Enemy Mission')

    const card = start.hand.find((c) => c.dataId === 'anastasio')!
    const played = applyAction(start, { type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
    const attack = drain(applyAction(played, { type: 'ChooseMission', uid: played.missionRow[mi].uid }))
    const used = applyAction(attack, { type: 'UseAction', uid: card.uid })
    expect(used.pendingDecision?.kind).toBe('selectTarget')
    const d = used.pendingDecision
    if (!d || d.kind !== 'selectTarget') throw new Error('expected selectTarget')
    const target = d.candidates[0]
    const resolved = drain(resolveDecision(used, { selection: [target] }))
    expect(resolved.inPlay.find((m) => m.uid === card.uid)?.actionUsed).toBe(true)
    expect(resolved.missionRow.find((m) => m.uid === resolved.chosenMissionUid)?.enemies.some((e) => e.uid === target)).toBe(
      false,
    )

    const back = popUndo([played, attack, used, resolved])
    expect(back).toHaveLength(2)
    const s = back[back.length - 1]
    expect(s.pendingDecision).toBeNull()
    expect(s.inPlay.find((m) => m.uid === card.uid)?.actionUsed).toBe(false)
    expect(legalActions(s).some((a) => a.type === 'UseAction' && a.uid === card.uid)).toBe(true)
    expect(s.missionRow.find((m) => m.uid === s.chosenMissionUid)?.enemies.some((e) => e.uid === target)).toBe(true)
  })

  it('undoing the targeting prompt before a pick also resets the action', () => {
    let start: GameState | undefined
    let mi = -1
    for (let seed = 1; seed <= 2000; seed++) {
      const s = createGame({ seed })
      if (!s.hand.some((c) => c.dataId === 'anastasio')) continue
      mi = s.missionRow.findIndex((m) => m.enemies.length >= 2)
      if (mi === -1) continue
      start = s
      break
    }
    if (!start) throw new Error('no seed with Anastasio and a 2-Enemy Mission')

    const card = start.hand.find((c) => c.dataId === 'anastasio')!
    const played = applyAction(start, { type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
    const attack = drain(applyAction(played, { type: 'ChooseMission', uid: played.missionRow[mi].uid }))
    const used = applyAction(attack, { type: 'UseAction', uid: card.uid })
    const back = popUndo([played, attack, used])
    expect(back[back.length - 1].inPlay.find((m) => m.uid === card.uid)?.actionUsed).toBe(false)
    expect(back[back.length - 1].pendingDecision).toBeNull()
  })

  it('does not skip a whole draft when undoing one pick', () => {
    const first = createGame({ seed: 1, draft: true })
    expect(first.pendingDecision?.kind).toBe('selectCards')
    const pick = first.pendingDecision && first.pendingDecision.kind === 'selectCards' ? first.pendingDecision.candidates[0] : ''
    const second = resolveDecision(first, { selection: [pick] })
    const back = popUndo([first, second])
    expect(back).toHaveLength(1)
    expect(back[0].pendingDecision).toEqual(first.pendingDecision)
  })
})
