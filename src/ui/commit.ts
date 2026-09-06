// UI-layer commit: turn a board click into the next engine state.
//
// Two jobs live here so tests can exercise them without mounting React:
//   1. settle / forcedSelection — skip decisions that aren't real choices (same rules as sim/decision.ts).
//   2. applyDispatchedAction — ChooseMission is illegal while a PLAN action is still asking
//      questions (pick a Mission, then pick Enemies). A stale "click to attack" handler must not
//      flip the whole garrison and jump to ATTACK; if the click is on the scout's Mission target,
//      answer that pick, otherwise ignore it until the action finishes.

import { applyAction, resolveDecision } from '../engine'
import type { Action, Decision, GameState } from '../engine'

/** The forced answer to a decision that offers no real choice, or null if the player must decide.
 *  Used to skip pointless panels (a single legal target, a "take all", nothing to take). */
export function forcedSelection(d: Decision): string[] | null {
  switch (d.kind) {
    case 'selectTarget':
      return d.candidates.length === 1 ? [d.candidates[0]] : null
    case 'chooseOption':
      return d.options.length === 1 ? [d.options[0]] : null
    case 'orderCards':
      return d.cards.length <= 1 ? d.cards : null
    case 'selectCards': {
      if (d.forceChoice) return null
      const n = d.candidates.length
      if (d.min === d.max) {
        if (d.min === 0) return []
        if (d.min === n) return [...d.candidates]
      }
      if (n === 0 && d.min === 0) return []
      return null
    }
  }
}

/** Resolve any run of forced decisions so only genuine choices reach the UI. Bounded to avoid a
 *  loop if the engine ever produced an unanswerable decision. */
export function settle(state: GameState): GameState {
  let s = state
  for (let i = 0; i < 100 && s.pendingDecision; i++) {
    const sel = forcedSelection(s.pendingDecision)
    if (sel === null) break
    s = resolveDecision(s, { selection: sel })
  }
  return s
}

/** Which Mission-card click wins when several modes are flagged. A pending-decision pick always
 *  beats ChooseMission: otherwise a scout's "click this Mission" would attack it. */
export function missionClickKind(flags: {
  canPick: boolean
  canChoose: boolean
  canStrike: boolean
}): 'pick' | 'choose' | 'strike' | null {
  if (flags.canPick) return 'pick'
  if (flags.canChoose) return 'choose'
  if (flags.canStrike) return 'strike'
  return null
}

function asDecisionResponse(state: GameState, action: Action): string[] | null {
  const d = state.pendingDecision
  if (!d || action.type !== 'ChooseMission') return null
  if (!('candidates' in d) || !d.candidates.includes(action.uid)) return null
  if (d.kind === 'selectTarget') return [action.uid]
  if (d.kind === 'selectCards' && d.min === 1 && d.max === 1) return [action.uid]
  return null
}

/** Apply a UI-dispatched action. ChooseMission cannot start the attack while a PLAN action is
 *  still pending (including Domingo/Pilar's "select enemy cards" step). A click on a Mission
 *  that is the current pick target answers that pick; any other ChooseMission is ignored.
 *  Returns the same state reference when ignored so the caller can skip a history frame. */
export function applyDispatchedAction(state: GameState, action: Action): GameState {
  if (state.pendingDecision) {
    const reply = asDecisionResponse(state, action)
    if (reply) return settle(resolveDecision(state, { selection: reply }))
    if (action.type === 'ChooseMission') return state
  }
  return settle(applyAction(state, action))
}

/** Answer a pending decision, then settle any follow-on forced choices. */
export function applyDecisionResponse(state: GameState, selection: string[]): GameState {
  return settle(resolveDecision(state, { selection }))
}
