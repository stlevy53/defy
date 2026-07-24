// Effect registry: per-card behavior lives here, keyed by a string effect id.
// This slice ships the registry *shape* only — real card effects land in the next slice.
// Unregistered effects are skipped by the driver with a "[stub]" log entry, so the
// action flow works end-to-end before every handler exists.

import type { Draft } from 'immer'
import type { Decision, GameState, Side } from '../types'

/** What a handler sees when it runs. `state` is an Immer draft — mutate it freely. */
export interface EffectContext {
  state: Draft<GameState>
  sourceUid: string
  args: Record<string, unknown>
  /** One entry per resolved decision so far, in order. Handlers use `responses.length`
   *  to know which stage they're resuming at. */
  responses: string[][]
}

/**
 * An effect handler is re-invoked from the top on every resume.
 * Return a `Decision` to suspend and ask the player for input; return nothing when done.
 */
export type EffectHandler = (ctx: EffectContext) => Decision | undefined | void

export const effectRegistry: Record<string, EffectHandler> = {}

export function registerEffect(effectId: string, handler: EffectHandler): void {
  effectRegistry[effectId] = handler
}

export function unregisterEffect(effectId: string): void {
  delete effectRegistry[effectId]
}

// --- Effect-id conventions (one namespace per card family) ---

export const maquisEffectId = (dataId: string, side: Side): string => `maquis:${dataId}:${side}`
export const missionEffectId = (dataId: string): string => `mission:${dataId}`
export const enemyEffectId = (typeId: string): string => `enemy:${typeId}`
