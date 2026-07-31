// Per-step oracles. The engine already ships the strongest one — assertConservation — which throws
// if any card family's total drifts or a uid appears in two zones. Here we add the cheap scalar and
// phase checks. These run after every action and every decision.

import { assertConservation, type GameState } from '../src/engine'

export interface Violation {
  kind: string
  detail: string
}

const PHASES = new Set(['PLAN', 'ATTACK', 'AFTERMATH', 'RECOVER', 'GAME_OVER'])

/**
 * Hard invariant (card conservation) throws — the caller treats that as a crash-class failure.
 * Soft invariants are returned so the run can continue and collect more than one.
 */
export function checkInvariants(state: GameState): Violation[] {
  assertConservation(state) // throws with a descriptive message on any imbalance / duplicate uid

  const v: Violation[] = []

  const scalars: [string, number][] = [
    ['attackStrength', state.attackStrength],
    ['spiesAvailable', state.spiesAvailable],
    ['failedMissions', state.failedMissions],
    ['revealedInAttack', state.revealedInAttack],
    ['round', state.round],
  ]
  for (const [name, n] of scalars) {
    if (!Number.isFinite(n)) v.push({ kind: 'nan', detail: `${name} = ${n}` })
    else if (n < 0) v.push({ kind: 'negative', detail: `${name} = ${n}` })
  }

  for (const slot of state.missionRow) {
    for (const e of slot.enemies) {
      if (!Number.isFinite(e.defense) || e.defense < 0) {
        v.push({ kind: 'enemyDefense', detail: `${e.uid} defense=${e.defense}` })
      }
    }
  }

  if (!PHASES.has(state.phase)) {
    v.push({ kind: 'phase', detail: `unknown phase ${state.phase}` })
  }

  return v
}
