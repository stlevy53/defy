// createGame: builds a legal initial GameState per the rulebook setup sequence.
import { maquis, missions, enemyTypes, civilians, spyCount } from '../data'
import { shuffle } from './rng'
import type { GameState, CardInstance, EnemyInstance, MissionSlot, Decision } from './types'

export const DRAFT_FROM = 'draft.pool'

export interface CreateGameOptions {
  seed: number
  /** Rulebook recommended variant: player splits each pair Hidden / Recruit, twelve times. */
  draft?: boolean
}

export function isDraftDecision(d: Decision | null | undefined): d is Extract<Decision, { kind: 'selectCards' }> {
  return !!d && d.kind === 'selectCards' && d.from === DRAFT_FROM
}

export function isDrafting(state: GameState): boolean {
  return (state.draftPool?.length ?? 0) > 0 || isDraftDecision(state.pendingDecision)
}

/**
 * Standard setup:
 *  - 24 Maquis shuffled, split 12 (Hidden) / 12 (Recruit)
 *  - 3 Spies shuffled into the Hidden deck; 3 kept aside (available for effects)
 *  - Missions sorted by era, shuffled; remove 4/3/3; 4 Era-1 become the available row,
 *    remaining Era-2 (top) + Era-3 (bottom) form the Mission deck
 *  - 32 Enemies shuffled; each available Mission dealt Enemies equal to its Garrison
 *  - 8 Civilians shuffled into the Civilian deck
 *  - Draw a starting hand of 5 from the Hidden deck
 *
 * Draft variant (`draft: true`): the 24 Maquis stay in `draftPool` and `pendingDecision` asks
 * which of the top 2 goes to Hidden (the other to Recruit). Spies and the starting hand wait
 * until the twelfth pick; missions/enemies/civilians are dealt immediately so the table is visible.
 */
export function createGame(options: CreateGameOptions): GameState {
  let rng = options.seed >>> 0

  const maquisInstances: CardInstance[] = maquis.map((m) => ({ uid: m.id, dataId: m.id }))
  const shuffledMaquis = shuffle(maquisInstances, rng)
  rng = shuffledMaquis.state

  let hidden: GameState['hidden']
  let recruit: GameState['recruit']
  let hand: CardInstance[]
  let spiesAvailable: number
  let draftPool: CardInstance[]
  let pendingDecision: Decision | null
  let log: string[]

  if (options.draft) {
    hidden = { deck: [], discard: [] }
    recruit = { deck: [], revealed: [] }
    hand = []
    spiesAvailable = spyCount
    draftPool = shuffledMaquis.result
    pendingDecision = null
    log = ['DRAFT: choose a Maquis for the Hidden deck; the other goes to Recruit']
  } else {
    const hiddenMaquis = shuffledMaquis.result.slice(0, 12)
    const recruitMaquis = shuffledMaquis.result.slice(12, 24)
    const spiesInDeck: CardInstance[] = Array.from({ length: 3 }, (_, i) => ({
      uid: `spy-${i}`,
      dataId: 'spy',
    }))
    const hiddenCombined = shuffle([...hiddenMaquis, ...spiesInDeck], rng)
    rng = hiddenCombined.state
    hidden = { deck: hiddenCombined.result.slice(5), discard: [] }
    recruit = { deck: recruitMaquis, revealed: [] }
    hand = hiddenCombined.result.slice(0, 5)
    spiesAvailable = spyCount - 3
    draftPool = []
    pendingDecision = null
    log = []
  }

  const table = dealTable(rng)
  rng = table.rng

  const state: GameState = {
    rng,
    phase: 'PLAN',
    round: 1,
    hidden,
    recruit,
    hand,
    inPlay: [],
    missionRow: table.missionRow,
    missionDeck: table.missionDeck,
    defeatedMissions: [],
    enemyDeck: table.enemyDeck,
    enemyDiscard: [],
    civilianDeck: table.civilianDeck,
    graveyard: [],
    spiesAvailable,
    removedFromGame: [],
    chosenMissionUid: null,
    attackStrength: 0,
    missionDefenseOverride: null,
    attackRevealLimit: null,
    revealedInAttack: 0,
    ignoreMissionEffect: false,
    recoverDrawModifier: 0,
    failedMissions: 0,
    pendingDecision,
    effectQueue: [],
    result: null,
    log,
    draftPool,
  }
  if (options.draft) raiseDraftPair(state)
  return state
}

