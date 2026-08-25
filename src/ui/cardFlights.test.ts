import { describe, expect, it } from 'vitest'
import { createGame } from '../engine/setup'
import { applyAction } from '../engine/actions'
import { registerPlanEffects, PLAN_EFFECTS } from '../engine/effects/plan'
import { unregisterEffect } from '../engine/effects/registry'
import { afterAll, beforeAll } from 'vitest'
import { handFlightMoves } from './cardFlights'
import type { GameState } from '../engine'

beforeAll(() => registerPlanEffects())
afterAll(() => {
  for (const id of Object.keys(PLAN_EFFECTS)) unregisterEffect(id)
})

const isSpy = (c: { dataId: string }) => c.dataId === 'spy'

function seedWithCelia(): GameState {
  for (let seed = 1; seed <= 1000; seed++) {
    const s = createGame({ seed })
    if (s.hand.some((c) => c.dataId === 'celia')) return s
  }
  throw new Error('no Celia seed')
}

describe('handFlightMoves', () => {
  it('flies the dumped Spy to Hidden discard when Celia draws nothing', () => {
    let s = seedWithCelia()
    const spy = s.hidden.deck.find(isSpy) ?? s.hand.find(isSpy)
    if (!spy) throw new Error('need a Spy')
    if (!s.hand.some(isSpy)) {
      s.hand.push(s.hidden.deck.splice(s.hidden.deck.findIndex(isSpy), 1)[0])
    }
    s.removedFromGame.push(...s.hidden.deck, ...s.hidden.discard)
    s.hidden.deck = []
    s.hidden.discard = []
    const celia = s.hand.find((c) => c.dataId === 'celia')!
    s = applyAction(s, { type: 'PlayMaquis', uid: celia.uid, side: 'hidden' })
    const dumped = s.hand.find(isSpy)!
    const after = applyAction(s, { type: 'UseAction', uid: s.inPlay.find((m) => m.dataId === 'celia')!.uid })

    expect(handFlightMoves(s, after)).toEqual([
      { uid: dumped.uid, dataId: 'spy', dir: 'out', zone: 'hidden.discard' },
    ])
    expect(after.hidden.discard.some((c) => c.uid === dumped.uid)).toBe(true)
    expect(after.hand.some((c) => c.uid === dumped.uid)).toBe(false)
  })
})
