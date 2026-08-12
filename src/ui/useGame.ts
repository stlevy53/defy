// Game state hook: holds a history stack (for undo), exposes the current state + legal actions,
// and dispatches actions / decision responses through the pure engine.

import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { createGame, applyAction, legalActions, resolveDecision } from '../engine'
import type { Action, Decision, GameState } from '../engine'
import { ensureEffectsRegistered } from './bootstrap'
import { APP_VERSION } from './patchNotes'
import { useDebugHook } from './debugHook'

ensureEffectsRegistered()

// --- Save / load ---------------------------------------------------------------------------------
// The engine state is a plain-JSON snapshot with the RNG position inside it, so a save is just the
// history stack serialized to localStorage — persists across sessions in the browser and the
// packaged Electron app. Version-stamped so a stale save can be flagged rather than silently
// loaded into an incompatible build.

const SAVE_KEY = 'defy.save.v1'

/** What a save records: the app version + timestamp (for display) and the full undo history. */
interface SavePayload {
  version: string
  savedAt: number
  seed: number
  history: GameState[]
}

/** Lightweight save descriptor exposed to the UI (does the save exist, when, which build). */
export interface SaveMeta {
  version: string
  savedAt: number
}

export type SaveResult = { ok: true; truncated: boolean } | { ok: false; reason: string }
export type LoadResult = { ok: true; version: string } | { ok: false; reason: string }

function readSave(): SavePayload | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as SavePayload
    if (!p || !Array.isArray(p.history) || p.history.length === 0) return null
    return p
  } catch {
    return null
  }
}

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
  /** History depth. Increases on every committed action, decreases on undo, resets on new game.
   *  Lets consumers tell a *forward* move apart from an undo (see useCardFlights). */
  step: number
  dispatch: (action: Action) => void
  respond: (selection: string[]) => void
  undo: () => void
  newGame: (seed?: number) => void
  /** Persist the current game (full undo history) to localStorage; returns whether it fit. */
  saveGame: () => SaveResult
  /** Restore the saved game, replacing the current one; treats it as a fresh animation context. */
  loadGame: () => LoadResult
  /** Metadata for the current save if one exists, else null (drives the Load button's enabled state). */
  savedMeta: SaveMeta | null
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

  const [savedMeta, setSavedMeta] = useState<SaveMeta | null>(() => {
    const p = readSave()
    return p ? { version: p.version, savedAt: p.savedAt } : null
  })

  const saveGame = useCallback((): SaveResult => {
    if (typeof localStorage === 'undefined') return { ok: false, reason: 'Storage is unavailable here.' }
    const write = (hist: GameState[]) => {
      const payload: SavePayload = { version: APP_VERSION, savedAt: Date.now(), seed, history: hist }
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
      setSavedMeta({ version: payload.version, savedAt: payload.savedAt })
    }
    try {
      write(history)
      return { ok: true, truncated: false }
    } catch {
      // A very long game can exceed the storage quota — fall back to just the current position so
      // the round is still resumable, at the cost of the undo stack.
      try {
        write(history.slice(-1))
        return { ok: true, truncated: true }
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : 'Save failed.' }
      }
    }
  }, [seed, history])

  const loadGame = useCallback((): LoadResult => {
    const p = readSave()
    if (!p) return { ok: false, reason: 'No saved game found.' }
    setSeed(p.seed)
    setGameId((n) => n + 1) // fresh animation context so diff-hooks don't fire against the old board
    setError(null)
    setHistory(p.history)
    return { ok: true, version: p.version }
  }, [])

  // Dev-only: publish the live game on window.__defy for the Tier-2 test harness. No-op in release.
  useDebugHook({
    getState: () => state,
    legalActions: () => actions,
    getSeed: () => seed,
    getStep: () => history.length,
    getError: () => error,
    dispatch,
    resolve: respond,
    newGame,
  })

  return {
    state,
    actions,
    seed,
    gameId,
    step: history.length,
    dispatch,
    respond,
    undo,
    newGame,
    saveGame,
    loadGame,
    savedMeta,
    canUndo: history.length > 1,
    error,
  }
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

/** A card seen moving between the hand and a pile, rendered as a token flying across the board. */
export interface CardFlight {
  id: string
  dataId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  delay: number
}

/** Card zones that (a) can exchange cards with the hand and (b) have a tile in the pile rail we can
 *  fly to/from. Keys match the `data-pile-key` attributes rendered by the Piles component. */
const FLIGHT_ZONES: { key: string; get: (s: GameState) => { uid: string }[] }[] = [
  { key: 'hidden.deck', get: (s) => s.hidden.deck },
  { key: 'hidden.discard', get: (s) => s.hidden.discard },
  { key: 'recruit.deck', get: (s) => s.recruit.deck },
  { key: 'recruit.revealed', get: (s) => s.recruit.revealed },
  { key: 'removed', get: (s) => s.removedFromGame },
]

