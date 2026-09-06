import { describe, it, expect } from 'vitest'
import { createGame, applyAction, legalActions } from '../engine'
import type { GameState } from '../engine'
import { ensureEffectsRegistered } from './bootstrap'
import { applyDispatchedAction, applyDecisionResponse, missionClickKind, settle } from './commit'

ensureEffectsRegistered()

const SEED = 1090256817

function playHidden(state: GameState, dataId: string): GameState {
  const card = state.hand.find((c) => c.dataId === dataId)
  if (!card) throw new Error(`${dataId} is not in hand`)
  return applyAction(state, { type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
}

describe('missionClickKind', () => {
  it('prefers a pending pick over ChooseMission so a scout cannot attack', () => {
    expect(missionClickKind({ canPick: true, canChoose: true, canStrike: false })).toBe('pick')
    expect(missionClickKind({ canPick: false, canChoose: true, canStrike: false })).toBe('choose')
    expect(missionClickKind({ canPick: false, canChoose: false, canStrike: true })).toBe('strike')
    expect(missionClickKind({ canPick: false, canChoose: false, canStrike: false })).toBeNull()
  })
})

describe('Domingo hidden scout (seed 1090256817)', () => {
  it('is in the opening hand when draft is skipped', () => {
    const s = createGame({ seed: SEED })
    expect(s.hand.map((c) => c.dataId)).toContain('domingo')
  })

  it('stays in PLAN and flips only the chosen Enemies when the engine path is used', () => {
    let s = playHidden(createGame({ seed: SEED }), 'domingo')
    s = applyDispatchedAction(s, { type: 'UseAction', uid: 'domingo' })
    expect(s.phase).toBe('PLAN')
    expect(s.pendingDecision?.kind).toBe('selectTarget')
    expect(legalActions(s)).toEqual([])

    const valley = s.missionRow.find((m) => m.dataId === 'valley')!
    s = applyDecisionResponse(s, [valley.uid])
    expect(s.phase).toBe('PLAN')
    expect(s.pendingDecision?.kind).toBe('selectCards')
    expect(s.pendingDecision && 'prompt' in s.pendingDecision && s.pendingDecision.prompt).toMatch(/Flip one or two/)

    const two = valley.enemies.slice(0, 2).map((e) => e.uid)
    s = applyDecisionResponse(s, two)
    expect(s.phase).toBe('PLAN')
    s = applyDecisionResponse(s, [two[0]])
    expect(s.phase).toBe('PLAN')
    expect(s.pendingDecision).toBeNull()
    const slot = s.missionRow.find((m) => m.dataId === 'valley')!
    expect(slot.enemies.map((e) => e.uid)).not.toContain(two[0])
    expect(slot.enemies.find((e) => e.uid === two[1])?.faceUp).toBe(true)
    expect(slot.enemies.filter((e) => e.faceUp)).toHaveLength(1)
  })

  it('treats a stale ChooseMission click during the mission pick as the scout target, not an attack', () => {
    let s = playHidden(createGame({ seed: SEED }), 'domingo')
    s = applyDispatchedAction(s, { type: 'UseAction', uid: 'domingo' })
    const valley = s.missionRow.find((m) => m.dataId === 'valley')!
    // The Mission card's onClick can still be bound to ChooseMission from the previous render.
    const next = applyDispatchedAction(s, { type: 'ChooseMission', uid: valley.uid })
    expect(next.phase).toBe('PLAN')
    expect(next.pendingDecision?.kind).toBe('selectCards')
    expect(next.chosenMissionUid).toBeNull()
    const slot = next.missionRow.find((m) => m.dataId === 'valley')!
    expect(slot.enemies.some((e) => e.faceUp)).toBe(false)
    expect(next.enemyDiscard).toHaveLength(0)
  })

  it('still ChooseMissions when no scout is pending', () => {
    const s = playHidden(createGame({ seed: SEED }), 'domingo')
    const valley = s.missionRow.find((m) => m.dataId === 'valley')!
    const next = applyDispatchedAction(s, { type: 'ChooseMission', uid: valley.uid })
    expect(next.phase).toBe('ATTACK')
    expect(next.chosenMissionUid).toBe(valley.uid)
    expect(next.missionRow.find((m) => m.uid === valley.uid)!.enemies.every((e) => e.faceUp)).toBe(true)
  })

  it('composes UseAction then a same-tick ChooseMission click the way a fast board click does', () => {
    let s = playHidden(createGame({ seed: SEED }), 'domingo')
    const valley = s.missionRow.find((m) => m.dataId === 'valley')!
    s = applyDispatchedAction(s, { type: 'UseAction', uid: 'domingo' })
    s = applyDispatchedAction(s, { type: 'ChooseMission', uid: valley.uid })
    expect(s.phase).toBe('PLAN')
    expect(s.pendingDecision?.kind).toBe('selectCards')
  })

  it('blocks ChooseMission until the player finishes selecting enemy cards', () => {
    let s = playHidden(createGame({ seed: SEED }), 'domingo')
    s = applyDispatchedAction(s, { type: 'UseAction', uid: 'domingo' })
    const valley = s.missionRow.find((m) => m.dataId === 'valley')!
    s = applyDecisionResponse(s, [valley.uid])
    expect(s.pendingDecision?.kind).toBe('selectCards')
    expect(legalActions(s).some((a) => a.type === 'ChooseMission')).toBe(false)

    const blocked = applyDispatchedAction(s, { type: 'ChooseMission', uid: valley.uid })
    expect(blocked).toBe(s)
    expect(blocked.phase).toBe('PLAN')
    expect(blocked.chosenMissionUid).toBeNull()
    expect(blocked.missionRow.find((m) => m.uid === valley.uid)!.enemies.every((e) => !e.faceUp)).toBe(true)

    const two = valley.enemies.slice(0, 2).map((e) => e.uid)
    s = applyDecisionResponse(s, two)
    const stillBlocked = applyDispatchedAction(s, { type: 'ChooseMission', uid: valley.uid })
    expect(stillBlocked).toBe(s)
    expect(stillBlocked.phase).toBe('PLAN')

    s = applyDecisionResponse(s, [two[0]])
    expect(s.pendingDecision).toBeNull()
    expect(legalActions(s).some((a) => a.type === 'ChooseMission')).toBe(true)
    const attack = applyDispatchedAction(s, { type: 'ChooseMission', uid: valley.uid })
    expect(attack.phase).toBe('ATTACK')
  })
})

describe('Pilar hidden scout', () => {
  it('the same stale ChooseMission mapping keeps Pilar in PLAN', () => {
    let s = playHidden(createGame({ seed: SEED }), 'pilar')
    s = applyDispatchedAction(s, { type: 'UseAction', uid: 'pilar' })
    const target = s.pendingDecision && s.pendingDecision.kind === 'selectTarget' ? s.pendingDecision.candidates[0] : ''
    const next = applyDispatchedAction(s, { type: 'ChooseMission', uid: target })
    expect(next.phase).toBe('PLAN')
    expect(next.pendingDecision?.kind).toBe('selectCards')
  })
})

describe('settle', () => {
  it('does not auto-pick Domingo\'s 1–2 flip (min !== max)', () => {
    let s = playHidden(createGame({ seed: SEED }), 'domingo')
    s = applyDispatchedAction(s, { type: 'UseAction', uid: 'domingo' })
    const valley = s.missionRow.find((m) => m.dataId === 'valley')!
    s = applyDecisionResponse(s, [valley.uid])
    expect(settle(s).pendingDecision?.kind).toBe('selectCards')
    expect(settle(s)).toBe(s)
  })
})
