// Game state hook: holds a history stack (for undo), exposes the current state + legal actions,
// and dispatches actions / decision responses through the pure engine.

import { useState, useCallback, useMemo } from 'react'
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
  dispatch: (action: Action) => void
  respond: (selection: string[]) => void
  undo: () => void
  newGame: (seed?: number) => void
  canUndo: boolean
  error: string | null
}

export function useGame(initialSeed?: number): UseGame {
  const [seed, setSeed] = useState<number>(() => initialSeed ?? randomSeed())
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
    setError(null)
    setHistory([settle(createGame({ seed: next }))])
  }, [])

  return { state, actions, seed, dispatch, respond, undo, newGame, canUndo: history.length > 1, error }
}
