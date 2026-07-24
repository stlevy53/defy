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
