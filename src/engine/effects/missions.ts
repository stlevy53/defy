// Mission effect handlers (chunk 3b). Keyed by `mission:{id}`; each is wrapped with its keyword
// (DEFEND fires at ChooseMission, DEFEAT on defeat — no Mission has SURVIVE) and skipped entirely
// when `ignoreMissionEffect` is set (Pilar revealed). Same stage-style contract as the other
// effects: mutate only at the terminal invocation. This retires the mission `[stub]` path.

import type { Draft } from 'immer'
import { shuffle } from '../rng'
import { missions as missionsData } from '../../data'
import type { Keyword } from '../../types'
import type { Decision, GameState, MissionSlot } from '../types'
import { missionEffectId, registerEffect, type EffectContext, type EffectHandler } from './registry'

const missionKeyword = new Map(missionsData.map((m) => [m.id, m.keyword]))

const isSpy = (c: { dataId: string }) => c.dataId === 'spy'

function chosenSlot(s: Draft<GameState>): MissionSlot | undefined {
  if (s.chosenMissionUid === null) return undefined
  return s.missionRow.find((m) => m.uid === s.chosenMissionUid)
}

// --- shared mechanics -------------------------------------------------------

function drawCivilians(s: Draft<GameState>, n: number): void {
  for (let i = 0; i < n; i++) {
    if (s.civilianDeck.length === 0) break
    s.graveyard.push(s.civilianDeck.shift()!)
  }
}

function addSpyToHiddenDiscard(s: Draft<GameState>): void {
  if (s.spiesAvailable <= 0) return
  const uid = `spy-avail-${s.spiesAvailable}` // supply counts down, so uids never repeat
  s.spiesAvailable -= 1
  s.hidden.discard.push({ uid, dataId: 'spy' })
}

function removeOneSpyFromHand(s: Draft<GameState>): void {
  const i = s.hand.findIndex(isSpy)
  if (i !== -1) s.removedFromGame.push(s.hand.splice(i, 1)[0])
}

function removeRandomHiddenMaquisInPlay(s: Draft<GameState>): void {
  const hiddenUids = s.inPlay.filter((m) => m.side === 'hidden').map((m) => m.uid)
  if (hiddenUids.length === 0) return
  const picked = shuffle(hiddenUids, s.rng)
  s.rng = picked.state
  const i = s.inPlay.findIndex((m) => m.uid === picked.result[0])
  const removed = s.inPlay.splice(i, 1)[0]
  s.removedFromGame.push({ uid: removed.uid, dataId: removed.dataId })
}

/** Count undefeated enemies still at the chosen mission (used by the Civilian-per-enemy effects). */
const undefeatedEnemyCount = (s: Draft<GameState>) => chosenSlot(s)?.enemies.length ?? 0

// --- DEFEAT effects (fire when the Mission is defeated as a target) ----------

const barracks = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  for (const m of s.missionRow) {
    if (m.uid === s.chosenMissionUid) continue
    if (s.enemyDeck.length === 0) break
    const e = s.enemyDeck.shift()!
    e.faceUp = false
    m.enemies.push(e)
  }
}

const borderRecoverMinus = ({ state }: EffectContext) => {
  ;(state as Draft<GameState>).recoverDrawModifier -= 1
}
const valleyRecoverPlus = ({ state }: EffectContext) => {
  ;(state as Draft<GameState>).recoverDrawModifier += 1
}

const mountainPassScout = ({ state, responses }: EffectContext): Decision | void => {
  const s = state as Draft<GameState>
  // Any available Mission that still has a face-down Enemy — including this one, if its
  // garrison wasn't already revealed. Never auto-pick: ChooseMission has already flipped
  // *this* Mission's garrison, and "one Mission" is a player choice, not a default.
  const eligible = s.missionRow.filter((m) => !m.faceDown && m.enemies.some((e) => !e.faceUp))
  if (eligible.length === 0) return
  if (responses.length === 0) {
    return { kind: 'selectTarget', candidates: eligible.map((m) => m.uid), prompt: 'Flip all Enemies at one Mission' }
  }
  const m = s.missionRow.find((x) => x.uid === responses[0][0])
  if (m) for (const e of m.enemies) e.faceUp = true
}

