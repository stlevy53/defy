// Dev-only test seam. Exposes the live game on `window.__defy` so an out-of-process driver (the
// Tier-2 CDP harness, or a browser console) can force a seed, read authoritative engine state, and
// apply moves deterministically — instead of pixel-hunting the UI. It also underpins the
// DOM-vs-state oracle: the harness compares what it renders against getState().
//
// GATED OFF in normal release builds. It attaches only when Vite's DEV flag is set (`npm run dev`)
// or an explicit opt-in build flag is passed (`VITE_DEFY_DEBUG=1 npm run build`). The shipping
// portable .exe is a plain production build, so it never carries this hook.

import { useEffect } from 'react'
import type { Action, GameState } from '../engine'

export interface DebugApi {
  /** Current committed engine state (post-settle). Re-read after each move. */
  getState: () => GameState
  /** Legal moves in the current state. */
  legalActions: () => Action[]
  /** The active seed. */
  getSeed: () => number
  /** History length — increments on every accepted move; lets the driver detect progress. */
  getStep: () => number
  /** Last dispatch error the UI swallowed (illegal move etc.), or null. */
  getError: () => string | null
  /** Apply an action (drives React state; await a tick before re-reading). */
  dispatch: (action: Action) => void
  /** Answer the pending decision. */
  resolve: (selection: string[]) => void
  /** Start a fresh game, optionally from a specific seed. Second arg is the rulebook draft. */
  newGame: (seed?: number, draft?: boolean) => void
}

export type DefyDebugGlobal = DebugApi & { enabled: true; api: 'v1' }

declare global {
  interface Window {
    __defy?: DefyDebugGlobal
  }
}

const ENABLED =
  import.meta.env.DEV || (import.meta.env.VITE_DEFY_DEBUG as string | undefined) === '1'

/** Publishes the live game onto window.__defy every render (bindings close over current state). */
export function useDebugHook(api: DebugApi): void {
  useEffect(() => {
    if (!ENABLED || typeof window === 'undefined') return
    window.__defy = { ...api, enabled: true, api: 'v1' }
  })
}
