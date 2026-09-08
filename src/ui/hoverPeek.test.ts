import { describe, expect, it } from 'vitest'
import { PEEK_CARD_SEL, closestPeekCard, leftPeekCard, peekFromCard } from './hoverPeek'

function card(id: string) {
  const el = {
    id,
    closest: (sel: string) => (sel === PEEK_CARD_SEL ? el : null),
  }
  return el
}

describe('closestPeekCard', () => {
  it('walks a child to the matching card', () => {
    const host = card('a')
    const child = { closest: (sel: string) => host.closest(sel) }
    expect(closestPeekCard(child as unknown as EventTarget)).toBe(host)
  })

  it('uses parentElement when the target has no closest (text node)', () => {
    const host = card('a')
    const text = { parentElement: host }
    expect(closestPeekCard(text as unknown as EventTarget)).toBe(host)
  })

  it('returns null off a peek card and for a null target', () => {
    expect(closestPeekCard(null)).toBe(null)
    expect(closestPeekCard({ closest: () => null } as unknown as EventTarget)).toBe(null)
  })
})

describe('leftPeekCard', () => {
  it('stays open while the pointer moves between children of the same card', () => {
    const host = card('a')
    const child = { closest: () => host }
    const otherChild = { closest: () => host }
    expect(leftPeekCard(child as unknown as EventTarget, otherChild as unknown as EventTarget)).toBe(false)
  })

  it('does not hide when entering another peek card (pointerover retargets)', () => {
    const a = card('a')
    const b = card('b')
    expect(leftPeekCard(a as unknown as EventTarget, b as unknown as EventTarget)).toBe(false)
  })

  it('hides immediately when leaving onto empty space or out of the window', () => {
    const host = card('a')
    const outside = { closest: () => null }
    expect(leftPeekCard(host as unknown as EventTarget, outside as unknown as EventTarget)).toBe(true)
    expect(leftPeekCard(host as unknown as EventTarget, null)).toBe(true)
  })

  it('ignores pointerout that did not start on a peek card', () => {
    const outside = { closest: () => null }
    expect(leftPeekCard(outside as unknown as EventTarget, null)).toBe(false)
  })
})

describe('peekFromCard', () => {
  it('centres the peek on the card rect', () => {
    const el = {
      getAttribute: (name: string) => (name === 'data-peek-id' ? 'consuelo' : null),
      getBoundingClientRect: () => ({ left: 100, top: 40, width: 80 }),
    }
    expect(peekFromCard(el)).toEqual({ dataId: 'consuelo', x: 140, y: 40, width: 80 })
  })

  it('skips a card with no peek id', () => {
    const el = {
      getAttribute: () => null,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 10 }),
    }
    expect(peekFromCard(el)).toBe(null)
  })
})
