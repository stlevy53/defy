// createGame: builds a legal initial GameState per the rulebook setup sequence.
import { maquis, missions, enemyTypes, civilians, spyCount } from '../data'
import { shuffle } from './rng'
import type { GameState, CardInstance, EnemyInstance, MissionSlot } from './types'

export interface CreateGameOptions {
  seed: number
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
 */
export function createGame(options: CreateGameOptions): GameState {
  let rng = options.seed >>> 0

  // --- Maquis ---
  const maquisInstances: CardInstance[] = maquis.map((m) => ({ uid: m.id, dataId: m.id }))
  const shuffledMaquis = shuffle(maquisInstances, rng)
  rng = shuffledMaquis.state
  const hiddenMaquis = shuffledMaquis.result.slice(0, 12)
  const recruitMaquis = shuffledMaquis.result.slice(12, 24)

  // --- Spies ---
  const spyInstances: CardInstance[] = Array.from({ length: spyCount }, (_, i) => ({
    uid: `spy-${i}`,
    dataId: 'spy',
  }))
  const spiesInDeck = spyInstances.slice(0, 3)
  const spiesAvailable = spyCount - 3

  // Hidden deck = 12 Maquis + 3 Spies, shuffled together
  const hiddenCombined = shuffle([...hiddenMaquis, ...spiesInDeck], rng)
  rng = hiddenCombined.state
  let hiddenDeck = hiddenCombined.result

  // Starting hand of 5
  const hand = hiddenDeck.slice(0, 5)
  hiddenDeck = hiddenDeck.slice(5)

  // --- Missions ---
  const keepEra = (era: 1 | 2 | 3, remove: number): CardInstance[] => {
    const pool = missions
      .filter((m) => m.era === era)
      .map((m) => ({ uid: m.id, dataId: m.id }))
    const s = shuffle(pool, rng)
    rng = s.state
    return s.result.slice(remove) // discard the first `remove` from the game
  }
  const era1Available = keepEra(1, 4) // 4 remain -> available row
  const era2Kept = keepEra(2, 3) // 3
  const era3Kept = keepEra(3, 3) // 3
  const missionDeck = [...era2Kept, ...era3Kept] // Era-2 on top

  // --- Enemies ---
  const enemyInstances: EnemyInstance[] = []
  for (const t of enemyTypes) {
    t.defenseValues.forEach((d, i) => {
      enemyInstances.push({ uid: `enemy-${t.id}-${i}`, typeId: t.id, defense: d, faceUp: false })
    })
  }
  const shuffledEnemies = shuffle(enemyInstances, rng)
  rng = shuffledEnemies.state
  let enemyPool = shuffledEnemies.result

  const missionRow: MissionSlot[] = era1Available.map((mi) => {
    const mission = missions.find((m) => m.id === mi.dataId)!
    const dealt = enemyPool.slice(0, mission.garrison)
    enemyPool = enemyPool.slice(mission.garrison)
    return { uid: mi.uid, dataId: mi.dataId, faceDown: false, enemies: dealt }
  })
  const enemyDeck = enemyPool

  // --- Civilians ---
  const civilianInstances: CardInstance[] = civilians.map((c) => ({ uid: c.id, dataId: c.id }))
  const shuffledCiv = shuffle(civilianInstances, rng)
  rng = shuffledCiv.state
  const civilianDeck = shuffledCiv.result

  return {
    rng,
    phase: 'PLAN',
    round: 1,
    hidden: { deck: hiddenDeck, discard: [] },
    recruit: { deck: recruitMaquis, revealed: [] },
    hand,
    inPlay: [],
    missionRow,
    missionDeck,
    defeatedMissions: [],
    enemyDeck,
    enemyDiscard: [],
    civilianDeck,
    graveyard: [],
    spiesAvailable,
    removedFromGame: [],
    chosenMissionUid: null,
    recoverDrawModifier: 0,
    failedMissions: 0,
    pendingDecision: null,
    effectQueue: [],
    result: null,
    log: [],
  }
}