function zoneOfUid(s: GameState, uid: string): string | null {
  for (const z of FLIGHT_ZONES) if (z.get(s).some((c) => c.uid === uid)) return z.key
  return null
}

/** Measured coordinates need no correction for the board-size setting: CSS `zoom` on the root scales
 *  the rendering, not the layout, so these rects and the flight overlay's fixed positioning are in
 *  the same (unzoomed) CSS pixels. */
function centerOf(el: Element | null): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

const handCenter = () => centerOf(document.querySelector('[data-flight-hand]'))
const pileCenter = (key: string) => centerOf(document.querySelector(`[data-pile-key="${CSS.escape(key)}"]`))

/**
 * Detects cards moving in/out of the hand between two committed states and emits short-lived
 * "flights" — a card token animated from the hand to the destination pile tile (a discard) or from
 * a source pile tile back to the hand (a draw). Gives the player a visual cue for actions like
 * Antonio's spy swap, where the discard-then-draw can otherwise look like nothing happened.
 *
 * Uses the same guards as useReinforcements: a `gameId` change adopts the new state without
 * animating (uids are reused across games), and a non-forward `step` (undo) is ignored so cards
 * never fly backwards. Positions are measured from the live DOM in a layout effect, so the pile
 * rail must render the `data-pile-key` tiles and the hand must carry `data-flight-hand`.
 */
export function useCardFlights(state: GameState, gameId: number, step: number) {
  const prev = useRef<GameState | null>(null)
  const gameRef = useRef(gameId)
  const stepRef = useRef(step)
  const [flights, setFlights] = useState<CardFlight[]>([])

  useLayoutEffect(() => {
    // New game: reuse of uids across games makes a cross-game diff meaningless — adopt & skip.
    if (gameRef.current !== gameId) {
      gameRef.current = gameId
      stepRef.current = step
      prev.current = state
      return
    }
    // Only animate forward moves; undo (step decreases) or a no-op re-render is adopted silently.
    if (step <= stepRef.current) {
      stepRef.current = step
      prev.current = state
      return
    }
    const before = prev.current
    stepRef.current = step
    prev.current = state
    if (!before) return

    const beforeHand = new Map(before.hand.map((c) => [c.uid, c.dataId]))
    const afterHand = new Map(state.hand.map((c) => [c.uid, c.dataId]))
    const hand = handCenter()
    if (!hand) return

    const next: CardFlight[] = []
    let idx = 0
    for (const [uid, dataId] of beforeHand) {
      if (afterHand.has(uid)) continue // still in hand
      const z = zoneOfUid(state, uid) // where it landed
      if (!z) continue // e.g. played to the board — that already has its own visible destination
      const to = pileCenter(z)
      if (!to) continue
      next.push({ id: `${step}-out-${uid}`, dataId, fromX: hand.x, fromY: hand.y, toX: to.x, toY: to.y, delay: idx++ * 70 })
    }
    for (const [uid, dataId] of afterHand) {
      if (beforeHand.has(uid)) continue // was already in hand
      const z = zoneOfUid(before, uid) // where it came from
      if (!z) continue
      const from = pileCenter(z)
      if (!from) continue
      next.push({ id: `${step}-in-${uid}`, dataId, fromX: from.x, fromY: from.y, toX: hand.x, toY: hand.y, delay: idx++ * 70 })
    }
    if (next.length) setFlights((f) => [...f, ...next])
  }, [state, gameId, step])

  const remove = useCallback((id: string) => setFlights((f) => f.filter((x) => x.id !== id)), [])
  return { flights, remove }
}

/** A transient on-screen message mirroring a freshly-appended engine log line. */
export interface LogToast {
  id: string
  text: string
}

/**
 * Surfaces log lines appended by the latest forward move as short-lived toasts, so the player sees
 * what an action did without opening the Log. Uses the same guards as the other diff hooks: a new
 * game or an undo (non-forward `step`) is adopted silently. Only the last few new lines are shown so
 * a chatty multi-step action can't bury the screen; each toast auto-expires on a timer.
 */
export function useLogToasts(state: GameState, gameId: number, step: number, max = 4) {
  const lenRef = useRef(state.log.length)
  const gameRef = useRef(gameId)
  const stepRef = useRef(step)
  const seqRef = useRef(0)
  const [toasts, setToasts] = useState<LogToast[]>([])

  useEffect(() => {
    // New game or undo/no-op: resync the baseline to the current log without emitting toasts.
    if (gameRef.current !== gameId || step <= stepRef.current) {
      gameRef.current = gameId
      stepRef.current = step
      lenRef.current = state.log.length
      return
    }
    stepRef.current = step
    const added = state.log.slice(lenRef.current)
    lenRef.current = state.log.length
    if (added.length === 0) return
    const fresh = added.slice(-max).map((text) => ({ id: `t${seqRef.current++}`, text }))
    setToasts((cur) => [...cur, ...fresh].slice(-max))
  }, [state, gameId, step, max])

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  return { toasts, dismiss }
}
