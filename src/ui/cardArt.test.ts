import { describe, it, expect } from 'vitest'
import { enemyArt, enemyBackArt } from './cardArt'
import { enemyTypes } from '../data'

describe('enemyArt', () => {
  it('has a type photo for every Enemy type', () => {
    for (const t of enemyTypes) {
      expect(enemyArt(t.id), t.id).toBeTruthy()
    }
  })

  it('has a distinct photo for every printed Defense of a type', () => {
    for (const t of enemyTypes) {
      const byDefense = [...new Set(t.defenseValues)]
      const urls = byDefense.map((d) => enemyArt(t.id, d))
      for (const [i, d] of byDefense.entries()) {
        expect(urls[i], `${t.id}_${d}`).toBeTruthy()
      }
      expect(new Set(urls).size, t.id).toBe(byDefense.length)
    }
  })

  it('looks up guard_1 / guard_2 / guard_3 as different faces', () => {
    const g1 = enemyArt('guard', 1)
    const g2 = enemyArt('guard', 2)
    const g3 = enemyArt('guard', 3)
    expect(g1).toBeTruthy()
    expect(g2).toBeTruthy()
    expect(g3).toBeTruthy()
    expect(g1).not.toBe(g2)
    expect(g2).not.toBe(g3)
    expect(g1).not.toBe(g3)
  })

  it('has a face-down Enemy back', () => {
    expect(enemyBackArt()).toBeTruthy()
  })
})
