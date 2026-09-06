import { describe, it, expect } from 'vitest'
import { enemyArt, enemyBackArt } from './cardArt'
import { enemyTypes } from '../data'

describe('enemyArt', () => {
  it('has a type photo for every Enemy type', () => {
    for (const t of enemyTypes) {
      expect(enemyArt(t.id), t.id).toBeTruthy()
    }
  })

  it('falls back to the type photo when no per-copy file exists', () => {
    const typePhoto = enemyArt('grunt')
    expect(typePhoto).toBeTruthy()
    // No grunt_1.jpg / grunt_2.jpg in the tree today — lookup must still resolve.
    expect(enemyArt('grunt', 1)).toBe(typePhoto)
    expect(enemyArt('grunt', 2)).toBe(typePhoto)
  })

  it('has a face-down Enemy back', () => {
    expect(enemyBackArt()).toBeTruthy()
  })
})
