import { describe, it, expect } from 'vitest'
import { clientInLayoutRect, layoutFromClient } from './useCardSlide'

const box = { left: 100, top: 50, right: 200, bottom: 150 }

describe('card-slide hit testing vs CSS zoom', () => {
  it('at 100% scale, layout rects match client coordinates', () => {
    expect(clientInLayoutRect(150, 100, box, 1)).toBe(true)
    expect(clientInLayoutRect(99, 100, box, 1)).toBe(false)
    expect(layoutFromClient(150, 100, 1)).toEqual({ x: 150, y: 100 })
  })

  it('at 140% scale, client (visual) coords are compared against rect × zoom', () => {
    // Layout point (150, 100) appears at (210, 140) on screen.
    expect(clientInLayoutRect(210, 140, box, 1.4)).toBe(true)
    // A point past the unscaled rect but still inside the zoomed rect.
    expect(clientInLayoutRect(250, 180, box, 1.4)).toBe(true)
    expect(clientInLayoutRect(250, 180, box, 1)).toBe(false)
    expect(layoutFromClient(210, 140, 1.4)).toEqual({ x: 150, y: 100 })
  })
})
