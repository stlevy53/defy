// Enemy effect handlers (chunk 3a). Keyed by `enemy:{typeId}`; the driver queues them with a
// `trigger` in task.args (DEFEND at ATTACK start, DEFEAT on defeat, SURVIVE on advance). Each
// enemy type has a single keyword, so a handler acts only on its own trigger (self-filtered via
// `onTrigger`) and no-ops on any other — the queue fires every enemy for every trigger.
//
// Guard and Grunt DEFEND are *ordering constraints*, not one-shot mutations, so they're enforced
// structurally in actions.ts (isTargetLegal); here they register as no-ops so the driver doesn't
// log `[stub]` for them.

import type { Draft } from 'immer'
import { shuffle } from '../rng'
import { enemyTypes } from '../../data'
import type { Keyword } from '../../types'
import type { GameState, MissionSlot } from '../types'
import { enemyEffectId, registerEffect, type EffectContext, type EffectHandler } from './registry'

const enemyKeyword = new Map(enemyTypes.map((t) => [t.id, t.keyword]))

/** Wrap a handler so it only runs when the queued trigger matches `keyword`. */
function onTrigger(keyword: Keyword, fn: (ctx: EffectContext) => void): EffectHandler {
  return (ctx) => {
    if (ctx.args.trigger !== keyword) return
    fn(ctx)
  }
}

function chosenSlot(state: Draft<GameState>): MissionSlot | undefined {
  if (state.chosenMissionUid === null) return undefined
  return state.missionRow.find((s) => s.uid === state.chosenMissionUid)
}

// --- SURVIVE ----------------------------------------------------------------

/** Counter-Guerrilla: draw a Civilian into the Graveyard (civilian-loss check happens in AFTERMATH). */
const counterGuerrillaSurvive = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  if (s.civilianDeck.length === 0) return
  s.graveyard.push(s.civilianDeck.shift()!)
}

/** Military: shuffle all hidden Maquis in play and remove one from the game. */
const militarySurvive = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  const hiddenUids = s.inPlay.filter((m) => m.side === 'hidden').map((m) => m.uid)
  if (hiddenUids.length === 0) return
  const picked = shuffle(hiddenUids, s.rng)
  s.rng = picked.state
  const i = s.inPlay.findIndex((m) => m.uid === picked.result[0])
  const removed = s.inPlay.splice(i, 1)[0]
  s.removedFromGame.push({ uid: removed.uid, dataId: removed.dataId })
}

/** Spy Master: add a new Spy to the Hidden discard pile (no-op if the Spy supply is empty). */
const spyMasterSurvive = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  if (s.spiesAvailable <= 0) return
  const uid = `spy-avail-${s.spiesAvailable}` // unique: supply counts down, uids never repeat
  s.spiesAvailable -= 1
  s.hidden.discard.push({ uid, dataId: 'spy' })
}

/** Radio Operator: place a face-down Enemy on every other Mission (as far as the Enemy deck allows). */
const radioOperatorSurvive = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  for (const slot of s.missionRow) {
    if (slot.uid === s.chosenMissionUid) continue
    if (s.enemyDeck.length === 0) break
    const enemy = s.enemyDeck.shift()!
    enemy.faceUp = false
    slot.enemies.push(enemy)
  }
}

// --- DEFEAT -----------------------------------------------------------------

/** Jailor: draw a card from the Recruit deck into the Hidden discard pile. */
const jailorDefeat = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  if (s.recruit.deck.length === 0) return
  s.hidden.discard.push(s.recruit.deck.shift()!)
}

// --- DEFEND -----------------------------------------------------------------

/** Engineer: +1 Defense to every non-Engineer Enemy at this Mission. Runs at ATTACK start, before
 *  any ATTACK-action defense reduction (Benigno), so the FAQ ordering holds automatically. */
const engineerDefend = ({ state }: EffectContext) => {
  const slot = chosenSlot(state as Draft<GameState>)
  if (!slot) return
  for (const e of slot.enemies) if (e.typeId !== 'engineer') e.defense += 1
}

const noop: EffectHandler = () => {}

/** Enemy effects keyed by effect id. Guard/Grunt are handled structurally (see isTargetLegal). */
export const ENEMY_EFFECTS: Record<string, EffectHandler> = {
  [enemyEffectId('counter_guerrilla')]: onTrigger('SURVIVE', counterGuerrillaSurvive),
  [enemyEffectId('military')]: onTrigger('SURVIVE', militarySurvive),
  [enemyEffectId('spy_master')]: onTrigger('SURVIVE', spyMasterSurvive),
  [enemyEffectId('radio_operator')]: onTrigger('SURVIVE', radioOperatorSurvive),
  [enemyEffectId('jailor')]: onTrigger('DEFEAT', jailorDefeat),
  [enemyEffectId('engineer')]: onTrigger('DEFEND', engineerDefend),
  [enemyEffectId('guard')]: noop,
  [enemyEffectId('grunt')]: noop,
}

// Sanity: every enemy type has a handler.
for (const t of enemyTypes) {
  if (!(enemyEffectId(t.id) in ENEMY_EFFECTS)) {
    throw new Error(`enemy effect missing for type '${t.id}' (keyword ${enemyKeyword.get(t.id)})`)
  }
}

/** Register the enemy effects. Explicit, like the PLAN/ATTACK effects. */
export function registerEnemyEffects(): void {
  for (const [id, handler] of Object.entries(ENEMY_EFFECTS)) registerEffect(id, handler)
}
