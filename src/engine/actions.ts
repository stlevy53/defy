// applyAction / legalActions / resolveDecision + the effect-queue driver.
// Covers PLAN (play Maquis, card actions, choose mission) and ATTACK (mandatory play-out,
// attack resolution: DEFEND queue, Attack Strength, SpendAttackOn, DEFEAT/SURVIVE, advance).
// Mission/enemy effect handlers are still `[stub]` (sub-slice 3); the resolution *framework*
// queues them at the right trigger points.

import { produce, type Draft } from 'immer'
import { maquis as maquisData, missions as missionsData, civilians as civiliansData } from '../data'
import { shuffle } from './rng'
import type { Action, Decision, DecisionResponse, GameState, MissionSlot } from './types'
import type { Side } from './types'
import { effectRegistry, maquisEffectId, missionEffectId, enemyEffectId } from './effects/registry'
import { canFireEffect } from './effects/preconditions'
import { drawHidden } from './effects/plan'
import type { MaquisCard, MissionCard } from '../types'

const maquisById = new Map<string, MaquisCard>(maquisData.map((m) => [m.id, m]))
const missionById = new Map<string, MissionCard>(missionsData.map((m) => [m.id, m]))
const civiliansById = new Map<string, number>(civiliansData.map((c) => [c.id, c.civilians]))

/** True if this side's card action may fire during the given phase. */
function actionFiresIn(actionType: string | null, phase: GameState['phase']): boolean {
  if (actionType === null) return false
  if (actionType === 'PLAN/ATTACK') return phase === 'PLAN' || phase === 'ATTACK'
  return actionType === phase
}

/** The mandatory play-out is complete once no playable (non-Spy) Maquis remain in hand. */
function playoutComplete(state: GameState): boolean {
  return !state.hand.some((c) => c.dataId !== 'spy')
}

/** The chosen Mission's slot, or undefined if none is chosen / it has left the row. */
function chosenSlot(state: GameState): MissionSlot | undefined {
  if (state.chosenMissionUid === null) return undefined
  return state.missionRow.find((s) => s.uid === state.chosenMissionUid)
}

/** Current Defense of a target (Mission or Enemy). Enemy/mission defense mutations from DEFEND
 *  and ATTACK-action effects are applied in trigger order (DEFEND at ATTACK start, then actions),
 *  so the FAQ ordering (Engineer +1 before Benigno −1) falls out of execution order and this
 *  function just reads the current value. */
function effectiveDefense(state: GameState, slot: MissionSlot, targetUid: string): number | null {
  if (targetUid === slot.uid) {
    return state.missionDefenseOverride ?? missionById.get(slot.dataId)?.defense ?? null
  }
  const enemy = slot.enemies.find((e) => e.uid === targetUid)
  return enemy ? enemy.defense : null
}

/**
 * Enemy DEFEND ordering constraints (Guard/Grunt), enforced structurally rather than as queued
 * effects: Grunts must be defeated before any other Enemy; Guards must be defeated before the
 * Mission. Returns whether `targetUid` may be attacked right now given who's still standing.
 */
