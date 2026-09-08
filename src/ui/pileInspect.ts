// Face-up piles are public (rulebook: Hidden discard, Revealed, Enemy discard, Defeated,
// Graveyard are all placed face-up). Face-down decks are not. Helpers stay UI-only.

import type { GameState } from '../engine'

export type PileId =
  | 'hidden.deck'
  | 'hidden.discard'
  | 'recruit.deck'
  | 'recruit.revealed'
  | 'enemy.deck'
  | 'enemy.discard'
  | 'mission.deck'
  | 'defeated'
  | 'graveyard'
  | 'spy.supply'
  | 'removed'

export type PileTone = 'hidden' | 'revealed' | 'enemy' | 'mission' | 'civ' | 'spy' | 'removed'

export interface PileView {
  id: PileId
  label: string
  n: number
  tone: PileTone
  hint: string
  flightKey?: string
  /** Face-up: click opens the inspector. Face-down: click explains why not. */
  inspect: boolean
  inline: boolean
  /** Spies currently sitting in Hidden discard — shown as a badge on that chip. */
  spyCount?: number
}

const INLINE: ReadonlySet<PileId> = new Set(['hidden.deck', 'hidden.discard', 'enemy.deck', 'mission.deck', 'graveyard'])

export function facedownClickMessage(label: string): string {
  return `The ${label} is face-down. You see those cards when they are dealt or drawn, or when an action lets you look.`
}

export function hiddenDiscardSpyCount(state: GameState): number {
  return state.hidden.discard.filter((c) => c.dataId === 'spy').length
}

/** Newest on top — arrays are push-on-end, so reverse for the inspector. */
function newestFirst<T>(arr: readonly T[]): T[] {
  return [...arr].reverse()
}

export function inspectUids(state: GameState, id: PileId): string[] {
  switch (id) {
    case 'hidden.discard':
      return newestFirst(state.hidden.discard).map((c) => c.uid)
    case 'recruit.revealed':
      return newestFirst(state.recruit.revealed).map((c) => c.uid)
    case 'enemy.discard':
      return newestFirst(state.enemyDiscard).map((e) => e.uid)
    case 'defeated':
      return newestFirst(state.defeatedMissions).map((c) => c.uid)
    case 'graveyard':
      return newestFirst(state.graveyard).map((c) => c.uid)
    case 'removed':
      return newestFirst(state.removedFromGame).map((c) => c.uid)
    default:
      return []
  }
}

export function spySupplyCount(state: GameState): number {
  return state.spiesAvailable
}

export function pileViews(state: GameState): PileView[] {
  const hiddenSpies = hiddenDiscardSpyCount(state)
  const rows: PileView[] = [
    {
      id: 'hidden.deck',
      label: 'Hidden deck',
      n: state.hidden.deck.length,
      tone: 'hidden',
      flightKey: 'hidden.deck',
      inspect: false,
      inline: INLINE.has('hidden.deck'),
      hint: 'Face-down Hidden Maquis (and shuffled Spies) you draw your hand from. Click to see why you can’t look through.',
    },
    {
      id: 'hidden.discard',
      label: 'Hidden discard',
      n: state.hidden.discard.length,
      tone: 'hidden',
      flightKey: 'hidden.discard',
      inspect: true,
      inline: INLINE.has('hidden.discard'),
      spyCount: hiddenSpies,
      hint: 'Face-up. Played hidden Maquis + discarded Spies; reshuffled into the Hidden deck when it runs out. Click to look through.',
    },
    {
      id: 'recruit.deck',
      label: 'Recruit deck',
      n: state.recruit.deck.length,
      tone: 'revealed',
      flightKey: 'recruit.deck',
      inspect: false,
      inline: INLINE.has('recruit.deck'),
      hint: 'Face-down inactive Maquis — only recovered by specific effects. Click to see why you can’t look through.',
    },
    {
      id: 'recruit.revealed',
      label: 'Revealed pile',
      n: state.recruit.revealed.length,
      tone: 'revealed',
      flightKey: 'recruit.revealed',
      inspect: true,
      inline: INLINE.has('recruit.revealed'),
      hint: 'Face-up. Maquis played revealed this game — set aside, out of the decks. Click to look through.',
    },
    {
      id: 'enemy.deck',
      label: 'Enemy deck',
      n: state.enemyDeck.length,
      tone: 'enemy',
      inspect: false,
      inline: INLINE.has('enemy.deck'),
      hint: 'Face-down Enemies dealt to refilled Missions by their Garrison. Click to see why you can’t look through.',
    },
    {
      id: 'enemy.discard',
      label: 'Enemy discard',
      n: state.enemyDiscard.length,
      tone: 'enemy',
      inspect: true,
      inline: INLINE.has('enemy.discard'),
      hint: 'Face-up. Defeated/discarded Enemies; reshuffled into the Enemy deck when it runs out. Click to look through.',
    },
    {
      id: 'mission.deck',
      label: 'Mission deck',
      n: state.missionDeck.length,
      tone: 'mission',
      inspect: false,
      inline: INLINE.has('mission.deck'),
      hint: 'Face-down Era-2 then Era-3 Missions that refill the row as you defeat Missions. Click to see why you can’t look through.',
    },
    {
      id: 'defeated',
      label: 'Defeated',
      n: state.defeatedMissions.length,
      tone: 'mission',
      inspect: true,
      inline: INLINE.has('defeated'),
      hint: 'Face-up. Missions you have defeated — these score their Victory Points. Click to look through.',
    },
    {
      id: 'graveyard',
      label: 'Graveyard',
      n: state.graveyard.length,
      tone: 'civ',
      inspect: true,
      inline: INLINE.has('graveyard'),
      hint: 'Face-up. Lost Civilians. Reach 5 civilians here and the resistance is crushed. Click to look through.',
    },
    {
      id: 'spy.supply',
      label: 'Spy supply',
      n: state.spiesAvailable,
      tone: 'spy',
      inspect: true,
      inline: INLINE.has('spy.supply'),
      hint: 'Face-up. Spies available to be added to your Hidden deck by enemy effects. Click to look through.',
    },
    {
      id: 'removed',
      label: 'Removed',
      n: state.removedFromGame.length,
      tone: 'removed',
      flightKey: 'removed',
      inspect: true,
      inline: INLINE.has('removed'),
      hint: 'Face-up. Cards removed from the game entirely (back in the box). Click to look through.',
    },
  ]
  return rows
}

export function pileById(state: GameState, id: PileId): PileView | undefined {
  return pileViews(state).find((p) => p.id === id)
}
