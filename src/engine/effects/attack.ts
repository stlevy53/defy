// ATTACK-side Maquis effects — chunk 1: attack-value and defense modifiers.
//
// Same stage-style contract as effects/plan.ts, but these are all single-shot (no player
// decision): they read the board and mutate a scalar. Attack bonuses `+=` state.attackStrength;
// defense modifiers mutate the live Defense the resolution reads (enemy.defense) or set the
// per-round mission-Defense override. Because DEFEND effects resolve at ATTACK start and these
// ATTACK-action effects resolve later when used, the FAQ ordering (Engineer +1 before Benigno −1)
// falls out of execution order — no explicit ordering code needed.
//
// Chunk 2 (enemy discard/move, counter-guerrilla sweep, ATTACK draws) and the mission/enemy
// effect handlers land next.

import type { Draft } from 'immer'
import { civilians as civilianData, missions as missionsData } from '../../data'
import type { Decision, GameState, MissionSlot } from '../types'
import { maquisEffectId, registerEffect, type EffectHandler } from './registry'
import { drawHiddenAndLog } from './plan'

const COUNTER_GUERRILLA = 'counter_guerrilla'

const civiliansById = new Map(civilianData.map((c) => [c.id, c.civilians]))
const missionDefenseById = new Map(missionsData.map((m) => [m.id, m.defense]))

/** The chosen Mission's slot (local copy — effects stay self-contained, no import from actions). */
function chosenSlot(state: Draft<GameState>): MissionSlot | undefined {
  if (state.chosenMissionUid === null) return undefined
  return state.missionRow.find((s) => s.uid === state.chosenMissionUid)
}

const countRevealedInPlay = (state: Draft<GameState>): number =>
  state.inPlay.filter((m) => m.side === 'revealed').length

/** Bank attack an action grants: add it to the shared pool AND attribute it to the acting Maquis so
 *  its card can show its true contribution (printed value + this bonus). */
const grantAttack = (s: Draft<GameState>, sourceUid: string, amount: number): void => {
  s.attackStrength += amount
  const mip = s.inPlay.find((m) => m.uid === sourceUid)
  if (mip) mip.attackBonus = (mip.attackBonus ?? 0) + amount
}

/** +1 Attack for each revealed Maquis in play. (Soledad hidden, Abel hidden) */
const plusPerRevealed: EffectHandler = ({ state, sourceUid }) => {
  const s = state as Draft<GameState>
  grantAttack(s, sourceUid, countRevealedInPlay(s))
}

/** +1 Attack for each *other* Maquis in play, hidden or revealed. (Marcelino revealed) */
const plusPerOther: EffectHandler = ({ state, sourceUid }) => {
  const s = state as Draft<GameState>
  grantAttack(s, sourceUid, s.inPlay.filter((m) => m.uid !== sourceUid).length)
}

/** +1 Attack for each civilian in the Graveyard (sum of the cards' civilian counts). (Abel revealed) */
const plusPerCivilian: EffectHandler = ({ state, sourceUid }) => {
  const s = state as Draft<GameState>
  grantAttack(s, sourceUid, s.graveyard.reduce((n, c) => n + (civiliansById.get(c.dataId) ?? 0), 0))
}

/** Reduce by 1 the Defense of each Enemy at the chosen Mission whose Defense is 2 or more. (Benigno revealed) */
const benignoReduce: EffectHandler = ({ state }) => {
  const slot = chosenSlot(state as Draft<GameState>)
  if (!slot) return
  for (const e of slot.enemies) if (e.defense >= 2) e.defense -= 1
}

/** Halve the chosen Mission's Defense, rounded up. (Ricardo revealed) */
const ricardoHalf: EffectHandler = ({ state }) => {
  const s = state as Draft<GameState>
  const slot = chosenSlot(s)
  if (!slot) return
  const current = s.missionDefenseOverride ?? missionDefenseById.get(slot.dataId) ?? 0
  s.missionDefenseOverride = Math.ceil(current / 2)
}

// --- chunk 2: enemy manipulation + ATTACK draws --------------------------------------------

/** "Discard one Enemy from this Mission." Discard ≠ defeat: no DEFEAT effect fires.
 *  (Anastasio h/r, Emilio r, Adolfo h) */