const railroadBridgeDiscardElsewhere = ({ state, responses }: EffectContext): Decision | void => {
  const s = state as Draft<GameState>
  const candidates = s.missionRow
    .filter((m) => m.uid !== s.chosenMissionUid)
    .flatMap((m) => m.enemies.map((e) => e.uid))
  if (candidates.length === 0) return
  if (responses.length === 0) {
    return { kind: 'selectTarget', candidates, prompt: 'Discard one Enemy from another Mission' }
  }
  for (const m of s.missionRow) {
    const i = m.enemies.findIndex((e) => e.uid === responses[0][0])
    if (i !== -1) {
      s.enemyDiscard.push(m.enemies.splice(i, 1)[0])
      break
    }
  }
}

const officerRemoveSpy = ({ state }: EffectContext) => removeOneSpyFromHand(state as Draft<GameState>)

const civiliansPerUndefeatedEnemy = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  drawCivilians(s, undefeatedEnemyCount(s))
}

const supplyConvoyDiscardEachOther = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  for (const m of s.missionRow) {
    if (m.uid === s.chosenMissionUid) continue
    if (m.enemies.length > 0) s.enemyDiscard.push(m.enemies.shift()!)
  }
}

const recruitToHiddenDiscard = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  if (s.recruit.deck.length > 0) s.hidden.discard.push(s.recruit.deck.shift()!)
}

const cavesAddSpy = ({ state }: EffectContext) => addSpyToHiddenDiscard(state as Draft<GameState>)

const revealedPileToHiddenDiscard = ({ state, responses }: EffectContext): Decision | void => {
  const s = state as Draft<GameState>
  if (s.recruit.revealed.length === 0) return
  if (responses.length === 0) {
    return {
      kind: 'selectCards',
      from: 'recruit.revealed',
      min: 1,
      max: 1,
      prompt: 'Choose a card from the Revealed pile',
      candidates: s.recruit.revealed.map((c) => c.uid),
    }
  }
  const i = s.recruit.revealed.findIndex((c) => c.uid === responses[0][0])
  if (i !== -1) s.hidden.discard.push(s.recruit.revealed.splice(i, 1)[0])
}

const removeRandomHiddenMaquis = ({ state }: EffectContext) =>
  removeRandomHiddenMaquisInPlay(state as Draft<GameState>)

/** "Look at the top three of the Hidden deck. Put any Spies back on top and discard the rest." */
const policeStationSift = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  const n = Math.min(3, s.hidden.deck.length)
  const top = s.hidden.deck.splice(0, n)
  const spies = top.filter(isSpy)
  const rest = top.filter((c) => !isSpy(c))
  for (const c of rest) s.hidden.discard.push(c)
  for (let i = spies.length - 1; i >= 0; i--) s.hidden.deck.unshift(spies[i])
}

// --- DEFEND effects (fire at ChooseMission) ---------------------------------

const bunkerDiscardHandMaquis = ({ state, responses }: EffectContext): Decision | void => {
  const s = state as Draft<GameState>
  const maquis = s.hand.filter((c) => !isSpy(c)).map((c) => c.uid)
  if (maquis.length === 0) {
    // Printed text is "discard a Maquis", never a Spy. With an empty or Spies-only hand the
    // effect has nothing legal to take — say so on the event line rather than failing silently.
    s.log.push(`${s.phase}: Bunker — no Maquis left in hand to discard`)
    return
  }
  if (responses.length === 0) {
    return {
      kind: 'selectCards',
      from: 'hand',
      min: 1,
      max: 1,
      prompt: 'Discard a Maquis from your hand (Bunker)',
      candidates: maquis,
      // Even a single remaining Maquis must be clicked — auto-settling made the discard invisible.
      forceChoice: true,
    }
  }
  const i = s.hand.findIndex((c) => c.uid === responses[0][0])
  if (i !== -1) s.hidden.discard.push(s.hand.splice(i, 1)[0])
}

