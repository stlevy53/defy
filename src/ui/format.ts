// Presentation helpers: turn engine ids/actions into human-readable labels. Cards render from the
// /data JSON (text-first). No rules here — pure formatting over GameState.

import { maquis, missions, enemyTypes } from '../data'
import type { Action, EnemyInstance, GameState } from '../engine'

const maquisName = new Map(maquis.map((m) => [m.id, m.name]))
const maquisCard = new Map(maquis.map((m) => [m.id, m]))
const missionCard = new Map(missions.map((m) => [m.id, m]))
const enemyTypeById = new Map(enemyTypes.map((t) => [t.id, t]))

export const nameOfMaquis = (dataId: string): string =>
  dataId === 'spy' ? 'Spy' : maquisName.get(dataId) ?? dataId
export const missionOf = (dataId: string) => missionCard.get(dataId)
export const maquisOf = (dataId: string) => maquisCard.get(dataId)
export const enemyOf = (typeId: string) => enemyTypeById.get(typeId)

/** Base attack a Maquis contributes for a given side (for hand/board display). */
export function maquisAttack(dataId: string, side: 'hidden' | 'revealed'): number {
  return maquisCard.get(dataId)?.[side].attack ?? 0
}

function findEnemy(state: GameState, uid: string): EnemyInstance | undefined {
  for (const slot of state.missionRow) {
    const e = slot.enemies.find((x) => x.uid === uid)
    if (e) return e
  }
  return (
    state.enemyDeck.find((e) => e.uid === uid) ?? state.enemyDiscard.find((e) => e.uid === uid)
  )
}

function findCardDataId(state: GameState, uid: string): string | undefined {
  const zones = [
    ...state.hand,
    ...state.hidden.deck,
    ...state.hidden.discard,
    ...state.recruit.deck,
    ...state.recruit.revealed,
    ...state.defeatedMissions,
    ...state.removedFromGame,
    ...state.missionDeck,
    ...state.civilianDeck,
    ...state.graveyard,
  ]
  return zones.find((c) => c.uid === uid)?.dataId ?? state.inPlay.find((m) => m.uid === uid)?.dataId
}

/** Human label for a candidate uid appearing in a decision (enemy / mission / Maquis / Spy). */
export function describeUid(state: GameState, uid: string): string {
  const enemy = findEnemy(state, uid)
  if (enemy) return `${enemyTypeById.get(enemy.typeId)?.name ?? enemy.typeId} · Def ${enemy.defense}`
  const slot = state.missionRow.find((s) => s.uid === uid)
  if (slot) return missionCard.get(slot.dataId)?.name ?? slot.dataId
  const dataId = findCardDataId(state, uid) ?? uid
  return nameOfMaquis(dataId)
}

/** Button label for a legal action. */
export function actionLabel(state: GameState, action: Action): string {
  switch (action.type) {
    case 'PlayMaquis': {
      const name = nameOfMaquis(findCardDataId(state, action.uid) ?? action.uid)
      return `Play ${name} — ${action.side}`
    }
    case 'UseAction': {
      const name = nameOfMaquis(state.inPlay.find((m) => m.uid === action.uid)?.dataId ?? action.uid)
      return `Use ${name}'s action`
    }
    case 'ChooseMission': {
      const slot = state.missionRow.find((s) => s.uid === action.uid)
      return `Attack: ${slot ? missionCard.get(slot.dataId)?.name ?? slot.dataId : action.uid}`
    }
    case 'SpendAttackOn':
      return `Strike ${describeUid(state, action.targetUid)}`
    case 'AdvancePhase':
      return 'Done attacking →'
    case 'EndResistance':
      return 'End the resistance'
    case 'Continue':
      return 'Continue to next round'
  }
}

/** Short phase blurb for the header. */
export const phaseBlurb: Record<GameState['phase'], string> = {
  PLAN: 'Play Maquis, fire PLAN actions, then choose a Mission.',
  ATTACK: 'Play out your hand, fire ATTACK actions, then spend Attack Strength.',
  AFTERMATH: 'Outcome resolved. End the resistance, or press on.',
  RECOVER: 'Recovering…',
  GAME_OVER: 'The game is over.',
}
