// Real PLAN / PLAN-ATTACK Maquis card-action effects, replacing the driver's `[stub]` path.
//
// Convention (enforced across every handler): a handler is re-invoked from the top on each
// resume and reads its prior answers from `responses` (one entry per resolved decision, in
// order). It uses `responses.length` as its stage counter. Handlers therefore MUST NOT mutate
// state until they have every response they need — pre-terminal stages only *return* a Decision,
// computed from state + prior responses. State is unchanged across a suspension, so re-runs are
// idempotent. All mutation happens in the single terminal invocation.
//
// Scope: this slice implements the PLAN-usable actions. Two PLAN sides are intentionally deferred
// to the ATTACK slice, where their dependencies exist: `emilio:hidden` (copy another Maquis's
// action) and `pilar:revealed` (ignore the chosen Mission's effect — needs the mission-effect
// system). ATTACK-only sides also land with that slice.

import type { Draft } from 'immer'
import { shuffle } from '../rng'
import { maquis as maquisData } from '../../data'
import type { Decision, GameState } from '../types'
import {
  effectRegistry,
  maquisEffectId,
  registerEffect,
  type EffectHandler,
} from './registry'

const hiddenActionTypeById = new Map(maquisData.map((m) => [m.id, m.hidden.actionType]))

/** Whether a hidden action of this type may be copied/fired during `phase`. */
function firesInPhase(actionType: string | null, phase: GameState['phase']): boolean {
  if (actionType === null) return false
  if (actionType === 'PLAN/ATTACK') return phase === 'PLAN' || phase === 'ATTACK'
  return actionType === phase
}

type UidItem = { uid: string }

const isSpy = (c: { dataId: string }): boolean => c.dataId === 'spy'

// --- shared deck helpers ----------------------------------------------------

/** Rulebook: reshuffle the Hidden discard into a fresh Hidden deck only once the deck is empty. */
function refillHiddenIfEmpty(state: Draft<GameState>): void {
  if (state.hidden.deck.length === 0 && state.hidden.discard.length > 0) {
    const plain = state.hidden.discard.map((c) => ({ uid: c.uid, dataId: c.dataId }))
    const s = shuffle(plain, state.rng)
    state.rng = s.state
    state.hidden.discard.length = 0
    state.hidden.deck.push(...s.result)
  }
}

/** Draw n cards from the top of the Hidden deck into the hand, reshuffling on empty. Draws
 *  fewer than n only if the deck and discard are both exhausted. Shared with the ATTACK effects. */
export function drawHidden(state: Draft<GameState>, n: number): void {
  for (let i = 0; i < n; i++) {
    if (state.hidden.deck.length === 0) refillHiddenIfEmpty(state)
    if (state.hidden.deck.length === 0) break
    state.hand.push(state.hidden.deck.shift()!)
  }
}

// --- effect factories & handlers --------------------------------------------

/** Draw exactly n from the Hidden deck (no player choice). */
const drawN = (n: number): EffectHandler => ({ state }) => {
  drawHidden(state as Draft<GameState>, n)
}

/**
 * "Look at the top three cards of DECK. Discard any of them and put the rest back in any order."
 * Two decisions: which of the top 3 to discard, then the ordering of those kept (first = top).
 * Works for the Hidden deck (discard -> Hidden discard) and the Enemy deck (discard -> Enemy discard).
 */
function lookDiscardReorder(
  getDeck: (s: Draft<GameState>) => UidItem[],
  getDiscard: (s: Draft<GameState>) => UidItem[],
  fromLabel: string,
): EffectHandler {
  return ({ state, responses }): Decision | void => {
    const deck = getDeck(state as Draft<GameState>)
    const topLen = Math.min(3, deck.length)
    const topUids = deck.slice(0, topLen).map((c) => c.uid)

    if (responses.length === 0) {
      return {
        kind: 'selectCards',
        from: fromLabel,
        min: 0,
        max: topLen,
        prompt: `Look at the top ${topLen} — discard any`,
        candidates: topUids,
      }
    }

    const discardUids = responses[0]
    const keptUids = topUids.filter((u) => !discardUids.includes(u))

    if (responses.length === 1) {
      return {
        kind: 'orderCards',
        cards: keptUids,
        prompt: 'Put the rest back on top in any order (first = top)',
      }
    }

    // terminal
    const order = responses[1]
    const removed = deck.splice(0, topLen)
    const byUid = new Map(removed.map((c) => [c.uid, c]))
    const discard = getDiscard(state as Draft<GameState>)
    for (const u of discardUids) {
      const c = byUid.get(u)
      if (c) discard.push(c)
    }
    for (let i = order.length - 1; i >= 0; i--) {
      const c = byUid.get(order[i])
      if (c) deck.unshift(c)
    }
  }
}