const trainDepotNoReveal = ({ state }: EffectContext) => {
  ;(state as Draft<GameState>).attackRevealLimit = 0
}
const trainDepotOneReveal = ({ state }: EffectContext) => {
  ;(state as Draft<GameState>).attackRevealLimit = 1
}

/** "Immediately discard all Maquis in play." Hidden -> Hidden discard, revealed -> Revealed pile;
 *  their banked Attack is gone (fires before any ATTACK play, so a reset to 0 is exact). */
const crossroadsDiscardInPlay = ({ state }: EffectContext) => {
  const s = state as Draft<GameState>
  for (const m of s.inPlay) {
    if (m.side === 'revealed') s.recruit.revealed.push({ uid: m.uid, dataId: m.dataId })
    else s.hidden.discard.push({ uid: m.uid, dataId: m.dataId })
  }
  s.inPlay = []
  s.attackStrength = 0
}

const mayorHousePlusDefense = ({ state }: EffectContext) => {
  const slot = chosenSlot(state as Draft<GameState>)
  if (slot) for (const e of slot.enemies) e.defense += 1
}

// --- registry ---------------------------------------------------------------

/** Raw handlers keyed by mission id; wrapped below with each mission's keyword. */
const RAW: Record<string, (ctx: EffectContext) => Decision | void> = {
  barracks,
  border: borderRecoverMinus,
  mountain_pass: mountainPassScout,
  valley: valleyRecoverPlus,
  railroad_bridge: railroadBridgeDiscardElsewhere,
  officer: officerRemoveSpy,
  villa: civiliansPerUndefeatedEnemy,
  bunker: bunkerDiscardHandMaquis,
  supply_convoy: supplyConvoyDiscardEachOther,
  prison: recruitToHiddenDiscard,
  cg_headquarters: civiliansPerUndefeatedEnemy,
  caves: cavesAddSpy,
  farmhouse_e2: revealedPileToHiddenDiscard,
  train_depot_e2: trainDepotNoReveal,
  farmhouse_e3: removeRandomHiddenMaquis,
  train_depot_e3: trainDepotOneReveal,
  crossroads: crossroadsDiscardInPlay,
  police_station: policeStationSift,
  mayor_house: mayorHousePlusDefense,
  franco_hq: civiliansPerUndefeatedEnemy,
}

/** Wrap a raw handler so it runs only on its mission's keyword trigger and only when the chosen
 *  Mission's effect is not being ignored (Pilar). */
function onMissionTrigger(keyword: Keyword, fn: (ctx: EffectContext) => Decision | void): EffectHandler {
  return (ctx) => {
    if (ctx.args.trigger !== keyword) return
    if ((ctx.state as Draft<GameState>).ignoreMissionEffect) return
    return fn(ctx)
  }
}

export const MISSION_EFFECTS: Record<string, EffectHandler> = Object.fromEntries(
  Object.entries(RAW).map(([id, fn]) => {
    const kw = missionKeyword.get(id)
    if (!kw) throw new Error(`mission effect: unknown mission id '${id}'`)
    return [missionEffectId(id), onMissionTrigger(kw, fn)]
  }),
)

// Sanity: a handler exists for every mission in the data.
for (const m of missionsData) {
  if (!(missionEffectId(m.id) in MISSION_EFFECTS)) {
    throw new Error(`mission effect missing for '${m.id}'`)
  }
}

/** Register the mission effects. Explicit, like the PLAN/ATTACK/enemy effects. */
export function registerMissionEffects(): void {
  for (const [id, handler] of Object.entries(MISSION_EFFECTS)) registerEffect(id, handler)
}
