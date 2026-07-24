// Public engine API. Grows each slice; currently: setup, PLAN-phase actions, effects registry.
export { createGame } from './setup'
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
export { registerPlanEffects, canFireEffect, PLAN_EFFECTS } from './effects/plan'
export type * from './types'