/** "Discard one Spy from your hand to the Hidden discard pile then draw a card." (Celia/Antonio hidden) */
const spyDiscardDraw: EffectHandler = ({ state }) => {
  const s = state as Draft<GameState>
  const i = s.hand.findIndex(isSpy)
  if (i === -1) return
  s.hidden.discard.push(s.hand.splice(i, 1)[0])
  drawHidden(s, 1)
}

/** "Remove one Spy in your hand from the game." (Manuela/Manuel revealed) */
const removeSpy: EffectHandler = ({ state }) => {
  const s = state as Draft<GameState>
  const i = s.hand.findIndex(isSpy)
  if (i === -1) return
  s.removedFromGame.push(s.hand.splice(i, 1)[0])
}

/** "Discard a Maquis card from your hand and then draw two cards." (Jacinto revealed) */
const discardMaquisDrawTwo: EffectHandler = ({ state, responses }): Decision | void => {
  const s = state as Draft<GameState>
  const maquisUids = s.hand.filter((c) => !isSpy(c)).map((c) => c.uid)
  if (maquisUids.length === 0) return
  if (responses.length === 0) {
    return {
      kind: 'selectCards',
      from: 'hand',
      min: 1,
      max: 1,
      prompt: 'Discard a Maquis from your hand',
      candidates: maquisUids,
    }
  }
  const idx = s.hand.findIndex((c) => c.uid === responses[0][0])
  if (idx !== -1) s.hidden.discard.push(s.hand.splice(idx, 1)[0])
  drawHidden(s, 2)
}

/** "Choose a card from the Revealed pile and place it [in your hand | on top of the Hidden deck]." */
function revealedPick(dest: 'hand' | 'hiddenTop'): EffectHandler {
  return ({ state, responses }): Decision | void => {
    const s = state as Draft<GameState>
    const revealed = s.recruit.revealed
    if (revealed.length === 0) return
    if (responses.length === 0) {
      return {
        kind: 'selectCards',
        from: 'recruit.revealed',
        min: 1,
        max: 1,
        prompt: 'Choose a card from the Revealed pile',
        candidates: revealed.map((c) => c.uid),
      }
    }
    const idx = revealed.findIndex((c) => c.uid === responses[0][0])
    if (idx === -1) return
    const card = revealed.splice(idx, 1)[0]
    if (dest === 'hand') s.hand.push(card)
    else s.hidden.deck.unshift(card)
  }
}

/** "Flip all Enemies at one Mission face-up." (Adolfo revealed, Manuel/Paquita hidden) */
const scoutAll: EffectHandler = ({ state, responses }): Decision | void => {
  const s = state as Draft<GameState>
  const eligible = s.missionRow.filter((slot) => !slot.faceDown && slot.enemies.length > 0)
  if (responses.length === 0) {
    if (eligible.length <= 1) {
      const slot = eligible[0]
      if (slot) for (const e of slot.enemies) e.faceUp = true
      return
    }
    return {
      kind: 'selectTarget',
      candidates: eligible.map((slot) => slot.uid),
      prompt: 'Flip all Enemies at one Mission face-up',
    }
  }
  const slot = s.missionRow.find((sl) => sl.uid === responses[0][0])
  if (slot) for (const e of slot.enemies) e.faceUp = true
}

/** "Flip one or two face-down Enemies at one Mission face-up then discard one of them." (Pilar/Domingo hidden) */
const scoutFlipDiscard: EffectHandler = ({ state, responses }): Decision | void => {
  const s = state as Draft<GameState>
  if (responses.length === 0) {
    const eligible = s.missionRow.filter((slot) => !slot.faceDown && slot.enemies.some((e) => !e.faceUp))
    return {
      kind: 'selectTarget',
      candidates: eligible.map((slot) => slot.uid),
      prompt: 'Choose a Mission to flip 1–2 Enemies at',
    }
  }
  const slot = s.missionRow.find((sl) => sl.uid === responses[0][0])
  if (!slot) return

  if (responses.length === 1) {
    return {
      kind: 'selectCards',
      from: 'mission.enemies',
      min: 1,
      max: 2,
      prompt: 'Flip one or two face-down Enemies face-up',
      candidates: slot.enemies.filter((e) => !e.faceUp).map((e) => e.uid),
    }
  }

  const flipped = responses[1]
  if (responses.length === 2) {
    return {
      kind: 'selectCards',
      from: 'mission.enemies',
      min: 1,
      max: 1,
      prompt: 'Discard one of the flipped Enemies',
      candidates: flipped,
    }
  }

  // terminal
  for (const e of slot.enemies) if (flipped.includes(e.uid)) e.faceUp = true
  const di = slot.enemies.findIndex((e) => e.uid === responses[2][0])
  if (di !== -1) s.enemyDiscard.push(slot.enemies.splice(di, 1)[0])
}

