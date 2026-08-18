// Spotlight tour of the table. Points at a `data-coach` region, says one thing, then moves on.
// Clicks on the board are blocked for the duration — looking, not taking a turn. See docs/COACH_SPEC.md.

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { COACH_BEATS } from './coachLaunch'
import { playSfx } from './audio'

interface Hole {
  top: number
  left: number
  width: number
  height: number
}

interface CardPos {
  top: number
  left: number
  width: number
}

const HOLE_PAD = 8
const CARD_GAP = 14
const VIEW_PAD = 16
const CARD_WIDTH = 380

export interface CoachBox {
  top: number
  left: number
  right: number
  bottom: number
}

export interface CoachCardPos {
  top: number
  left: number
  width: number
}

/** Visible window in the same coordinates as `position: fixed` under CSS zoom on `<html>`. */
export function visibleCoachWindow(scale: number, vw: number, vh: number): CoachBox {
  const s = scale > 0 ? scale : 1
  return { left: VIEW_PAD, top: VIEW_PAD, right: vw / s - VIEW_PAD, bottom: vh / s - VIEW_PAD }
}

/** Keep the copy card on the table column (`.board-main`), never past the visible window. */
export function coachStageBox(stage: CoachBox | null, vis: CoachBox): CoachBox {
  const box: CoachBox = {
    left: Math.max(vis.left, stage?.left ?? vis.left),
    top: Math.max(vis.top, stage?.top ?? vis.top),
    right: Math.min(vis.right, stage?.right ?? vis.right),
    bottom: Math.min(vis.bottom, stage?.bottom ?? vis.bottom),
  }
  if (box.right - box.left < 80 || box.bottom - box.top < 80) return vis
  return box
}

/** Sit next to the spotlight hole, fully inside `box` (the table play area ∩ the window). */
export function placeCoachCard(hole: Hole, cardH: number, cardW: number, box: CoachBox): CoachCardPos {
  const width = Math.min(cardW, Math.max(0, box.right - box.left))
  const minL = box.left
  const maxL = box.right - width
  const left = clamp(hole.left, minL, Math.max(minL, maxL))
  const below = hole.top + hole.height + CARD_GAP
  if (below >= box.top && below + cardH <= box.bottom) return { top: below, left, width }
  const above = hole.top - cardH - CARD_GAP
  if (above >= box.top && above + cardH <= box.bottom) return { top: above, left, width }
  return { top: clamp(hole.top, box.top, Math.max(box.top, box.bottom - cardH)), left, width }
}

function markerFor(index: number): string {
  const beat = COACH_BEATS[index]
  if (beat.id === 'zoom' && !document.querySelector('[data-coach="zoom"]')) return 'hand'
  return beat.marker
}

function readHole(index: number, bringIntoView: boolean): Hole | null {
  const el = document.querySelector(`[data-coach="${markerFor(index)}"]`)
  if (!(el instanceof HTMLElement)) return null
  if (bringIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  const r = el.getBoundingClientRect()
  return {
    top: r.top - HOLE_PAD,
    left: r.left - HOLE_PAD,
    width: r.width + HOLE_PAD * 2,
    height: r.height + HOLE_PAD * 2,
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function Coach({
  scale,
  onClose,
}: {
  /** Board-size setting — re-measure when it changes (CSS zoom does not fire `resize`). */
  scale: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [hole, setHole] = useState<Hole | null>(null)
  const [cardPos, setCardPos] = useState<CardPos>({ top: 24, left: 24, width: CARD_WIDTH })
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null)

  const measure = useCallback(
    (bringIntoView = false) => {
      const next = readHole(index, bringIntoView)
      setHole(next)
      if (!next) return
      const cardH = cardEl?.offsetHeight ?? 220
      const vis = visibleCoachWindow(scale, window.innerWidth, window.innerHeight)
      const stageEl = document.querySelector('.board-main')
      const stage =
        stageEl instanceof HTMLElement
          ? (() => {
              const r = stageEl.getBoundingClientRect()
              return { top: r.top, left: r.left, right: r.right, bottom: r.bottom }
            })()
          : null
      setCardPos(placeCoachCard(next, cardH, CARD_WIDTH, coachStageBox(stage, vis)))
    },
    [index, cardEl, scale],
  )

  useLayoutEffect(() => {
    measure(true)
  }, [measure, scale])

  // Keep the hole glued to the target if anything still scrolls, and stop the table from
  // scrolling under a fixed hole (wheel on the overlay otherwise bubbles to the page).
  useEffect(() => {
    const relayout = () => measure(false)
    const stopPageScroll = (e: Event) => {
      const t = e.target
      if (t instanceof Node && cardEl?.contains(t)) return
      e.preventDefault()
    }
    const stopKeyScroll = (e: KeyboardEvent) => {
      if (e.key === 'PageDown' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault()
      }
    }
    window.addEventListener('resize', relayout)
    window.addEventListener('scroll', relayout, true)
    window.addEventListener('wheel', stopPageScroll, { passive: false })
    window.addEventListener('touchmove', stopPageScroll, { passive: false })
    window.addEventListener('keydown', stopKeyScroll)
    return () => {
      window.removeEventListener('resize', relayout)
      window.removeEventListener('scroll', relayout, true)
      window.removeEventListener('wheel', stopPageScroll)
      window.removeEventListener('touchmove', stopPageScroll)
      window.removeEventListener('keydown', stopKeyScroll)
    }
  }, [measure, cardEl])

  const last = index === COACH_BEATS.length - 1
  const beat = COACH_BEATS[index]

  const skip = useCallback(() => {
    playSfx('play')
    onClose()
  }, [onClose])

  const next = () => {
    playSfx('play')
    if (last) onClose()
    else setIndex((i) => i + 1)
  }

  // Escape skips (and must not open Settings). Enter is handled by the focused Next button —
  // a window listener would fire as well and skip two beats.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [skip])

  return (
    <div className="coach-overlay" role="dialog" aria-modal="true" aria-label="How to play this table">
      <div className="coach-catch" />
      {hole && (
        <div
          className="coach-hole"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
        />
      )}
      <div
        ref={setCardEl}
        key={beat.id}
        className="coach-card"
        style={{ top: cardPos.top, left: cardPos.left, width: cardPos.width }}
      >
        {beat.kicker && <p className="coach-kicker">{beat.kicker}</p>}
        <h2 className="coach-title">{beat.title}</h2>
        {beat.body.map((p, i) => (
          <p key={i} className="coach-body">
            {p}
          </p>
        ))}
        <div className="coach-foot">
          <span className="coach-step">
            {index + 1} / {COACH_BEATS.length}
          </span>
          <button type="button" className="coach-skip" onClick={skip}>
            Skip
          </button>
          <button type="button" className="coach-next" onClick={next} autoFocus>
            {last ? 'Start playing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
