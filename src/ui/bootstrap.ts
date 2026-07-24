// Registers every card effect into the engine's global registry exactly once. The engine does
// not auto-register on import (so its `[stub]` path stays testable), so the app must call this
// before applying any action.

import {
  registerPlanEffects,
  registerAttackEffects,
  registerEnemyEffects,
  registerMissionEffects,
} from '../engine'

let registered = false

export function ensureEffectsRegistered(): void {
  if (registered) return
  registerPlanEffects()
  registerAttackEffects()
  registerEnemyEffects()
  registerMissionEffects()
  registered = true
}
