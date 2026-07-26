// Presentation helpers: turn engine ids/actions into human-readable labels. Cards render from the
// /data JSON (text-first). No rules here — pure formatting over GameState.

import { maquis, missions, enemyTypes, civilians } from '../data'
import type { ActionType } from '../types'
import type { Action, EnemyInstance, GameState } from '../engine'

const maquisName = new Map(maquis.map((m) => [m.id, m.name]))
const maquisCard = new Map(maquis.map((m) => [m.id, m]))
const missionCard = new Map(missions.map((m) => [m.id, m]))
const enemyTypeById = new Map(enemyTypes.map((t) => [t.id, t]))
const civilianCount = new Map(civilians.map((c) => [c.id, c.civilians]))

/** Live Attack bonus a count-based ATTACK action would grant right now (it snapshots at use-time),
 *  or null if the card's action isn't count-based. Mirrors the engine handlers so the played card
 *  can show, e.g., Abel hidden's "+1 per revealed Maquis" as its current value. */
export function countActionBonus(
  state: GameState,
  dataId: string,
  side: 'hidden' | 'revealed',
  uid: string,
): number | null {
  switch (`${dataId}:${side}`) {
    case 'soledad:hidden':
    case 'abel:hidden':
      return state.inPlay.filter((m) => m.side === 'revealed').length
    case 'marcelino:revealed':
      return state.inPlay.filter((m) => m.uid !== uid).length
    case 'abel:revealed':
      return state.graveyard.reduce((n, c) => n + (civilianCount.get(c.dataId) ?? 0), 0)
    default:
      return null
  }
}

export const nameOfMaquis = (dataId: string): string =>
  dataId === 'spy' ? 'Spy' : maquisName.get(dataId) ?? dataId

/** Plain-language explanation of an effect keyword, for tooltips. */
export function keywordTip(kw?: string): string {
  switch (kw) {
    case 'DEFEND':
      return 'DEFEND — this effect resolves at the start of the Attack, when this Mission is chosen.'
    case 'DEFEAT':
      return 'DEFEAT — this effect resolves when this card is defeated.'
    case 'SURVIVE':
      return 'SURVIVE — this effect resolves at the end of the Attack if this Enemy is still standing.'
    default:
      return ''
  }
}
export const missionOf = (dataId: string) => missionCard.get(dataId)
export const maquisOf = (dataId: string) => maquisCard.get(dataId)
export const enemyOf = (typeId: string) => enemyTypeById.get(typeId)

/** Base attack a Maquis contributes for a given side (for hand/board display). */
export function maquisAttack(dataId: string, side: 'hidden' | 'revealed'): number {
  return maquisCard.get(dataId)?.[side].attack ?? 0
}

