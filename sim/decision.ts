// Answers the engine's pendingDecision prompts during self-play. Trivial (no-real-choice)
// decisions are auto-resolved exactly as the real UI does (mirrors ui/useGame `forcedSelection`);
// genuine choices get a random *valid* answer — the same shape validateResponse (engine/actions.ts)
// requires, so a legal player can never crash the engine. An invalid answer would itself be a
// finding: it means this resolver and the engine disagree on what's legal.

import type { Decision } from '../src/engine'
import { pick, shuffleArr, type Rng } from './prng'

/** The only valid answer to a decision that offers no real choice, or null if a real choice. */
export function forcedSelection(d: Decision): string[] | null {
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

/** A valid selection for any decision: the forced answer if one exists, else a random legal one. */
export function autoSelect(d: Decision, rng: Rng): string[] {
  const forced = forcedSelection(d)
  if (forced !== null) return forced
  switch (d.kind) {
    case 'selectTarget':
      return [pick(rng, d.candidates)]
    case 'chooseOption':
      return [pick(rng, d.options)]
    case 'orderCards':
      return shuffleArr(rng, d.cards)
    case 'selectCards': {
      const hi = Math.min(d.max, d.candidates.length)
      const k = d.min + Math.floor(rng() * (hi - d.min + 1))
      return shuffleArr(rng, d.candidates).slice(0, k)
    }
  }
}
