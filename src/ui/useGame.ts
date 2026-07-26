// Game state hook: holds a history stack (for undo), exposes the current state + legal actions,
// and dispatches actions / decision responses through the pure engine.

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { createGame, applyAction, legalActions, resolveDecision } from '../engine'
import type { Action, Decision, GameState } from '../engine'
import { ensureEffectsRegistered } from './bootstrap'

ensureEffectsRegistered()

const randomSeed = () => Math.floor(Math.random() * 0x7fffffff)

/** The forced answer to a decision that offers no real choice, or null if the player must decide.
 *  Used to skip pointless panels (a single legal target, a "take all", nothing to take). */
function forcedSelection(d: Decision): string[] | null {
  switch (d.kind) {
    case 'selectTarget':
      return d.candidates.length === 1 ? [d.candidates[0]] : null
    case 'chooseOption':
      return d.options.length === 1 ? [d.options[0]] : null
    case 'orderCards':
      return d.cards.length <= 1 ? d.cards : null
    case 'selectCards': {
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
function settle(state: GameState): GameState {
  let s = state
  for (let i = 0; i < 100 && s.pendingDecision; i++) {
    const sel = forcedSelection(s.pendingDecision)
    if (sel === null) break
    s = resolveDecision(s, { selection: sel })
  }
  return s
}

export interface UseGame {
  state: GameState
  actions: Action[]
  seed: number
  /** Monotonic id that changes only when a new game starts (immune to seed reuse). */
  gameId: number
  dispatch: (action: Action) => void
  respond: (selection: string[]) => void
  undo: () => void
  newGame: (seed?: number) => void
  canUndo: boolean
  error: string | null
}

export function useGame(initialSeed?: number): UseGame {
  const [seed, setSeed] = useState<number>(() => initialSeed ?? randomSeed())
  const [gameId, setGameId] = useState(0)
  const [history, setHistory] = useState<GameState[]>(() => [settle(createGame({ seed: initialSeed ?? seed }))])
  const [error, setError] = useState<string | null>(null)

  const state = history[history.length - 1]
  const actions = useMemo(() => legalActions(state), [state])

  const push = useCallback((next: GameState) => setHistory((h) => [...h, next]), [])

  const dispatch = useCallback(
    (action: Action) => {
      try {
        setError(null)
        push(settle(applyAction(state, action)))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [state, push],
  )

  const respond = useCallback(
    (selection: string[]) => {
      try {
        setError(null)
        push(settle(resolveDecision(state, { selection })))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [state, push],
  )

  const undo = useCallback(() => {
    setError(null)
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h))
  }, [])

  const newGame = useCallback((s?: number) => {
    const next = s ?? randomSeed()
    setSeed(next)
    setGameId((n) => n + 1)
    setError(null)
    setHistory([settle(createGame({ seed: next }))])
  }, [])

  return { state, actions, seed, gameId, dispatch, respond, undo, newGame, canUndo: history.length > 1, error }
}

/**
 * Enemies newly added to an *existing* Mission between two committed states — e.g. a surviving
 * Radio Operator's "place a face-down Enemy on all other Missions", the Barracks, or an Enemy
 * moved by a Maquis action. Returns `missionUid -> new enemy uids` so the Mission tile can animate
 * the reinforcement, then clears itself after the animation window.
 *
 * Freshly refilled Mission slots (a uid not present in the previous state) are ignored — dealing a
 * new Mission's garrison is not a reinforcement. Undo naturally produces no additions, so it never
 * animates spuriously.
 *
 * `gameId` identifies the current game: because card uids are only unique *within* a game (they're
 * reused across games), we must NOT diff the old game's final state against a new game's initial
 * deal — that would flag every mission as reinforced. When `gameId` changes we adopt the new state
 * without animating.
 */
export function useReinforcements(state: GameState, gameId: number): Record<string, string[]> {
  const seen = useRef<GameState | null>(null)
  const gameRef = useRef(gameId)
  const [added, setAdded] = useState<Record<string, string[]>>({})

  // Diff the incoming state against the last one we processed. `seen` is a ref (not deps) so this
  // survives React 18 StrictMode's mount-time double-invoke; the clear-timer lives in the effect
  // below, keyed on `added`, so it schedules cleanly regardless.
  useEffect(() => {
    // A new game started: adopt its initial state as the baseline, clearing any lingering badge.
    if (gameRef.current !== gameId) {
      gameRef.current = gameId
      seen.current = state
      setAdded({})
      return
    }
    const prev = seen.current
    if (prev === state) return
    seen.current = state
    if (!prev) return // first commit — don't animate the initial deal

    const next: Record<string, string[]> = {}
    for (const slot of state.missionRow) {
      const before = prev.missionRow.find((m) => m.uid === slot.uid)
      if (!before) continue // a newly refilled Mission slot, not a reinforcement
      const had = new Set(before.enemies.map((e) => e.uid))
      const fresh = slot.enemies.filter((e) => !had.has(e.uid)).map((e) => e.uid)
      if (fresh.length > 0) next[slot.uid] = fresh
    }
    if (Object.keys(next).length > 0) setAdded(next)
  }, [state, gameId])

  useEffect(() => {
    if (Object.keys(added).length === 0) return
    const t = setTimeout(() => setAdded({}), 1700)
    return () => clearTimeout(t)
  }, [added])

  return added
}
