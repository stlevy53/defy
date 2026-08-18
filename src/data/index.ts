// Central card-data loader. Imports the validated JSON from /data and exposes it typed.
import maquisJson from '../../data/maquis.json'
import missionsJson from '../../data/missions.json'
import enemiesJson from '../../data/enemies.json'
import civiliansJson from '../../data/civilians.json'
import spiesJson from '../../data/spies.json'
import rulesJson from '../../data/rules.json'
import type {
  MaquisCard,
  MissionCard,
  EnemyType,
  CivilianCard,
  SpyCard,
} from '../types'

export const maquis = maquisJson.cards as MaquisCard[]
export const missions = missionsJson.cards as MissionCard[]
export const eraNames: Record<1 | 2 | 3, string> = {
  1: missionsJson.eraNames['1'],
  2: missionsJson.eraNames['2'],
  3: missionsJson.eraNames['3'],
}
export const enemyTypes = enemiesJson.types as EnemyType[]
export const civilians = civiliansJson.cards as CivilianCard[]
export const spy = spiesJson.card as SpyCard
export const spyCount = spiesJson.count
export const rules = rulesJson

export const cardData = {
  maquis,
  missions,
  enemyTypes,
  civilians,
  spy,
  spyCount,
  rules,
} as const
