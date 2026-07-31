// The shared self-play loop. Given a seed and a policy it plays one full game through the pure
// engine, running the oracles after every step, and returns a structured result (never throws for
// game reasons — engine crashes are captured as findings). Tiers 2/3 reuse this by swapping the
// policy for a live/Claude one.

import {
  createGame,
  legalActions,
  applyAction,
  resolveDecision,
  type Action,
  type Decision,
  type GameState,
  type GameResult,
} from '../src/engine'
import { ensureEffectsRegistered } from '../src/ui/bootstrap'
import { mulberry32 } from './prng'
import { autoSelect } from './decision'
import type { NamedPolicy } from './policies'
import { checkInvariants, type Violation } from './invariants'

// Effects register explicitly (not on import) so the engine's [stub] path stays testable — the
// driver must do what the app's bootstrap does, or every effect would falsely look unimplemented.
ensureEffectsRegistered()

export type StepRecord =
  | { step: number; phase: string; kind: 'action'; action: Action }
  | { step: number; phase: string; kind: 'decision'; decision: Decision; selection: string[] }

export type Failure =
  | { type: 'crash'; message: string; stack?: string; step: number }
  | { type: 'softlock'; step: number; phase: string }
  | { type: 'invariant'; step: number; phase: string; violations: Violation[] }
  | { type: 'nontermination'; stepCap: number }

export interface RunResult {
  seed: number
  policy: string
  steps: number
  rounds: number
  finalPhase: string
  result: GameResult | null
  /** Unique effect ids that fell through to the engine's [stub] path — an unimplemented handler. */
  stubEffects: string[]
  failures: Failure[]
  /** Full move/decision trace — attached only when something went wrong, to keep reports small. */
  trace?: StepRecord[]
}

export interface RunOptions {
  stepCap?: number
  /** Perturbs the fuzzer RNG so the same seed can be explored under different move choices. */
  salt?: number
}

const DEFAULT_STEP_CAP = 2000

export function playGame(seed: number, policy: NamedPolicy, opts: RunOptions = {}): RunResult {
  const stepCap = opts.stepCap ?? DEFAULT_STEP_CAP
  const rng = mulberry32((seed ^ (opts.salt ?? 0)) >>> 0)
  const trace: StepRecord[] = []
  const failures: Failure[] = []
  const stub = new Set<string>()
  let stubScanned = 0 // only scan new log lines each step

  let state = createGame({ seed })
  let steps = 0
  let terminated = false

  const scanStub = (s: GameState) => {
    for (; stubScanned < s.log.length; stubScanned++) {
      const m = s.log[stubScanned].match(/\[stub\] effect not implemented: (.+)$/)
      if (m) stub.add(m[1])
    }
  }
  const runInvariants = (s: GameState, step: number) => {
    try {
      const vs = checkInvariants(s)
      if (vs.length) failures.push({ type: 'invariant', step, phase: s.phase, violations: vs })
    } catch (e) {
      failures.push({
        type: 'invariant',
        step,
        phase: s.phase,
        violations: [{ kind: 'conservation', detail: (e as Error).message }],
      })
    }
  }

  try {
    for (; steps < stepCap; steps++) {
      if (state.result) {
        terminated = true
        break
      }
      if (state.pendingDecision) {
        const selection = autoSelect(state.pendingDecision, rng)
        trace.push({ step: steps, phase: state.phase, kind: 'decision', decision: state.pendingDecision, selection })
        state = resolveDecision(state, { selection })
      } else {
        const acts = legalActions(state)
        if (acts.length === 0) {
          // result is null, no decision pending, no legal move: the player is genuinely stuck.
          failures.push({ type: 'softlock', step: steps, phase: state.phase })
          break
        }
        const action = policy.choose(state, acts, rng)
        trace.push({ step: steps, phase: state.phase, kind: 'action', action })
        state = applyAction(state, action)
      }
      scanStub(state)
      runInvariants(state, steps)
    }
  } catch (e) {
    const err = e as Error
    failures.push({ type: 'crash', message: err.message, stack: err.stack, step: steps })
  }

  const crashed = failures.some((f) => f.type === 'crash')
  if (!terminated && !crashed && steps >= stepCap) {
    failures.push({ type: 'nontermination', stepCap })
  }

  const rr: RunResult = {
    seed,
    policy: policy.name,
    steps,
    rounds: state.round,
    finalPhase: state.phase,
    result: state.result,
    stubEffects: [...stub],
    failures,
  }
  if (failures.length > 0 || stub.size > 0) rr.trace = trace
  return rr
}
