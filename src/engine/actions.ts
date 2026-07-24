// applyAction / legalActions / resolveDecision + the effect-queue driver.
// This slice covers the PLAN phase: playing Maquis, using their (stubbed) card
// actions, and choosing a mission. ATTACK onward lands in the next slice.

import { produce, type Draft } from 'immer'
import { maquis as maquisData } from '../data'
import type { Action, Decision, DecisionResponse, GameState, Side } from './types'
import { effectRegistry, maquisEffectId } from './effects/registry'
import { canFireEffect } from './effects/plan'
import type { MaquisCard } from '../types'

const maquisById = new Map<string, MaquisCard>(maquisData.map((m) => [m.id, m]))

/** True if this side's card action may fire during the given phase. */
function actionFiresIn(actionType: string | null, phase: GameState['phase']): boolean {
  if (actionType === null) return false
  if (actionType === 'PLAN/ATTACK') return phase === 'PLAN' || phase === 'ATTACK'
  return actionType === phase
}

// --- legalActions -----------------------------------------------------------

/** Everything the player may do right now. The UI holds no rules — it renders this. */
export function legalActions(state: GameState): Action[] {
  if (state.result !== null) return []
  if (state.pendingDecision !== null) return [] // must resolveDecision first

  const actions: Action[] = []

  if (state.phase === 'PLAN' || state.phase === 'ATTACK') {
    // Play any Maquis from hand, hidden or revealed. Spies are never playable.
    // In ATTACK this is the mandatory play-out: every remaining Maquis must be played.
    for (const card of state.hand) {
      if (card.dataId === 'spy') continue
      actions.push({ type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
      actions.push({ type: 'PlayMaquis', uid: card.uid, side: 'revealed' })
    }
    // Fire an unused action matching the current phase on a Maquis already in play.
    // (PLAN/ATTACK actions fire in either phase; a card played in PLAN can still fire its
    // ATTACK-side action here.)
    for (const mip of state.inPlay) {
      if (mip.actionUsed) continue
      const side = maquisById.get(mip.dataId)?.[mip.side]
      if (
        side &&
        actionFiresIn(side.actionType, state.phase) &&
        canFireEffect(maquisEffectId(mip.dataId, mip.side), state)
      ) {
        actions.push({ type: 'UseAction', uid: mip.uid })
      }
    }
  }

  if (state.phase === 'PLAN') {
    // Choose an available (face-up) mission — this ends PLAN.
    for (const slot of state.missionRow) {
      if (!slot.faceDown) actions.push({ type: 'ChooseMission', uid: slot.uid })
    }
  }

  // ATTACK attack-resolution (SpendAttackOn) and the AFTERMATH/RECOVER transitions land in the
  // next ATTACK sub-slices. Mandatory play-out: while a playable Maquis remains in hand no
  // phase-advancing action is offered, so the only ATTACK moves are plays and card actions.
  return actions
}

// --- applyAction ------------------------------------------------------------

export function applyAction(state: GameState, action: Action): GameState {
  if (state.result !== null) throw new Error('game is over')
  if (state.pendingDecision !== null) {
    throw new Error('a decision is pending; call resolveDecision first')
  }

  return produce(state, (draft) => {
    switch (action.type) {
      case 'PlayMaquis':
        applyPlayMaquis(draft, action.uid, action.side)
        break
      case 'UseAction':
        applyUseAction(draft, action.uid)
        break
      case 'ChooseMission':
        applyChooseMission(draft, action.uid)
        break
      default:
        throw new Error(`action not implemented in this slice: ${action.type}`)
    }
    runEffectQueue(draft)
  })
}

function applyPlayMaquis(draft: Draft<GameState>, uid: string, side: Side): void {
  if (draft.phase !== 'PLAN' && draft.phase !== 'ATTACK') {
    throw new Error('PlayMaquis: only legal during PLAN or ATTACK')
  }
  const idx = draft.hand.findIndex((c) => c.uid === uid)
  if (idx === -1) throw new Error(`PlayMaquis: '${uid}' is not in hand`)
  const card = draft.hand[idx]
  if (card.dataId === 'spy') throw new Error('PlayMaquis: Spies are never playable')

  draft.hand.splice(idx, 1)
  draft.inPlay.push({ uid: card.uid, dataId: card.dataId, side, actionUsed: false })

  const name = maquisById.get(card.dataId)?.name ?? card.dataId
  draft.log.push(`${draft.phase}: played ${name} ${side}`)
}

function applyUseAction(draft: Draft<GameState>, uid: string): void {
  if (draft.phase !== 'PLAN' && draft.phase !== 'ATTACK') {
    throw new Error('UseAction: only legal during PLAN or ATTACK')
  }
  const mip = draft.inPlay.find((c) => c.uid === uid)
  if (!mip) throw new Error(`UseAction: '${uid}' is not in play`)
  if (mip.actionUsed) throw new Error(`UseAction: '${uid}' already used its action`)
  const side = maquisById.get(mip.dataId)?.[mip.side]
  if (!side || !actionFiresIn(side.actionType, draft.phase)) {
    throw new Error(`UseAction: '${uid}' has no usable action in ${draft.phase}`)
  }

  mip.actionUsed = true
  draft.effectQueue.push({ effectId: maquisEffectId(mip.dataId, mip.side), sourceUid: uid })

  const name = maquisById.get(mip.dataId)?.name ?? mip.dataId
  draft.log.push(`${draft.phase}: used ${name}'s ${side.actionType} action`)
}

function applyChooseMission(draft: Draft<GameState>, uid: string): void {
  if (draft.phase !== 'PLAN') throw new Error('ChooseMission: only legal during PLAN')
  const slot = draft.missionRow.find((s) => s.uid === uid)
  if (!slot) throw new Error(`ChooseMission: '${uid}' is not an available mission`)
  if (slot.faceDown) throw new Error(`ChooseMission: '${uid}' is failed (face-down)`)

  draft.chosenMissionUid = uid
  for (const enemy of slot.enemies) enemy.faceUp = true

  // ChooseMission ends PLAN. No action is allowed between choosing the mission and
  // DEFEND resolution (see ENGINE_DESIGN §4) — "when chosen" mission effects (Bunker,
  // Crossroads) will queue here in the effects slice.
  draft.phase = 'ATTACK'
  draft.log.push(`PLAN: chose mission ${slot.dataId}; revealed ${slot.enemies.length} enemies; -> ATTACK`)
}

// --- Effect-queue driver ----------------------------------------------------

/**
 * Pops and runs queued effect tasks until the queue is empty or a task suspends
 * by returning a Decision. The suspended task stays at the head of the queue;
 * resolveDecision appends the player's response to its args and re-enters here.
 * Unregistered effects (not yet implemented) are skipped with a "[stub]" log line.
 */
function runEffectQueue(draft: Draft<GameState>): void {
  while (draft.effectQueue.length > 0 && draft.pendingDecision === null) {
    const task = draft.effectQueue[0]
    const handler = effectRegistry[task.effectId]

    if (!handler) {
      draft.log.push(`[stub] effect not implemented: ${task.effectId}`)
      draft.effectQueue.shift()
      continue
    }

    const responses = (task.args?.responses as string[][] | undefined) ?? []
    const decision = handler({
      state: draft,
      sourceUid: task.sourceUid,
      args: task.args ?? {},
      responses,
    })

    if (decision) {
      draft.pendingDecision = decision // task stays queued; we resume via resolveDecision
    } else {
      draft.effectQueue.shift()
    }
  }
}

// --- resolveDecision --------------------------------------------------------

function validateResponse(decision: Decision, selection: string[]): void {
  switch (decision.kind) {
    case 'selectCards': {
      if (selection.length < decision.min || selection.length > decision.max) {
        throw new Error(
          `resolveDecision: expected between ${decision.min} and ${decision.max} cards, got ${selection.length}`,
        )
      }
      for (const uid of selection) {
        if (!decision.candidates.includes(uid)) {
          throw new Error(`resolveDecision: '${uid}' is not a candidate`)
        }
      }
      break
    }
    case 'selectTarget': {
      if (selection.length !== 1 || !decision.candidates.includes(selection[0])) {
        throw new Error('resolveDecision: must select exactly one candidate target')
      }
      break
    }
    case 'chooseOption': {
      if (selection.length !== 1 || !decision.options.includes(selection[0])) {
        throw new Error('resolveDecision: must choose exactly one option')
      }
      break
    }
    case 'orderCards': {
      const sorted = [...selection].sort()
      const expected = [...decision.cards].sort()
      if (
        sorted.length !== expected.length ||
        sorted.some((uid, i) => uid !== expected[i])
      ) {
        throw new Error('resolveDecision: ordering must be a permutation of the listed cards')
      }
      break
    }
  }
}

export function resolveDecision(state: GameState, response: DecisionResponse): GameState {
  if (state.result !== null) throw new Error('game is over')
  if (state.pendingDecision === null) throw new Error('no pending decision')
  validateResponse(state.pendingDecision, response.selection)

  return produce(state, (draft) => {
    const task = draft.effectQueue[0]
    draft.pendingDecision = null
    if (!task) return // defensive: a decision with no owning task

    if (!task.args) task.args = {}
    const responses = (task.args.responses as string[][] | undefined) ?? []
    responses.push(response.selection)
    task.args.responses = responses

    runEffectQueue(draft)
  })
}
