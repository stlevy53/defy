// Merged effect preconditions. An action is only offered by legalActions when it can be
// performed in full (rulebook FAQ). PLAN and ATTACK effects each own their precondition map;
// this module unions them behind a single canFireEffect the engine consults.

import type { GameState } from '../types'
import { PLAN_PRECONDITIONS } from './plan'
import { ATTACK_PRECONDITIONS } from './attack'

const PRECONDITIONS: Record<string, (s: GameState) => boolean> = {
  ...PLAN_PRECONDITIONS,
  ...ATTACK_PRECONDITIONS,
}

/** True if the effect's precondition is met (or it has none). */
export function canFireEffect(effectId: string, state: GameState): boolean {
  const pre = PRECONDITIONS[effectId]
  return pre ? pre(state) : true
}