function isTargetLegal(slot: MissionSlot, targetUid: string): boolean {
  const gruntsRemain = slot.enemies.some((e) => e.typeId === 'grunt')
  const guardsRemain = slot.enemies.some((e) => e.typeId === 'guard')
  if (targetUid === slot.uid) return !guardsRemain // Guards gate the Mission
  const enemy = slot.enemies.find((e) => e.uid === targetUid)
  if (!enemy) return false
  if (enemy.typeId === 'grunt') return true // Grunts are always attackable
  return !gruntsRemain // other Enemies wait until every Grunt is gone
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
    const revealBlocked =
      state.phase === 'ATTACK' &&
      state.attackRevealLimit !== null &&
      state.revealedInAttack >= state.attackRevealLimit
    for (const card of state.hand) {
      if (card.dataId === 'spy') continue
      actions.push({ type: 'PlayMaquis', uid: card.uid, side: 'hidden' })
      if (!revealBlocked) actions.push({ type: 'PlayMaquis', uid: card.uid, side: 'revealed' })
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

  if (state.phase === 'ATTACK' && playoutComplete(state)) {
    // Attack resolution (step 2C): spend Attack Strength on affordable targets, or advance.
    const slot = chosenSlot(state)
    if (slot) {
      if (!slot.defeated) {
        const def = effectiveDefense(state, slot, slot.uid)
        if (def !== null && state.attackStrength >= def && isTargetLegal(slot, slot.uid)) {
          actions.push({ type: 'SpendAttackOn', targetUid: slot.uid })
        }
      }
      for (const enemy of slot.enemies) {
        if (state.attackStrength >= enemy.defense && isTargetLegal(slot, enemy.uid)) {
          actions.push({ type: 'SpendAttackOn', targetUid: enemy.uid })
        }
      }
    }
    // You may always stop attacking and move on (excess Attack Strength is lost).
    actions.push({ type: 'AdvancePhase' })
  }

  if (state.phase === 'AFTERMATH') {
    // AFTERMATH's automatic steps (civilian loss, mission outcome) have already resolved on entry.
    // The remaining choice is whether to end the resistance or press on.
    actions.push({ type: 'EndResistance' })
    if (state.missionRow.some((s) => !s.faceDown)) actions.push({ type: 'Continue' })
  }

  // RECOVER is resolved automatically inside Continue; GAME_OVER offers nothing.
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
      case 'SpendAttackOn':
        applySpendAttackOn(draft, action.targetUid)
        break
      case 'AdvancePhase':
        applyAdvancePhase(draft)
        break
      case 'EndResistance':
        applyEndResistance(draft)
        break
      case 'Continue':
        applyContinue(draft)
        break
      default: {
        const _exhaustive: never = action
        throw new Error(`unknown action: ${JSON.stringify(_exhaustive)}`)
      }
    }
    runEffectQueue(draft)
    settleAutomaticPhases(draft)
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
  if (
    side === 'revealed' &&
    draft.phase === 'ATTACK' &&
    draft.attackRevealLimit !== null &&
    draft.revealedInAttack >= draft.attackRevealLimit
  ) {
    throw new Error('PlayMaquis: this Mission limits revealing Maquis during ATTACK')
  }

  draft.hand.splice(idx, 1)
  draft.inPlay.push({ uid: card.uid, dataId: card.dataId, side, actionUsed: false })
  if (side === 'revealed' && draft.phase === 'ATTACK') draft.revealedInAttack += 1

  // Bank this Maquis's base Attack value (revealed or hidden). Action bonuses are added by
  // ATTACK-action effects when used (sub-slice 3); SpendAttackOn draws it down.
  draft.attackStrength += maquisById.get(card.dataId)?.[side].attack ?? 0

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
  draft.missionDefenseOverride = null
  draft.attackRevealLimit = null
  draft.revealedInAttack = 0
  for (const enemy of slot.enemies) enemy.faceUp = true

  // ChooseMission ends PLAN and enters ATTACK. No player action is allowed between choosing the
  // mission and DEFEND resolution (ENGINE_DESIGN §4), so queue the DEFEND triggers now: the
  // Mission's own effect and each garrison Enemy's. Handlers are still `[stub]` (sub-slice 3).
  draft.phase = 'ATTACK'
  draft.effectQueue.push({
    effectId: missionEffectId(slot.dataId),
    sourceUid: slot.uid,
    args: { trigger: 'DEFEND' },
  })
  for (const enemy of slot.enemies) {
    draft.effectQueue.push({
      effectId: enemyEffectId(enemy.typeId),
      sourceUid: enemy.uid,
      args: { trigger: 'DEFEND' },
    })
  }
  draft.log.push(`PLAN: chose mission ${slot.dataId}; revealed ${slot.enemies.length} enemies; -> ATTACK`)
}