/** Move the chosen card to Hidden, the leftover to Recruit, then raise the next pair (or finish). */
export function applyDraftPick(state: GameState, keepUid: string): void {
  const pool = state.draftPool ?? []
  const decision = state.pendingDecision
  if (!isDraftDecision(decision)) {
    throw new Error('applyDraftPick: no draft pair pending')
  }
  const otherUid = decision.candidates.find((u) => u !== keepUid)
  if (!otherUid) throw new Error('applyDraftPick: pair is missing the leftover')

  const take = (uid: string): CardInstance => {
    const i = pool.findIndex((c) => c.uid === uid)
    if (i === -1) throw new Error(`applyDraftPick: '${uid}' is not in the draft pool`)
    return pool.splice(i, 1)[0]
  }
  state.hidden.deck.push(take(keepUid))
  state.recruit.deck.push(take(otherUid))
  state.draftPool = pool
  const n = state.hidden.deck.length
  state.log.push(`DRAFT: ${keepUid} → Hidden, ${otherUid} → Recruit (${n}/12)`)
  raiseDraftPair(state)
}

function raiseDraftPair(state: GameState): void {
  const pool = state.draftPool ?? []
  if (pool.length < 2) {
    finalizeDraft(state)
    return
  }
  const pick = state.hidden.deck.length + 1
  state.pendingDecision = {
    kind: 'selectCards',
    from: DRAFT_FROM,
    min: 1,
    max: 1,
    prompt: `Choose which Maquis joins your Hidden deck (${pick} of 12). The other goes to Recruit.`,
    candidates: [pool[0].uid, pool[1].uid],
  }
}

function finalizeDraft(state: GameState): void {
  const hiddenShuf = shuffle(state.hidden.deck, state.rng)
  const recruitShuf = shuffle(state.recruit.deck, hiddenShuf.state)
  const spies: CardInstance[] = Array.from({ length: 3 }, (_, i) => ({
    uid: `spy-${i}`,
    dataId: 'spy',
  }))
  const withSpies = shuffle([...hiddenShuf.result, ...spies], recruitShuf.state)
  state.rng = withSpies.state
  state.hidden.deck = withSpies.result.slice(5)
  state.hand = withSpies.result.slice(0, 5)
  state.recruit.deck = recruitShuf.result
  state.spiesAvailable = spyCount - 3
  state.draftPool = []
  state.pendingDecision = null
  state.log.push('DRAFT: decks shuffled; 3 Spies mixed into Hidden; drew 5')
}

function dealTable(rng: number): {
  rng: number
  missionRow: MissionSlot[]
  missionDeck: CardInstance[]
  enemyDeck: EnemyInstance[]
  civilianDeck: CardInstance[]
} {
  const keepEra = (era: 1 | 2 | 3, remove: number): CardInstance[] => {
    const pool = missions
      .filter((m) => m.era === era)
      .map((m) => ({ uid: m.id, dataId: m.id }))
    const s = shuffle(pool, rng)
    rng = s.state
    return s.result.slice(remove)
  }
  const era1Available = keepEra(1, 4)
  const era2Kept = keepEra(2, 3)
  const era3Kept = keepEra(3, 3)
  const missionDeck = [...era2Kept, ...era3Kept]

  const enemyInstances: EnemyInstance[] = []
  for (const t of enemyTypes) {
    t.defenseValues.forEach((d, i) => {
      enemyInstances.push({ uid: `enemy-${t.id}-${i}`, typeId: t.id, defense: d, baseDefense: d, faceUp: false })
    })
  }
  const shuffledEnemies = shuffle(enemyInstances, rng)
  rng = shuffledEnemies.state
  let enemyPool = shuffledEnemies.result

  const missionRow: MissionSlot[] = era1Available.map((mi) => {
    const mission = missions.find((m) => m.id === mi.dataId)!
    const dealt = enemyPool.slice(0, mission.garrison)
    enemyPool = enemyPool.slice(mission.garrison)
    return { uid: mi.uid, dataId: mi.dataId, faceDown: false, defeated: false, enemies: dealt }
  })

  const civilianInstances: CardInstance[] = civilians.map((c) => ({ uid: c.id, dataId: c.id }))
  const shuffledCiv = shuffle(civilianInstances, rng)
  rng = shuffledCiv.state

  return {
    rng,
    missionRow,
    missionDeck,
    enemyDeck: enemyPool,
    civilianDeck: shuffledCiv.result,
  }
}
