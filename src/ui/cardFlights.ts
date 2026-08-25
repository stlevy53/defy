// Pure hand ↔ pile flight detection. The hook in useGame.ts measures DOM positions and plays the
// tokens; this module only answers "which cards moved where?" so the Celia/Antonio dump (and the
// empty-pool short-draw) can be tested without a layout.

import type { GameState } from '../engine'

/** Card zones that can exchange cards with the hand and have a pile-rail tile to fly to/from. */
export const FLIGHT_ZONES: { key: string; get: (s: GameState) => { uid: string }[] }[] = [
  { key: 'hidden.deck', get: (s) => s.hidden.deck },
  { key: 'hidden.discard', get: (s) => s.hidden.discard },
  { key: 'recruit.deck', get: (s) => s.recruit.deck },
  { key: 'recruit.revealed', get: (s) => s.recruit.revealed },
  { key: 'removed', get: (s) => s.removedFromGame },
]

export function zoneOfUid(s: GameState, uid: string): string | null {
  for (const z of FLIGHT_ZONES) if (z.get(s).some((c) => c.uid === uid)) return z.key
  return null
}

export interface HandFlightMove {
  uid: string
  dataId: string
  dir: 'out' | 'in'
  zone: string
}

/** Cards that left or entered the hand between two committed states, and which pile they moved to/from. */
export function handFlightMoves(before: GameState, after: GameState): HandFlightMove[] {
  const beforeHand = new Map(before.hand.map((c) => [c.uid, c.dataId]))
  const afterHand = new Map(after.hand.map((c) => [c.uid, c.dataId]))
  const moves: HandFlightMove[] = []
  for (const [uid, dataId] of beforeHand) {
    if (afterHand.has(uid)) continue
    const zone = zoneOfUid(after, uid)
    if (zone) moves.push({ uid, dataId, dir: 'out', zone })
  }
  for (const [uid, dataId] of afterHand) {
    if (beforeHand.has(uid)) continue
    const zone = zoneOfUid(before, uid)
    if (zone) moves.push({ uid, dataId, dir: 'in', zone })
  }
  return moves
}