function applySpendAttackOn(draft: Draft<GameState>, targetUid: string): void {
  if (draft.phase !== 'ATTACK') throw new Error('SpendAttackOn: only legal during ATTACK')
  if (!playoutComplete(draft)) {
    throw new Error('SpendAttackOn: play out every Maquis before attacking')
  }
  const slot = chosenSlot(draft)
  if (!slot) throw new Error('SpendAttackOn: no chosen mission')

  const def = effectiveDefense(draft, slot, targetUid)
  if (def === null) throw new Error(`SpendAttackOn: '${targetUid}' is not a valid target`)
  if (targetUid === slot.uid && slot.defeated) {
    throw new Error('SpendAttackOn: the mission is already defeated')
  }
  if (draft.attackStrength < def) {
    throw new Error(`SpendAttackOn: not enough Attack Strength (have ${draft.attackStrength}, need ${def})`)
  }
  if (!isTargetLegal(slot, targetUid)) {
    throw new Error('SpendAttackOn: blocked — defeat all Grunts before other Enemies, and all Guards before the Mission')
  }

  draft.attackStrength -= def

  if (targetUid === slot.uid) {
    // Defeat the Mission target. The card stays in its slot (flagged) until AFTERMATH moves it
    // to the Defeated Missions pile and refills the row.
    slot.defeated = true
    draft.effectQueue.push({
      effectId: missionEffectId(slot.dataId),
      sourceUid: slot.uid,
      args: { trigger: 'DEFEAT' },
    })
    draft.log.push(`ATTACK: defeated mission ${slot.dataId} (-${def} strength)`)
  } else {
    // Defeat an Enemy target: resolve its DEFEAT effect, then discard it.
    const eIdx = slot.enemies.findIndex((e) => e.uid === targetUid)
    const enemy = slot.enemies[eIdx]
    draft.effectQueue.push({
      effectId: enemyEffectId(enemy.typeId),
      sourceUid: enemy.uid,
      args: { trigger: 'DEFEAT' },
    })
    draft.enemyDiscard.push(slot.enemies.splice(eIdx, 1)[0])
    draft.log.push(`ATTACK: defeated enemy ${enemy.typeId} (-${def} strength)`)
  }
}

function applyAdvancePhase(draft: Draft<GameState>): void {
  if (draft.phase !== 'ATTACK') {
    throw new Error('AdvancePhase: only the ATTACK -> AFTERMATH transition is implemented')
  }
  if (!playoutComplete(draft)) {
    throw new Error('AdvancePhase: play out every Maquis before advancing')
  }
  const slot = chosenSlot(draft)
  if (slot) {
    // Undefeated Enemies resolve SURVIVE, then move to the Enemy discard pile.
    for (const enemy of slot.enemies) {
      draft.effectQueue.push({
        effectId: enemyEffectId(enemy.typeId),
        sourceUid: enemy.uid,
        args: { trigger: 'SURVIVE' },
      })
    }
    draft.enemyDiscard.push(...slot.enemies)
    slot.enemies = []
  }
  draft.phase = 'AFTERMATH'
  draft.log.push('ATTACK: resolved undefeated enemies; -> AFTERMATH')
}

// --- AFTERMATH & RECOVER ----------------------------------------------------

/** Total civilians in the Graveyard (sum of each card's civilian count). */
function civilianTotal(draft: Draft<GameState>): number {
  return draft.graveyard.reduce((n, c) => n + (civiliansById.get(c.dataId) ?? 0), 0)
}

/** Reshuffle the Enemy discard into a fresh Enemy deck when the deck is empty. */
function refillEnemyDeckIfEmpty(draft: Draft<GameState>): void {
  if (draft.enemyDeck.length === 0 && draft.enemyDiscard.length > 0) {
    // Restore printed Defense: any in-round modifier (Benigno/Engineer/Mayor's House) is dropped
    // when the enemy reshuffles back into the deck.
    const plain = draft.enemyDiscard.map((e) => ({ uid: e.uid, typeId: e.typeId, defense: e.baseDefense, baseDefense: e.baseDefense, faceUp: false }))
    const s = shuffle(plain, draft.rng)
    draft.rng = s.state
    draft.enemyDiscard.length = 0
    draft.enemyDeck.push(...s.result)
  }
}

/**
 * Runs automatic phase work once the effect queue has drained. Currently: the AFTERMATH steps
 * (civilian-loss check + mission outcome), which never suspend, so they resolve immediately when
 * the phase becomes AFTERMATH. The only remaining AFTERMATH choice (End vs Continue) is a player
 * action, so this leaves the phase in AFTERMATH afterwards — and the next action moves out of it,
 * so this runs exactly once per round.
 */
function settleAutomaticPhases(draft: Draft<GameState>): void {
  if (draft.result !== null || draft.pendingDecision !== null) return
  if (draft.phase === 'AFTERMATH') resolveAftermath(draft)
}

