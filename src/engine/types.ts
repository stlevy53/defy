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
  /** The printed Defense of this copy. `defense` may be modified in-round (Benigno/Engineer/
   *  Mayor's House); it is restored to this value when the enemy reshuffles back into the deck. */
  baseDefense: number
  faceUp: boolean
}

/** A Maquis committed to the table this round, as hidden or revealed. */
export interface MaquisInPlay {
  uid: string
  dataId: string
  side: Side
  /** Card actions fire at most once per round; set when UseAction resolves. */
  actionUsed: boolean
}

/** An available-mission slot. A failed mission stays in its slot flipped face-down. */
export interface MissionSlot {
  uid: string
  dataId: string
  faceDown: boolean
  /** Set when the mission is defeated as a target during ATTACK. The physical move to the
   *  Defeated Missions pile (and slot refill) happens in AFTERMATH. */
  defeated: boolean
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

  /** Cards removed from the game entirely (e.g. a Spy removed by Manuela/Manuel).
   *  Never returns to play; tracked only so the conservation invariant still balances. */
  removedFromGame: CardInstance[]

  chosenMissionUid: string | null
  /** Attack points banked this round (base attack of played Maquis + ATTACK-action bonuses),
   *  spent down by SpendAttackOn. Reset each round in RECOVER. */
  attackStrength: number
  /** Per-round override of the chosen Mission's Defense (e.g. Ricardo halves it). null = use the
   *  static value. Cleared at ChooseMission. */
  missionDefenseOverride: number | null
  /** ATTACK-phase reveal limit from the chosen Mission's DEFEND effect (Train Depot). null =
   *  unlimited; 0 = none; 1 = one. Cleared at ChooseMission. */
  attackRevealLimit: number | null
  /** Maquis revealed during the ATTACK phase this round (checked against attackRevealLimit). */
  revealedInAttack: number
  /** Set by Pilar (revealed): ignore the chosen Mission's effect this round. Reset in RECOVER. */
  ignoreMissionEffect: boolean
  recoverDrawModifier: number
  failedMissions: number

  pendingDecision: Decision | null
  effectQueue: EffectTask[]
  result: GameResult | null
  log: string[]
}
