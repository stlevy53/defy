// ATTACK-side Maquis effects — chunk 1: attack-value and defense modifiers.
//
// Same stage-style contract as effects/plan.ts, but these are all single-shot (no player
// decision): they read the board and mutate a scalar. Attack bonuses `+=` state.attackStrength;
// defense modifiers mutate the live Defense the resolution reads (enemy.defense) or set the
// per-round mission-Defense override. Because DEFEND effects resolve at ATTACK start and these
// ATTACK-action effects resolve later when used, the FAQ ordering (Engineer +1 before Benigno −1)
// falls out of execution order — no explicit ordering code needed.
//
// Chunk 2 (enemy discard/move, counter-guerrilla sweep, ATTACK draws) and the mission/enemy
// effect handlers land next.

import type { Draft } from 'immer'
import { civilians as civilianData, missions as missionsData } from '../../data'
import type { GameState, MissionSlot } from '../types'
import { maquisEffectId, registerEffect, type EffectHandler } from './registry'

const civiliansById = new Map(civilianData.map((c) => [c.id, c.civilians]))
const missionDefenseById = new Map(missionsData.map((m) => [m.id, m.defense]))

/** The chosen Mission's slot (local copy — effects stay self-contained, no import from actions). */
function chosenSlot(state: Draft<GameState>): MissionSlot | undefined {
  if (state.chosenMissionUid === null) return undefined
  return state.missionRow.find((s) => s.uid === state.chosenMissionUid)
}

const countRevealedInPlay = (state: Draft<GameState>): number =>
  state.inPlay.filter((m) => m.side === 'revealed').length

/** +1 Attack for each revealed Maquis in play. (Soledad hidden, Abel hidden) */
const plusPerRevealed: EffectHandler = ({ state }) => {
  ;(state as Draft<GameState>).attackStrength += countRevealedInPlay(state as Draft<GameState>)
}

/** +1 Attack for each *other* Maquis in play, hidden or revealed. (Marcelino revealed) */
const plusPerOther: EffectHandler = ({ state, sourceUid }) => {
  const s = state as Draft<GameState>
  s.attackStrength += s.inPlay.filter((m) => m.uid !== sourceUid).length
}

/** +1 Attack for each civilian in the Graveyard (sum of the cards' civilian counts). (Abel revealed) */
const plusPerCivilian: EffectHandler = ({ state }) => {
  const s = state as Draft<GameState>
  s.attackStrength += s.graveyard.reduce((n, c) => n + (civiliansById.get(c.dataId) ?? 0), 0)
}

/** Reduce by 1 the Defense of each Enemy at the chosen Mission whose Defense is 2 or more. (Benigno revealed) */
const benignoReduce: EffectHandler = ({ state }) => {
  const slot = chosenSlot(state as Draft<GameState>)
  if (!slot) return
  for (const e of slot.enemies) if (e.defense >= 2) e.defense -= 1
}

/** Halve the chosen Mission's Defense, rounded up. (Ricardo revealed) */
const ricardoHalf: EffectHandler = ({ state }) => {
  const s = state as Draft<GameState>
  const slot = chosenSlot(s)
  if (!slot) return
  const current = s.missionDefenseOverride ?? missionDefenseById.get(slot.dataId) ?? 0
  s.missionDefenseOverride = Math.ceil(current / 2)
}

/** Chunk-1 ATTACK effects (attack/defense modifiers), keyed by effect id. */
export const ATTACK_EFFECTS: Record<string, EffectHandler> = {
  [maquisEffectId('soledad', 'hidden')]: plusPerRevealed,
  [maquisEffectId('abel', 'hidden')]: plusPerRevealed,
  [maquisEffectId('marcelino', 'revealed')]: plusPerOther,
  [maquisEffectId('abel', 'revealed')]: plusPerCivilian,
  [maquisEffectId('benigno', 'revealed')]: benignoReduce,
  [maquisEffectId('ricardo', 'revealed')]: ricardoHalf,
}

/** Register the ATTACK effects into the global registry. Like registerPlanEffects, this is
 *  explicit (not on import) so the driver's `[stub]` path stays testable in isolation. */
export function registerAttackEffects(): void {
  for (const [id, handler] of Object.entries(ATTACK_EFFECTS)) registerEffect(id, handler)
}
