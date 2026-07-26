// Guard against silent [stub] effects: every Maquis action printed on a card MUST have a handler
// registered under `maquis:{id}:{side}`. A missing one falls through to the driver's [stub] path
// and does nothing (this test was added after Sagrario/Ramona revealed shipped unregistered).

import { describe, it, expect } from 'vitest'
import { maquis } from '../../data'
import { PLAN_EFFECTS } from './plan'
import { ATTACK_EFFECTS } from './attack'
import { maquisEffectId } from './registry'

describe('effect coverage — every Maquis action has a handler', () => {
  const registered = new Set([...Object.keys(PLAN_EFFECTS), ...Object.keys(ATTACK_EFFECTS)])
  const sides = ['hidden', 'revealed'] as const

  for (const m of maquis) {
    for (const side of sides) {
      if (m[side].actionType === null) continue
      it(`${m.id}:${side} (${m[side].actionType}) is registered`, () => {
        expect(registered.has(maquisEffectId(m.id, side))).toBe(true)
      })
    }
  }
})
