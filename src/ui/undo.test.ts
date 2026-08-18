import { describe, it, expect } from 'vitest'
import { createGame, applyAction, legalActions, resolveDecision } from '../engine'
import type { GameState } from '../engine'
import { ensureEffectsRegistered } from './bootstrap'
import { canPopUndo, missionGarrisonCommitted } from './undo'

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