/** The action type + text for a Maquis side, or null when the side shows an X (no action). */
export function maquisSideAction(
  dataId: string,
  side: 'hidden' | 'revealed',
): { type: ActionType; text: string } | null {
  const s = maquisCard.get(dataId)?.[side]
  if (!s?.action || !s.actionType) return null
  return { type: s.actionType, text: s.action }
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

/** Whether a decision-candidate uid corresponds to a card the board draws as a clickable element —
 *  a face-up Enemy, a Mission slot, a played Maquis, or a hand card. Candidates without a board
 *  representation (deck peeks, the Revealed pile, face-down Enemies) fall back to the panel chips. */
export function boardPickable(state: GameState, uid: string): boolean {
  if (state.missionRow.some((s) => s.uid === uid)) return true
  if (state.inPlay.some((m) => m.uid === uid)) return true
  if (state.hand.some((c) => c.uid === uid)) return true
  for (const slot of state.missionRow) {
    const e = slot.enemies.find((x) => x.uid === uid)
    if (e) return e.faceUp
  }
  return false
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

/** Multi-line tooltip explaining a candidate card's attributes — so a decision chip that shows only
 *  a name still tells a new player what the card does. Newlines render via `white-space: pre-line`. */
export function describeUidTip(state: GameState, uid: string): string {
  const enemy = findEnemy(state, uid)
  if (enemy) {
    const t = enemyTypeById.get(enemy.typeId)
    return [`${t?.name ?? enemy.typeId} — Defense ${enemy.defense}${t?.keyword ? ` · ${t.keyword}` : ''}`, t?.effect]
      .filter(Boolean)
      .join('\n')
  }
  const slot = state.missionRow.find((s) => s.uid === uid)
  if (slot) {
    const m = missionCard.get(slot.dataId)
    return [
      `${m?.name ?? slot.dataId} — Defense ${m?.defense}, ${m?.victoryPoints} VP, Garrison ${m?.garrison}${m?.keyword ? ` · ${m.keyword}` : ''}`,
      m?.effect,
    ]
      .filter(Boolean)
      .join('\n')
  }
  const dataId = findCardDataId(state, uid) ?? uid
  if (dataId === 'spy') return 'Spy — cannot be played; clogs your hand until Recover.'
  const m = maquisCard.get(dataId)
  if (!m) return nameOfMaquis(dataId)
  const sideLine = (label: string, s: { attack: number; actionType: string | null; action: string | null }): string =>
    `${label} — Attack ${s.attack}; ${s.action ? `${s.actionType}: ${s.action}` : 'no action'}`
  return [m.name, sideLine('Hidden', m.hidden), sideLine('Revealed', m.revealed)].join('\n')
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
    case 'SpendAttackOn': {
      if (action.targetUid === state.chosenMissionUid) {
        const slot = state.missionRow.find((s) => s.uid === action.targetUid)
        const name = slot ? missionCard.get(slot.dataId)?.name ?? slot.dataId : action.targetUid
        return `Strike the Mission — ${name}`
      }
      return `Strike defender: ${describeUid(state, action.targetUid)}`
    }
    case 'AdvancePhase':
      return 'Done attacking →'
    case 'EndResistance':
      return 'End the resistance'
    case 'Continue': {
      // Surface a defeated Mission's Recover-draw effect (Cross the Border −1 / Valley +1) right on
      // the button that triggers the draw, so the player is warned at the point of decision.
      const delta = state.recoverDrawModifier
      if (delta === 0) return 'Continue to next round'
      const size = Math.max(0, 5 + delta)
      const sign = delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`
      return `Continue to next round · draw ${size} (${sign})`
    }
  }
}

/** The four phases of a round, in order — the steps shown in the breadcrumb. */
export const ROUND_PHASES = ['PLAN', 'ATTACK', 'AFTERMATH', 'RECOVER'] as const
export type RoundPhase = (typeof ROUND_PHASES)[number]

export interface GuideStep {
  text: string
  /** Highlighted as a step the player can act on right now; others render dimmed. */
  active?: boolean
}

/** Sub-step-aware guidance for the current moment: which round phase, the goal, the single most
 *  important instruction now, and the phase's steps with the current ones highlighted. */
export interface Guidance {
  phase: RoundPhase
  goal: string
  now: string
  steps: GuideStep[]
  auto?: boolean
}

const canDo = (actions: Action[], t: Action['type']): boolean => actions.some((a) => a.type === t)

/**
 * Derive new-player guidance from the current state + legal actions. Sub-steps are read off
 * `legalActions` rather than re-deriving rules — e.g. in ATTACK, `AdvancePhase` only becomes legal
 * once the mandatory play-out is complete, which distinguishes the play-out from the spend step.
 */
export function guidanceFor(state: GameState, actions: Action[]): Guidance | null {
  switch (state.phase) {
    case 'PLAN': {
      const played = state.inPlay.length > 0
      const canUseAction = canDo(actions, 'UseAction')
      return {
        phase: 'PLAN',
        goal: 'Set up your attack.',
        now: !played
          ? 'Play Maquis from your hand by clicking a side — Hidden (left) or Revealed (right).'
          : canUseAction
            ? "Use a card's action by clicking its highlighted action, or choose a Mission to attack."
            : 'Play or use more cards, or click a Mission to attack — choosing ends PLAN.',
        steps: [
          { text: 'Play Maquis — click the Hidden (left) or Revealed (right) side.', active: canDo(actions, 'PlayMaquis') },
          { text: 'Optionally use PLAN card actions — click the action on a played Maquis.', active: true },
          { text: 'Choose one Mission — click the Mission card to attack it. (Ends PLAN)', active: canDo(actions, 'ChooseMission') },
        ],
      }
    }
    case 'ATTACK': {
      // AdvancePhase ("Done attacking") only appears once every Maquis has been played out.
      if (!canDo(actions, 'AdvancePhase')) {
        return {
          phase: 'ATTACK',
          goal: 'Defeat the Mission and its Enemies.',
          now: 'Play out your whole hand first — every remaining Maquis must be played (Spies stay in hand).',
          steps: [
            { text: 'Play out the rest of your hand — mandatory.', active: true },
            { text: 'Fire ATTACK actions to raise Attack Strength or weaken Enemies.', active: true },
            { text: 'Spend Attack Strength on targets to defeat them.' },
          ],
        }
      }
      const canStrike = canDo(actions, 'SpendAttackOn')
      return {
        phase: 'ATTACK',
        goal: 'Defeat the Mission and its Enemies.',
        now: canStrike
          ? 'Click an Enemy or the Mission to strike it (cost = its Defense). Grunts fall first, Guards before the Mission — or click Done attacking.'
          : 'No target is affordable now — click Done attacking. (Leftover Attack Strength is lost.)',
        steps: [
          { text: 'Hand played out.' },
          { text: 'Fire any remaining ATTACK actions to boost your strike.', active: true },
          { text: 'Click targets on the board to strike them, then Done attacking.', active: true },
        ],
      }
    }
    case 'AFTERMATH': {
      const canContinue = canDo(actions, 'Continue')
      return {
        phase: 'AFTERMATH',
        goal: 'See the outcome, then decide.',
        now: canContinue
          ? 'End the resistance to score now, or Continue to the next round.'
          : 'No Missions remain — End the resistance to score your game.',
        steps: [
          { text: 'Mission outcome and civilian losses resolved automatically.' },
          { text: 'End the resistance to score, or Continue to another round.', active: true },
        ],
      }
    }
    case 'RECOVER':
      return {
        phase: 'RECOVER',
        goal: 'Reset for the next round.',
        auto: true,
        now: 'Cleaning up and drawing a fresh hand…',
        steps: [
          { text: 'Maquis in play are cleaned up.' },
          { text: 'Draw a fresh hand of 5 from the Hidden deck.' },
        ],
      }
    case 'GAME_OVER':
      return null
  }
}
