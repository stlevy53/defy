// Core state model for the Resist! rules engine. All types are plain JSON-serializable data.

export type Side = 'hidden' | 'revealed'
export type Phase = 'PLAN' | 'ATTACK' | 'AFTERMATH' | 'RECOVER' | 'GAME_OVER'

/** A physical card instance in play, distinct from its static data row in /data. */
export interface CardInstance {
  uid: string       // unique per instance
  dataId: string    // reference into static data (maquis id, mission id, civilian id, or 'spy')
}

/** An enemy card instance — carries the Defense of the specific physical copy. */
export interface EnemyInstance {
  uid: string
  typeId: string    // enemy type id (e.g. 'guard')
  defense: number
  faceUp: boolean
}

/** A Maquis committed to the table this round, as hidden or revealed. */
export interface MaquisInPlay {
  uid: string
  dataId: string
  side: Side
}

/** An available-mission slot. A failed mission stays in its slot flipped face-down. */
export interface MissionSlot {
  uid: string
  dataId: string
  faceDown: boolean
  enemies: EnemyInstance[]
}

export interface GameResult {
  outcome: 'win' | 'loss'
  tier?: string      // scoring tier on a win
  points?: number
  reason?: string    // cause on a loss
}

// --- Interaction & effect scaffolding (expanded in later slices) ---

export type Decision =
  | { kind: 'selectCards'; from: string; min: number; max: number; prompt: string; candidates: string[] }
  | { kind: 'selectTarget'; candidates: string[]; prompt: string }
  | { kind: 'orderCards'; cards: string[]; prompt: string }
  | { kind: 'chooseOption'; options: string[]; prompt: string }

export interface DecisionResponse {
  selection: string[]
}

/** A queued unit of effect resolution. Plain data so state stays serializable. */
export interface EffectTask {
  effectId: string
  sourceUid: string
  args?: Record<string, unknown>
}

export type Action =
  | { type: 'PlayMaquis'; uid: string; side: Side }
  | { type: 'UseAction'; uid: string }
  | { type: 'ChooseMission'; uid: string }
  | { type: 'SpendAttackOn'; targetUid: string }
  | { type: 'AdvancePhase' }
  | { type: 'EndResistance' }
  | { type: 'Continue' }

export interface GameState {
  rng: number
  phase: Phase
  round: number

  hidden: { deck: CardInstance[]; discard: CardInstance[] }
  recruit: { deck: CardInstance[]; revealed: CardInstance[] }
  hand: CardInstance[]

  inPlay: MaquisInPlay[]

  missionRow: MissionSlot[]
  missionDeck: CardInstance[]
  defeatedMissions: CardInstance[]

  enemyDeck: EnemyInstance[]
  enemyDiscard: EnemyInstance[]

  civilianDeck: CardInstance[]
  graveyard: CardInstance[]

  spiesAvailable: number

  chosenMissionUid: string | null
  recoverDrawModifier: number
  failedMissions: number

  pendingDecision: Decision | null
  effectQueue: EffectTask[]
  result: GameResult | null
  log: string[]
}