/** "Look at the top three of the Recruit deck. Put one on top of the Hidden deck and the rest
 *  back on the Recruit deck in any order." (Antonio revealed) */
const recruitOneToHiddenTop: EffectHandler = ({ state, responses }): Decision | void => {
  const s = state as Draft<GameState>
  const deck = s.recruit.deck
  const topLen = Math.min(3, deck.length)
  if (topLen === 0) return
  const topUids = deck.slice(0, topLen).map((c) => c.uid)

  if (responses.length === 0) {
    return {
      kind: 'selectCards',
      from: 'recruit.deck',
      min: 1,
      max: 1,
      prompt: 'Put one on top of the Hidden deck',
      candidates: topUids,
    }
  }
  const chosen = responses[0][0]
  const restUids = topUids.filter((u) => u !== chosen)
  if (responses.length === 1) {
    return {
      kind: 'orderCards',
      cards: restUids,
      prompt: 'Put the rest back on the Recruit deck (first = top)',
    }
  }

  // terminal
  const order = responses[1]
  const removed = deck.splice(0, topLen)
  const byUid = new Map(removed.map((c) => [c.uid, c]))
  for (let i = order.length - 1; i >= 0; i--) {
    const c = byUid.get(order[i])
    if (c) deck.unshift(c)
  }
  const chosenCard = byUid.get(chosen)
  if (chosenCard) s.hidden.deck.unshift(chosenCard)
}

/** "Look at the top three of the Recruit deck. Put any of them on the bottom and the rest back
 *  on top in any order." (Ramona hidden) */
const recruitAnyToBottom: EffectHandler = ({ state, responses }): Decision | void => {
  const s = state as Draft<GameState>
  const deck = s.recruit.deck
  const topLen = Math.min(3, deck.length)
  if (topLen === 0) return
  const topUids = deck.slice(0, topLen).map((c) => c.uid)

  if (responses.length === 0) {
    return {
      kind: 'selectCards',
      from: 'recruit.deck',
      min: 0,
      max: topLen,
      prompt: 'Put any of the top 3 on the bottom',
      candidates: topUids,
    }
  }
  const bottomUids = responses[0]
  const keptUids = topUids.filter((u) => !bottomUids.includes(u))
  if (responses.length === 1) {
    return {
      kind: 'orderCards',
      cards: keptUids,
      prompt: 'Put the rest back on top in any order (first = top)',
    }
  }

  // terminal
  const order = responses[1]
  const removed = deck.splice(0, topLen)
  const byUid = new Map(removed.map((c) => [c.uid, c]))
  for (const u of bottomUids) {
    const c = byUid.get(u)
    if (c) deck.push(c)
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const c = byUid.get(order[i])
    if (c) deck.unshift(c)
  }
}

/** "Ignore the effect on the Mission that you choose this round." (Pilar revealed) Sets a flag the
 *  mission effect handlers check; reset in RECOVER. */
const ignoreChosenMissionEffect: EffectHandler = ({ state }) => {
  ;(state as Draft<GameState>).ignoreMissionEffect = true
}

/**
 * "Copy the hidden action on a hidden Maquis in play; the phase must match the current phase."
 * (Emilio hidden.) Meta-effect: pick a target, then delegate to the target's registered *hidden*
 * handler. `responses[0]` is the target selection; the copied handler is stage-style too, so it
 * receives `responses.slice(1)` — nested decisions thread through cleanly across resumes.
 */
const emilioCopyHidden: EffectHandler = (ctx): Decision | void => {
  const s = ctx.state as Draft<GameState>
  if (ctx.responses.length === 0) {
    const candidates = s.inPlay
      .filter(
        (m) =>
          m.side === 'hidden' &&
          m.dataId !== 'emilio' &&
          firesInPhase(hiddenActionTypeById.get(m.dataId) ?? null, s.phase),
      )
      .map((m) => m.uid)
    if (candidates.length === 0) return
    return { kind: 'selectTarget', candidates, prompt: 'Copy the hidden action of which Maquis?' }
  }
  const target = s.inPlay.find((m) => m.uid === ctx.responses[0][0])
  if (!target) return
  const copied = effectRegistry[maquisEffectId(target.dataId, 'hidden')]
  if (!copied) return // unregistered copy target → no-op
  return copied({ state: s, sourceUid: ctx.sourceUid, args: ctx.args, responses: ctx.responses.slice(1) })
}

