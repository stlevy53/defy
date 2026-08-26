import { describe, expect, it } from 'vitest'
import type { GameRecord } from './profile'
import {
  deriveStats,
  officialScoreSeries,
  personalRecords,
  progressScoreSeries,
  tierLevel,
} from './stats'

/** Minimal GameRecord factory — only the fields a given test cares about, sensible defaults else. */
function rec(over: Partial<GameRecord> = {}): GameRecord {
  return {
    playedAt: 0,
    seed: 1,
    draft: false,
    outcome: 'loss',
    defeatedVp: 0,
    round: 1,
    failedMissions: 0,
    civiliansLost: 0,
    missionsDefeated: [],
    ...over,
  }
}

const win = (over: Partial<GameRecord> = {}) =>
  rec({ outcome: 'win', tier: 'Victory', points: 20, defeatedVp: 20, ...over })

describe('tierLevel', () => {
  it('orders tiers low to high, unknown as -1', () => {
    expect(tierLevel('Draw')).toBe(0)
    expect(tierLevel('Epic Victory')).toBe(4)
    expect(tierLevel('Major Victory')).toBeGreaterThan(tierLevel('Victory'))
    expect(tierLevel(undefined)).toBe(-1)
    expect(tierLevel('Nonsense')).toBe(-1)
  })
})

describe('deriveStats — LOCKED 2 semantics', () => {
  it('counts a Draw as a win (undefeated), not a loss', () => {
    const s = deriveStats([win({ tier: 'Draw', points: 3, defeatedVp: 3 }), rec({ outcome: 'loss', reason: 'spies' })])
    expect(s.wins).toBe(1)
    expect(s.losses).toBe(1)
    expect(s.undefeatedRate).toBe(0.5)
    expect(s.tierCounts.Draw).toBe(1)
  })

  it('best/avg VP use official win points only (losses excluded)', () => {
    const s = deriveStats([
      win({ points: 15, defeatedVp: 15 }),
      win({ points: 25, defeatedVp: 25, tier: 'Major Victory' }),
      rec({ outcome: 'loss', reason: 'civilians', defeatedVp: 18 }), // an 18-VP collapse must NOT count
    ])
    expect(s.bestPoints).toBe(25)
    expect(s.avgPoints).toBe(20) // (15 + 25) / 2, loss ignored
  })

  it('tracks the highest tier reached and loss-reason breakdown', () => {
    const s = deriveStats([
      win({ tier: 'Minor Victory', points: 16, defeatedVp: 16 }),
      win({ tier: 'Epic Victory', points: 20, defeatedVp: 20 }),
      rec({ outcome: 'loss', reason: 'civilians' }),
      rec({ outcome: 'loss', reason: 'civilians' }),
      rec({ outcome: 'loss', reason: 'missions' }),
    ])
    expect(s.bestTier).toBe('Epic Victory')
    expect(s.lossReasonCounts.civilians).toBe(2)
    expect(s.lossReasonCounts.missions).toBe(1)
    expect(s.lossReasonCounts.spies).toBe(0)
  })

  it('is safe on an empty career', () => {
    const s = deriveStats([])
    expect(s.gamesPlayed).toBe(0)
    expect(s.undefeatedRate).toBe(0)
    expect(s.bestPoints).toBeNull()
    expect(s.avgPoints).toBeNull()
    expect(s.bestTier).toBeNull()
  })
})

describe('score series — LOCKED 2 traps', () => {
  it('official series omits losses (no zero-plotting)', () => {
    const games = [win({ points: 20, defeatedVp: 20 }), rec({ outcome: 'loss', defeatedVp: 18 }), win({ points: 22, defeatedVp: 22 })]
    const off = officialScoreSeries(games)
    expect(off.map((p) => p.value)).toEqual([20, 22])
    expect(off.map((p) => p.index)).toEqual([1, 3]) // keeps chronological x so the gap shows
  })

  it('progress series plots every game by defeatedVp', () => {
    const games = [win({ defeatedVp: 20 }), rec({ outcome: 'loss', defeatedVp: 18 })]
    const prog = progressScoreSeries(games)
    expect(prog.map((p) => p.value)).toEqual([20, 18])
  })
})

describe('personalRecords', () => {
  it('picks bests and firsts, tolerating an empty career', () => {
    expect(personalRecords([]).highestVp).toBeNull()

    const epicEarly = win({ tier: 'Epic Victory', points: 20, defeatedVp: 20, round: 6, playedAt: 100, seed: 111 })
    const majorLater = win({ tier: 'Major Victory', points: 24, defeatedVp: 24, round: 9, playedAt: 200, seed: 222 })
    const bigLoss = rec({ outcome: 'loss', reason: 'spies', defeatedVp: 19, round: 12, playedAt: 300 })
    const r = personalRecords([epicEarly, majorLater, bigLoss])

    expect(r.highestVp?.points).toBe(24) // most official VP
    expect(r.bestTier?.tier).toBe('Epic Victory') // tier rank beats raw points
    expect(r.longestSurvival?.round).toBe(12) // includes the loss
    expect(r.shortestWin?.round).toBe(6) // fewest rounds among wins
    expect(r.bestLossProgress?.defeatedVp).toBe(19)
    expect(r.firstEpic?.seed).toBe(111)
    expect(r.firstMajor?.seed).toBe(222)
  })
})
