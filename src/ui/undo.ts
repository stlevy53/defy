// Undo policy for the UI history stack. The engine has no undo; this is what the Undo button
// consults so a player cannot take back information they have already seen.

import type { GameState } from '../engine'

function faceUpEnemyUids(state: GameState): Set<string> {
  const ids = new Set<string>()
  for (const m of state.missionRow) {
    for (const e of m.enemies) {
      if (e.faceUp) ids.add(e.uid)
    }
  }
  return ids
}

/** True once this round's Mission is chosen and its garrison has been (or was) exposed. */
export function missionGarrisonCommitted(state: GameState): boolean {
  if (state.chosenMissionUid == null) return false
  const slot = state.missionRow.find((m) => m.uid === state.chosenMissionUid)
  if (slot?.enemies.some((e) => e.faceUp)) return true
  // ChooseMission flipped them; AdvancePhase then empties the slot on the way to AFTERMATH.
  if (state.phase !== 'PLAN' && state.phase !== 'ATTACK') return true
  return false
}

function wouldHideRevealedEnemies(prev: GameState, current: GameState): boolean {
  const then = faceUpEnemyUids(prev)
  for (const id of faceUpEnemyUids(current)) {
    if (!then.has(id)) return true
  }
  return false
}

function wouldUnchooseRevealedMission(prev: GameState, current: GameState): boolean {
  if (!missionGarrisonCommitted(current)) return false
  return !(missionGarrisonCommitted(prev) && prev.chosenMissionUid === current.chosenMissionUid)
}

/** True when popping the last history entry would not hide revealed Enemies or un-choose a seen Mission. */
export function canPopUndo(history: GameState[]): boolean {
  if (history.length <= 1) return false
  const current = history[history.length - 1]
  const prev = history[history.length - 2]
  if (wouldHideRevealedEnemies(prev, current)) return false
  if (wouldUnchooseRevealedMission(prev, current)) return false
  return true
}

/**
 * Pop the last move. If that lands on a targeting prompt that an action just opened (UseAction →
 * pick an Enemy), pop that prompt too so the card's action resets. Stops before a prompt that
 * itself revealed Enemies (scout / ChooseMission) — those stay locked.
 */
export function popUndo(history: GameState[]): GameState[] {
  if (!canPopUndo(history)) return history
  let next = history.slice(0, -1)
  const top = next[next.length - 1]
  const openedByAction =
    next.length >= 2 && top.pendingDecision != null && next[next.length - 2].pendingDecision == null
  if (openedByAction && canPopUndo(next)) next = next.slice(0, -1)
  return next
}
