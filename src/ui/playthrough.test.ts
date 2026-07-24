// Integration smoke test: drives a whole game to an ending through the same path the UI uses
// (bootstrap registration → createGame → legalActions → applyAction/resolveDecision), picking a
// terminating strategy. Catches wiring/runtime issues the type checker can't, across many seeds.

import { describe, it, expect } from 'vitest'
import { createGame, applyAction, legalActions, resolveDecision, assertConservation } from '../engine'
import type { Action, GameState } from '../engine'
import { ensureEffectsRegistered } from './bootstrap'

ensureEffectsRegistered()

/** Minimal valid answer to any pending decision. */
function answer(state: GameState): string[] {
  const d = state.pendingDecision!
  switch (d.kind) {
    case 'selectTarget':
      return [d.candidates[0]]
    case 'chooseOption':
      return [d.options[0]]
    case 'selectCards':
      return d.candidates.slice(0, d.min)
    case 'orderCards':
      return d.cards // identity permutation is valid
  }
}

/** Pick an action that drives toward an ending (prefer to end the resistance when possible). */
function choose(actions: Action[]): Action {
  const priority: Action['type'][] = [
    'EndResistance',
    'AdvancePhase',
    'ChooseMission',
    'PlayMaquis',
    'UseAction',
    'SpendAttackOn',
    'Continue',
  ]
  for (const t of priority) {
    const a = actions.find((x) => x.type === t)
    if (a) return a
  }
  return actions[0]
}

describe('full-game playthrough (UI path)', () => {
  it('reaches a result without throwing, conserving cards throughout, across seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let state = createGame({ seed })
      let steps = 0
      while (state.result === null && steps++ < 400) {
        if (state.pendingDecision) {
          state = resolveDecision(state, { selection: answer(state) })
        } else {
          const acts = legalActions(state)
          expect(acts.length).toBeGreaterThan(0) // never a dead end before GAME_OVER
          state = applyAction(state, choose(acts))
        }
        assertConservation(state)
      }
      expect(state.result).not.toBeNull()
      expect(state.phase).toBe('GAME_OVER')
    }
  })
})