function resolveAftermath(draft: Draft<GameState>): void {
  // A) Civilian loss.
  if (civilianTotal(draft) >= 5) {
    draft.result = { outcome: 'loss', reason: 'civilians' }
    draft.phase = 'GAME_OVER'
    draft.log.push('AFTERMATH: 5+ civilians lost — the resistance is crushed')
    return
  }

  // B) Mission outcome for the chosen slot.
  const idx = draft.missionRow.findIndex((s) => s.uid === draft.chosenMissionUid)
  if (idx !== -1) {
    const slot = draft.missionRow[idx]
    if (slot.defeated) {
      // SUCCESS: bank the mission's VP, refill the row from the Mission deck (or shrink it).
      draft.defeatedMissions.push({ uid: slot.uid, dataId: slot.dataId })
      if (draft.missionDeck.length > 0) {
        const next = draft.missionDeck.shift()!
        const garrison = missionById.get(next.dataId)?.garrison ?? 0
        const enemies: GameState['enemyDeck'] = []
        for (let i = 0; i < garrison; i++) {
          if (draft.enemyDeck.length === 0) refillEnemyDeckIfEmpty(draft)
          if (draft.enemyDeck.length === 0) break
          const e = draft.enemyDeck.shift()!
          e.faceUp = false
          enemies.push(e)
        }
        draft.missionRow[idx] = { uid: next.uid, dataId: next.dataId, faceDown: false, defeated: false, enemies }
      } else {
        draft.missionRow.splice(idx, 1) // no refill available — the row shrinks
      }
      draft.log.push(`AFTERMATH: mission ${slot.dataId} succeeded`)
    } else {
      // FAILURE: the mission flips face-down in its slot; two failures loses the game.
      slot.faceDown = true
      draft.failedMissions += 1
      draft.log.push(`AFTERMATH: mission ${slot.dataId} failed (${draft.failedMissions})`)
      if (draft.failedMissions >= 2) {
        draft.result = { outcome: 'loss', reason: 'missions' }
        draft.phase = 'GAME_OVER'
      }
    }
  }
}

/** Win-table tiers (mirrors data/rules.json). 0 VP is unmapped in the rulebook → treated as Draw. */
function scoreTier(points: number, defeatedCount: number): string {
  if (defeatedCount >= 10) return 'Epic Victory'
  if (points >= 22) return 'Major Victory'
  if (points >= 19) return 'Victory'
  if (points >= 15) return 'Minor Victory'
  return 'Draw'
}

function applyEndResistance(draft: Draft<GameState>): void {
  if (draft.phase !== 'AFTERMATH') throw new Error('EndResistance: only legal in AFTERMATH')
  const points = draft.defeatedMissions.reduce((n, m) => n + (missionById.get(m.dataId)?.victoryPoints ?? 0), 0)
  const tier = scoreTier(points, draft.defeatedMissions.length)
  draft.result = { outcome: 'win', tier, points }
  draft.phase = 'GAME_OVER'
  draft.log.push(`END: ${tier} (${points} VP)`)
}

function applyContinue(draft: Draft<GameState>): void {
  if (draft.phase !== 'AFTERMATH') throw new Error('Continue: only legal in AFTERMATH')
  if (!draft.missionRow.some((s) => !s.faceDown)) {
    throw new Error('Continue: no Available Missions remain — you must end the resistance')
  }

  draft.phase = 'RECOVER'
  // Cleanup: revealed Maquis -> Revealed pile; hidden Maquis + any hand Spies -> Hidden discard.
  for (const m of draft.inPlay) {
    if (m.side === 'revealed') draft.recruit.revealed.push({ uid: m.uid, dataId: m.dataId })
    else draft.hidden.discard.push({ uid: m.uid, dataId: m.dataId })
  }
  draft.inPlay = []
  for (const c of draft.hand) draft.hidden.discard.push({ uid: c.uid, dataId: c.dataId }) // Spies only, per play-out
  draft.hand = []

  // Draw the new hand, applying (then clearing) the Recover draw modifier.
  drawHidden(draft, Math.max(0, 5 + draft.recoverDrawModifier))

  // Reset per-round scratch.
  draft.attackStrength = 0
  draft.missionDefenseOverride = null
  draft.attackRevealLimit = null
  draft.revealedInAttack = 0
  draft.ignoreMissionEffect = false
  draft.recoverDrawModifier = 0
  draft.chosenMissionUid = null

  // All-Spy hand is a loss.
  if (draft.hand.length > 0 && draft.hand.every((c) => c.dataId === 'spy')) {
    draft.result = { outcome: 'loss', reason: 'spies' }
    draft.phase = 'GAME_OVER'
    draft.log.push('RECOVER: drew an all-Spy hand — the resistance collapses')
    return
  }

  draft.phase = 'PLAN'
  draft.round += 1
  draft.log.push(`RECOVER: cleaned up and drew a new hand; -> PLAN (round ${draft.round})`)
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
    settleAutomaticPhases(draft)
  })
}
