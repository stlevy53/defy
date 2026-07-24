// Game state hook: holds a history stack (for undo), exposes the current state + legal actions,
// and dispatches actions / decision responses through the pure engine.

import { useState, useCallback, useMemo } from 'react'
import { createGame, applyAction, legalActions, resolveDecision } from '../engine'
import type { Action, GameState } from '../engine'
import { ensureEffectsRegistered } from './bootstrap'

ensureEffectsRegistered()

const randomSeed = () => Math.floor(Math.random() * 0x7fffffff)

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
  const [history, setHistory] = useState<GameState[]>(() => [createGame({ seed: initialSeed ?? seed })])
  const [error, setError] = useState<string | null>(null)

  const state = history[history.length - 1]
  const actions = useMemo(() => legalActions(state), [state])

  const push = useCallback((next: GameState) => setHistory((h) => [...h, next]), [])

  const dispatch = useCallback(
    (action: Action) => {
      try {
        setError(null)
        push(applyAction(state, action))
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
        push(resolveDecision(state, { selection }))
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
    setHistory([createGame({ seed: next })])
  }, [])

  return { state, actions, seed, dispatch, respond, undo, newGame, canUndo: history.length > 1, error }
}