const discardOneEnemy: EffectHandler = ({ state, responses }): Decision | void => {
  const slot = chosenSlot(state as Draft<GameState>)
  if (!slot || slot.enemies.length === 0) return
  if (responses.length === 0) {
    return { kind: 'selectTarget', candidates: slot.enemies.map((e) => e.uid), prompt: 'Discard one Enemy from this Mission' }
  }
  const i = slot.enemies.findIndex((e) => e.uid === responses[0][0])
  if (i !== -1) (state as Draft<GameState>).enemyDiscard.push(slot.enemies.splice(i, 1)[0])
}

/** "Discard two Enemies from this Mission." (Paquita revealed) */
const discardTwoEnemies: EffectHandler = ({ state, responses }): Decision | void => {
  const s = state as Draft<GameState>
  const slot = chosenSlot(s)
  if (!slot || slot.enemies.length === 0) return
  const n = Math.min(2, slot.enemies.length)
  if (responses.length === 0) {
    return {
      kind: 'selectCards',
      from: 'mission.enemies',
      min: n,
      max: n,
      prompt: `Discard ${n} Enem${n === 1 ? 'y' : 'ies'} from this Mission`,
      candidates: slot.enemies.map((e) => e.uid),
    }
  }
  for (const uid of responses[0]) {
    const i = slot.enemies.findIndex((e) => e.uid === uid)
    if (i !== -1) s.enemyDiscard.push(slot.enemies.splice(i, 1)[0])
  }
}

/** "Discard one Enemy from this Mission and gain attack value equal to its defense value." (Consuelo revealed) */
const consueloDiscardGain: EffectHandler = ({ state, sourceUid, responses }): Decision | void => {
  const s = state as Draft<GameState>
  const slot = chosenSlot(s)
  if (!slot || slot.enemies.length === 0) return
  if (responses.length === 0) {
    return { kind: 'selectTarget', candidates: slot.enemies.map((e) => e.uid), prompt: 'Discard one Enemy and gain its Defense as Attack' }
  }
  const i = slot.enemies.findIndex((e) => e.uid === responses[0][0])
  if (i === -1) return
  const enemy = slot.enemies.splice(i, 1)[0]
  grantAttack(s, sourceUid, enemy.defense)
  s.enemyDiscard.push(enemy)
}

/** "Move an Enemy from this Mission to a different Mission." (Adela hidden) */
const adelaMove: EffectHandler = ({ state, responses }): Decision | void => {
  const s = state as Draft<GameState>
  const slot = chosenSlot(s)
  if (!slot || slot.enemies.length === 0) return
  const destinations = s.missionRow.filter((m) => m.uid !== slot.uid && !m.faceDown)
  if (destinations.length === 0) return

  if (responses.length === 0) {
    return { kind: 'selectTarget', candidates: slot.enemies.map((e) => e.uid), prompt: 'Move which Enemy?' }
  }
  const enemyUid = responses[0][0]
  if (responses.length === 1) {
    return { kind: 'selectTarget', candidates: destinations.map((m) => m.uid), prompt: 'Move it to which Mission?' }
  }
  const dest = s.missionRow.find((m) => m.uid === responses[1][0])
  const i = slot.enemies.findIndex((e) => e.uid === enemyUid)
  if (dest && i !== -1) dest.enemies.push(slot.enemies.splice(i, 1)[0])
}

/** "Discard all Counter-guerrillas from this Mission." (Soledad revealed, Adela revealed) */
const discardCounterGuerrillas: EffectHandler = ({ state }) => {
  const s = state as Draft<GameState>
  const slot = chosenSlot(s)
  if (!slot) return
  const remaining: typeof slot.enemies = []
  for (const e of slot.enemies) {
    if (e.typeId === COUNTER_GUERRILLA) s.enemyDiscard.push(e)
    else remaining.push(e)
  }
  slot.enemies = remaining
}

/** "Draw N cards from the Hidden deck." on ATTACK. (Nicolás/Ricardo hidden draw 1; Sagrario revealed
 *  draws 2.) Logs how many were actually drawn so a short draw (deck+discard exhausted) is explained. */
const drawFromHiddenAttack = (n: number): EffectHandler => (ctx) => {
  drawHiddenAndLog(ctx, n)
}

/** "Draw a card from the Recruit deck and put it in your hand." on ATTACK. (Ramona revealed) */
const drawRecruitToHand: EffectHandler = ({ state }) => {
  const s = state as Draft<GameState>
  if (s.recruit.deck.length === 0) return
  const card = s.recruit.deck.shift()!
  s.hand.push({ uid: card.uid, dataId: card.dataId })
}

