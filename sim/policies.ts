// Move-selection policies. A policy maps (state, legalActions) -> one action. All three tiers of
// the tester share this seam; swap the policy, keep the driver.

import type { Action, GameState } from '../src/engine'
import { pick, type Rng } from './prng'

export type Policy = (state: GameState, actions: Action[], rng: Rng) => Action
export interface NamedPolicy {
  name: string
  choose: Policy
}

/** Drop PLAN rearrange so self-play doesn't flip cards forever. Falls back to the full list if
 *  that would leave nothing (shouldn't happen — ChooseMission is almost always legal in PLAN). */
function withoutRearrange(actions: Action[]): Action[] {
  const rest = actions.filter((a) => a.type !== 'MoveMaquis')
  return rest.length ? rest : actions
}

/** Uniform over legal moves. Best raw bug-finding coverage; tends to end games early (random play
 *  often picks EndResistance), so pair it with `greedy` for depth. Skips PLAN rearrange so it
 *  cannot loop Hidden ↔ Revealed. */
export const randomPolicy: NamedPolicy = {
  name: 'random',
  choose: (_s, actions, rng) => pick(rng, withoutRearrange(actions)),
}

// Progress-seeking. Reveals Maquis and fires card actions first — that maximizes how many effect
// handlers actually execute, which is exactly where the Sagrario/Ramona "shipped-unregistered"
// class of bug lives (both were *revealed*-side actions). It then defeats missions and keeps the
// resistance going, so runs reach deep, multi-round states random play rarely visits.
const RANK: Record<Action['type'], number> = {
  UseAction: 7,
  PlayMaquis: 6,
  SpendAttackOn: 5,
  ChooseMission: 4,
  AdvancePhase: 3,
  Continue: 2,
  EndResistance: 1,
  MoveMaquis: 0,
}

export const greedyPolicy: NamedPolicy = {
  name: 'greedy',
  choose: (state, actions) => {
    const pool = withoutRearrange(actions)
    let best = pool[0]
    let bestScore = -Infinity
    for (const a of pool) {
      let s = RANK[a.type] * 10
      if (a.type === 'PlayMaquis' && a.side === 'revealed') s += 5 // prefer revealing (fires revealed actions)
      if (a.type === 'SpendAttackOn') {
        const isMission = state.missionRow.some((m) => m.uid === a.targetUid)
        s += isMission ? 3 : 1 // finish the mission when affordable
      }
      if (s > bestScore) {
        bestScore = s
        best = a
      }
    }
    return best
  },
}

export const POLICIES: Record<string, NamedPolicy> = {
  random: randomPolicy,
  greedy: greedyPolicy,
}
