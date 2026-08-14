import { describe, it, expect } from 'vitest'
import {
  COACH_BEATS,
  COACH_SEEN_KEY,
  WHATS_NEW_SEEN_KEY,
  hasCompletedCoach,
  shouldAutoShowCoach,
  shouldAutoShowWhatsNew,
  markCoachFinished,
} from './coachLaunch'
import type { StorageLike } from './coachLaunch'
import { isDraftPromptEnabled, setDraftPromptEnabled } from './draftPref'

function mem(init: Record<string, string> = {}): StorageLike {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v)
    },
  }
}

describe('coach launch states', () => {
  it('has six beats', () => {
    expect(COACH_BEATS).toHaveLength(6)
  })

  it('first ever — What’s New on launch; coach is due after it closes', () => {
    const s = mem()
    expect(shouldAutoShowWhatsNew('0.1.6', s)).toBe(true)
    expect(shouldAutoShowCoach('0.1.6', s)).toBe(false)
    expect(hasCompletedCoach(s)).toBe(false)
  })

  it('after What’s New is dismissed and the coach is still due — coach on launch', () => {
    const s = mem({ [WHATS_NEW_SEEN_KEY]: '0.1.6' })
    expect(shouldAutoShowWhatsNew('0.1.6', s)).toBe(false)
    expect(shouldAutoShowCoach('0.1.6', s)).toBe(true)
  })

  it('returning on a new build, coach never finished — What’s New, then coach after close', () => {
    const s = mem({ [WHATS_NEW_SEEN_KEY]: '0.1.5' })
    expect(shouldAutoShowWhatsNew('0.1.6', s)).toBe(true)
    expect(shouldAutoShowCoach('0.1.6', s)).toBe(false)
    expect(hasCompletedCoach(s)).toBe(false)
  })

  it('returning on the same build after finishing the coach — board, nothing auto-shown', () => {
    const s = mem({ [WHATS_NEW_SEEN_KEY]: '0.1.6', [COACH_SEEN_KEY]: '1' })
    expect(shouldAutoShowCoach('0.1.6', s)).toBe(false)
    expect(shouldAutoShowWhatsNew('0.1.6', s)).toBe(false)
    expect(hasCompletedCoach(s)).toBe(true)
  })

  it('finishing or skipping the coach writes both keys so neither overlay returns', () => {
    const s = mem()
    markCoachFinished('0.1.6', s)
    expect(s.getItem(COACH_SEEN_KEY)).toBe('1')
    expect(s.getItem(WHATS_NEW_SEEN_KEY)).toBe('0.1.6')
    expect(shouldAutoShowCoach('0.1.6', s)).toBe(false)
    expect(shouldAutoShowWhatsNew('0.1.6', s)).toBe(false)
  })
})

describe('draft prompt preference', () => {
  it('defaults to on', () => {
    expect(isDraftPromptEnabled(mem())).toBe(true)
  })

  it('can be turned off and back on', () => {
    const s = mem()
    setDraftPromptEnabled(false, s)
    expect(isDraftPromptEnabled(s)).toBe(false)
    setDraftPromptEnabled(true, s)
    expect(isDraftPromptEnabled(s)).toBe(true)
  })
})