/** Chunk 1 + 2 ATTACK effects, keyed by effect id. */
export const ATTACK_EFFECTS: Record<string, EffectHandler> = {
  // chunk 1 — modifiers
  [maquisEffectId('soledad', 'hidden')]: plusPerRevealed,
  [maquisEffectId('abel', 'hidden')]: plusPerRevealed,
  [maquisEffectId('marcelino', 'revealed')]: plusPerOther,
  [maquisEffectId('abel', 'revealed')]: plusPerCivilian,
  [maquisEffectId('benigno', 'revealed')]: benignoReduce,
  [maquisEffectId('ricardo', 'revealed')]: ricardoHalf,
  // chunk 2 — enemy manipulation + draws
  [maquisEffectId('anastasio', 'hidden')]: discardOneEnemy,
  [maquisEffectId('anastasio', 'revealed')]: discardOneEnemy,
  [maquisEffectId('emilio', 'revealed')]: discardOneEnemy,
  [maquisEffectId('adolfo', 'hidden')]: discardOneEnemy,
  [maquisEffectId('paquita', 'revealed')]: discardTwoEnemies,
  [maquisEffectId('consuelo', 'revealed')]: consueloDiscardGain,
  [maquisEffectId('adela', 'hidden')]: adelaMove,
  [maquisEffectId('soledad', 'revealed')]: discardCounterGuerrillas,
  [maquisEffectId('adela', 'revealed')]: discardCounterGuerrillas,
  [maquisEffectId('nicolas', 'hidden')]: drawFromHiddenAttack(1),
  [maquisEffectId('ricardo', 'hidden')]: drawFromHiddenAttack(1),
  [maquisEffectId('sagrario', 'revealed')]: drawFromHiddenAttack(2),
  [maquisEffectId('ramona', 'revealed')]: drawRecruitToHand,
}

// --- preconditions (consulted by legalActions via effects/preconditions.ts) -----------------

const chosenSlotOf = (s: GameState): MissionSlot | undefined =>
  s.chosenMissionUid === null ? undefined : s.missionRow.find((m) => m.uid === s.chosenMissionUid)

const chosenHasEnemy = (s: GameState): boolean => (chosenSlotOf(s)?.enemies.length ?? 0) > 0
const chosenHasCounterGuerrilla = (s: GameState): boolean =>
  chosenSlotOf(s)?.enemies.some((e) => e.typeId === COUNTER_GUERRILLA) ?? false
const canMoveEnemy = (s: GameState): boolean => {
  const slot = chosenSlotOf(s)
  if (!slot || slot.enemies.length === 0) return false
  return s.missionRow.some((m) => m.uid !== slot.uid && !m.faceDown)
}

/** ATTACK-effect preconditions (an action is only offered if it can be performed in full). */
export const ATTACK_PRECONDITIONS: Record<string, (s: GameState) => boolean> = {
  [maquisEffectId('anastasio', 'hidden')]: chosenHasEnemy,
  [maquisEffectId('anastasio', 'revealed')]: chosenHasEnemy,
  [maquisEffectId('emilio', 'revealed')]: chosenHasEnemy,
  [maquisEffectId('adolfo', 'hidden')]: chosenHasEnemy,
  [maquisEffectId('paquita', 'revealed')]: chosenHasEnemy,
  [maquisEffectId('consuelo', 'revealed')]: chosenHasEnemy,
  [maquisEffectId('adela', 'hidden')]: canMoveEnemy,
  [maquisEffectId('soledad', 'revealed')]: chosenHasCounterGuerrilla,
  [maquisEffectId('adela', 'revealed')]: chosenHasCounterGuerrilla,
  // Ramona revealed draws from the Recruit deck (which never reshuffles) — only offer it with cards left.
  [maquisEffectId('ramona', 'revealed')]: (s) => s.recruit.deck.length > 0,
}

/** Register the ATTACK effects into the global registry. Like registerPlanEffects, this is
 *  explicit (not on import) so the driver's `[stub]` path stays testable in isolation. */
export function registerAttackEffects(): void {
  for (const [id, handler] of Object.entries(ATTACK_EFFECTS)) registerEffect(id, handler)
}
