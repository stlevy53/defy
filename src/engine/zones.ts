// Zone accounting + the card-conservation invariant.
// Every card instance created at setup must live in exactly one zone at all times.
// Tests call assertConservation after every action.

import type { GameState } from './types'

export interface CardCounts {
  maquis: number
  spies: number // includes the set-aside supply (spiesAvailable)
  enemies: number
  civilians: number
  missions: number
}

/** Tally every card family across all zones. */
export function countCards(state: GameState): CardCounts {
  const removed = state.removedFromGame ?? []
  const personCards = [
    ...state.hand,
    ...state.hidden.deck,
    ...state.hidden.discard,
    ...state.recruit.deck,
    ...state.recruit.revealed,
    ...(state.draftPool ?? []),
    ...removed,
  ]
  const spiesInZones = personCards.filter((c) => c.dataId === 'spy').length
  const maquisInZones = personCards.length - spiesInZones + state.inPlay.length

  const enemiesInGarrisons = state.missionRow.reduce((n, slot) => n + slot.enemies.length, 0)

  return {
    maquis: maquisInZones,
    spies: spiesInZones + state.spiesAvailable,
    enemies: state.enemyDeck.length + state.enemyDiscard.length + enemiesInGarrisons,
    civilians: state.civilianDeck.length + state.graveyard.length,
    missions: state.missionRow.length + state.missionDeck.length + state.defeatedMissions.length,
  }
}

const EXPECTED: CardCounts = { maquis: 24, spies: 6, enemies: 32, civilians: 8, missions: 10 }

/** Throws if any card family's total is off, or if any uid appears in two zones. */
export function assertConservation(state: GameState): void {
  const counts = countCards(state)
  for (const key of Object.keys(EXPECTED) as (keyof CardCounts)[]) {
    if (counts[key] !== EXPECTED[key]) {
      throw new Error(`conservation violated: ${key} = ${counts[key]}, expected ${EXPECTED[key]}`)
    }
  }

  const uids: string[] = [
    ...state.hand.map((c) => c.uid),
    ...state.hidden.deck.map((c) => c.uid),
    ...state.hidden.discard.map((c) => c.uid),
    ...state.recruit.deck.map((c) => c.uid),
    ...state.recruit.revealed.map((c) => c.uid),
    ...(state.draftPool ?? []).map((c) => c.uid),
    ...(state.removedFromGame ?? []).map((c) => c.uid),
    ...state.inPlay.map((c) => c.uid),
    ...state.missionRow.map((s) => s.uid),
    ...state.missionDeck.map((c) => c.uid),
    ...state.defeatedMissions.map((c) => c.uid),
    ...state.enemyDeck.map((e) => e.uid),
    ...state.enemyDiscard.map((e) => e.uid),
    ...state.missionRow.flatMap((s) => s.enemies.map((e) => e.uid)),
    ...state.civilianDeck.map((c) => c.uid),
    ...state.graveyard.map((c) => c.uid),
  ]
  const seen = new Set<string>()
  for (const uid of uids) {
    if (seen.has(uid)) throw new Error(`conservation violated: uid '${uid}' present in two zones`)
    seen.add(uid)
  }
}
