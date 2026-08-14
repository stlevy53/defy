// Public engine API. Grows each slice; currently: setup, PLAN-phase actions, effects registry.
export { createGame, isDrafting, isDraftDecision, DRAFT_FROM } from './setup'
export type { CreateGameOptions } from './setup'
export { shuffle, rngNext } from './rng'
export { applyAction, legalActions, resolveDecision } from './actions'
export { countCards, assertConservation } from './zones'
export type { CardCounts } from './zones'
export {
  registerEffect,
  unregisterEffect,
  maquisEffectId,
  missionEffectId,
  enemyEffectId,
} from './effects/registry'
export type { EffectContext, EffectHandler } from './effects/registry'
export { registerPlanEffects, PLAN_EFFECTS } from './effects/plan'
export { registerAttackEffects, ATTACK_EFFECTS } from './effects/attack'
export { registerEnemyEffects, ENEMY_EFFECTS } from './effects/enemies'
export { registerMissionEffects, MISSION_EFFECTS } from './effects/missions'
export { canFireEffect } from './effects/preconditions'
export type * from './types'
