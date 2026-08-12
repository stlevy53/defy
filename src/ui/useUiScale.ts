// UI scale — the player's control over how big the board renders.
//
// Implemented as CSS `zoom` on the root element rather than a font-size bump, because the layout's
// widths are in px (the #root cap, the pile rail, the card grids' column minimums) while its type is
// in rem: growing the text alone overflows containers that stay put, whereas zoom scales cards, type,
// padding and the rail together and keeps every proportion identical.
//
// Renderer-only — no preload, no IPC — so it behaves the same in the browser and in the packaged
// .exe, and the choice persists in localStorage next to the save data.

import { useCallback, useEffect, useState } from 'react'

const KEY = 'defy.uiScale'

/** Offered steps. 1 is the historical size; the top end is comfortable on a 1920-wide window. */
export const UI_SCALES: readonly number[] = [1, 1.1, 1.25, 1.4, 1.6]

const DEFAULT_SCALE = 1

function readStored(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    return UI_SCALES.includes(n) ? n : DEFAULT_SCALE
  } catch {
    return DEFAULT_SCALE // storage unavailable (private mode, quota) — run unscaled
  }
}

function apply(scale: number): void {
  // Leave the property alone at 1 so the default render path is untouched by this feature.
  document.documentElement.style.zoom = scale === DEFAULT_SCALE ? '' : String(scale)
}

/** Applies the stored scale before the first render, so a board saved at 160% doesn't flash at 100%
 *  on launch. The hook keeps it in sync from then on. */
export function applyStoredUiScale(): void {
  apply(readStored())
}

export interface UiScale {
  scale: number
  setScale: (scale: number) => void
  /** Move one step along UI_SCALES; +1 bigger, -1 smaller. Clamps at both ends. */
  step: (direction: number) => void
  reset: () => void
}

/**
 * Applies and persists the UI scale, and binds the usual zoom accelerators (Ctrl +, Ctrl -,
 * Ctrl 0). Call once, from the app root.
 */
export function useUiScale(): UiScale {
  const [scale, setScale] = useState(readStored)

  useEffect(() => {
    apply(scale)
    try {
      localStorage.setItem(KEY, String(scale))
    } catch {
      /* storage unavailable — the scale still applies for this session */
    }
  }, [scale])

  const step = useCallback((direction: number) => {
    setScale((current) => {
      const i = UI_SCALES.indexOf(current)
      const next = (i === -1 ? UI_SCALES.indexOf(DEFAULT_SCALE) : i) + Math.sign(direction)
      return UI_SCALES[Math.min(Math.max(next, 0), UI_SCALES.length - 1)]
    })
  }, [])

  const reset = useCallback(() => setScale(DEFAULT_SCALE), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      // '=' and '+' share a key; '-' arrives as '_' when shifted.
      if (e.key === '=' || e.key === '+') step(1)
      else if (e.key === '-' || e.key === '_') step(-1)
      else if (e.key === '0') reset()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, reset])

  return { scale, setScale, step, reset }
}
