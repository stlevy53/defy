// Type definitions for Resist! card data.
// These mirror the JSON in /data and are the shared vocabulary for the rules engine (Phase 2).

export type ActionType = 'PLAN' | 'ATTACK' | 'PLAN/ATTACK'
export type Keyword = 'DEFEND' | 'DEFEAT' | 'SURVIVE'

/** One side (Hidden or Revealed) of a Maquis card. `actionType`/`action` are null when the side shows an X. */
export interface MaquisSide {
  attack: number
  actionType: ActionType | null
  action: string | null
}

export interface MaquisCard {
  id: string
  name: string
  hidden: MaquisSide
  revealed: MaquisSide
}

export interface MissionCard {
  id: string
  name: string
  era: 1 | 2 | 3
  garrison: number
  defense: number
  victoryPoints: number
  keyword: Keyword
  effect: string
}

/** An enemy type. Within a type the effect is identical; `defenseValues` lists the Defense of each physical copy. */
export interface EnemyType {
  id: string
  name: string
  keyword: Keyword
  effect: string
  count: number
  defenseValues: number[]
}

export interface CivilianCard {
  id: string
  civilians: number
  special: boolean
  effect: string | null
}

export interface SpyCard {
  id: string
  name: string
  attack: number
  actionType: null
  action: null
}