// --- registry ---------------------------------------------------------------

/** Every PLAN-usable Maquis effect implemented this slice, keyed by effect id. */
export const PLAN_EFFECTS: Record<string, EffectHandler> = {
  [maquisEffectId('manuela', 'hidden')]: drawN(1),
  [maquisEffectId('marcelino', 'hidden')]: drawN(1),
  [maquisEffectId('carlos', 'revealed')]: drawN(2),

  [maquisEffectId('domingo', 'revealed')]: lookDiscardReorder((s) => s.hidden.deck, (s) => s.hidden.discard, 'hidden.deck'),
  [maquisEffectId('jacinto', 'hidden')]: lookDiscardReorder((s) => s.hidden.deck, (s) => s.hidden.discard, 'hidden.deck'),
  [maquisEffectId('juana', 'hidden')]: lookDiscardReorder((s) => s.hidden.deck, (s) => s.hidden.discard, 'hidden.deck'),
  [maquisEffectId('roberto', 'hidden')]: lookDiscardReorder((s) => s.enemyDeck, (s) => s.enemyDiscard, 'enemy.deck'),

  [maquisEffectId('celia', 'hidden')]: spyDiscardDraw,
  [maquisEffectId('antonio', 'hidden')]: spyDiscardDraw,
  [maquisEffectId('manuela', 'revealed')]: removeSpy,
  [maquisEffectId('manuel', 'revealed')]: removeSpy,
  [maquisEffectId('jacinto', 'revealed')]: discardMaquisDrawTwo,

  [maquisEffectId('celia', 'revealed')]: revealedPick('hand'),
  [maquisEffectId('juana', 'revealed')]: revealedPick('hiddenTop'),

  [maquisEffectId('adolfo', 'revealed')]: scoutAll,
  [maquisEffectId('manuel', 'hidden')]: scoutAll,
  [maquisEffectId('paquita', 'hidden')]: scoutAll,
  [maquisEffectId('pilar', 'hidden')]: scoutFlipDiscard,
  [maquisEffectId('domingo', 'hidden')]: scoutFlipDiscard,

  [maquisEffectId('antonio', 'revealed')]: recruitOneToHiddenTop,
  [maquisEffectId('ramona', 'hidden')]: recruitAnyToBottom,

  [maquisEffectId('pilar', 'revealed')]: ignoreChosenMissionEffect,
  [maquisEffectId('emilio', 'hidden')]: emilioCopyHidden,
}

/** Register every PLAN effect into the global effect registry. The app bootstrap (and tests
 *  that exercise real effects) must call this; the engine does not auto-register on import so
 *  the driver's `[stub]` path stays testable in isolation. */
export function registerPlanEffects(): void {
  for (const [id, handler] of Object.entries(PLAN_EFFECTS)) registerEffect(id, handler)
}

// --- preconditions ----------------------------------------------------------
// Rulebook: a card action may only be performed if it can be performed *in full*. legalActions
// consults these so UseAction is never offered for an action the player couldn't complete.

const hasSpyInHand = (s: GameState): boolean => s.hand.some((c) => c.dataId === 'spy')
const hasMaquisInHand = (s: GameState): boolean => s.hand.some((c) => c.dataId !== 'spy')
const revealedPileNonEmpty = (s: GameState): boolean => s.recruit.revealed.length > 0
const hasFaceDownEnemy = (s: GameState): boolean =>
  s.missionRow.some((slot) => !slot.faceDown && slot.enemies.some((e) => !e.faceUp))

export const PLAN_PRECONDITIONS: Record<string, (s: GameState) => boolean> = {
  [maquisEffectId('celia', 'hidden')]: hasSpyInHand,
  [maquisEffectId('antonio', 'hidden')]: hasSpyInHand,
  [maquisEffectId('manuela', 'revealed')]: hasSpyInHand,
  [maquisEffectId('manuel', 'revealed')]: hasSpyInHand,
  [maquisEffectId('jacinto', 'revealed')]: hasMaquisInHand,
  [maquisEffectId('celia', 'revealed')]: revealedPileNonEmpty,
  [maquisEffectId('juana', 'revealed')]: revealedPileNonEmpty,
  [maquisEffectId('pilar', 'hidden')]: hasFaceDownEnemy,
  [maquisEffectId('domingo', 'hidden')]: hasFaceDownEnemy,
  [maquisEffectId('emilio', 'hidden')]: (s) =>
    s.inPlay.some(
      (m) =>
        m.side === 'hidden' &&
        m.dataId !== 'emilio' &&
        firesInPhase(hiddenActionTypeById.get(m.dataId) ?? null, s.phase),
    ),
}
