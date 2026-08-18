import { describe, it, expect } from 'vitest'
import { maquis, missions, enemyTypes, civilians, spyCount } from './index'

describe('card data loads and is complete', () => {
  it('has 24 Maquis', () => {
    expect(maquis).toHaveLength(24)
  })

  it('has 20 Missions across eras 1/2/3 (8/6/6)', () => {
    expect(missions).toHaveLength(20)
    const byEra = missions.reduce<Record<number, number>>((acc, m) => {
      acc[m.era] = (acc[m.era] ?? 0) + 1
      return acc
    }, {})
    expect(byEra).toEqual({ 1: 8, 2: 6, 3: 6 })
  })

  // Printed era on the current Card Assets sheets is gospel. Missions.jpg = Era 1,
  // Missions 2.jpg = Era 2, Missions 3.jpg = Era 3. JSON must follow those photos.
  it('mission eras match the printed Card Assets sheets', () => {
    const ids = (era: 1 | 2 | 3) =>
      missions
        .filter((m) => m.era === era)
        .map((m) => m.id)
        .sort()
    expect(ids(1)).toEqual(
      [
        'barracks',
        'border',
        'bunker',
        'mountain_pass',
        'officer',
        'railroad_bridge',
        'valley',
        'villa',
      ].sort(),
    )
    expect(ids(2)).toEqual(
      ['caves', 'cg_headquarters', 'farmhouse_e2', 'prison', 'supply_convoy', 'train_depot_e2'].sort(),
    )
    expect(ids(3)).toEqual(
      ['crossroads', 'farmhouse_e3', 'franco_hq', 'mayor_house', 'police_station', 'train_depot_e3'].sort(),
    )
  })

  it('has 32 Enemies across its types', () => {
    const total = enemyTypes.reduce((sum, t) => sum + t.count, 0)
    expect(total).toBe(32)
    for (const t of enemyTypes) {
      expect(t.defenseValues).toHaveLength(t.count)
    }
  })

  it('has 8 Civilians and 6 Spies', () => {
    expect(civilians).toHaveLength(8)
    expect(spyCount).toBe(6)
  })
})
