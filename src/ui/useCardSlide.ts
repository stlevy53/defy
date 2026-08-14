// Pointer-based card sliding: grab a Maquis and drop it on Hidden or Revealed.
// Click-without-a-drag is left alone so the existing half-clicks still play/move.
//
// Hit-testing vs CSS `zoom`: getBoundingClientRect() is layout (unzoomed) pixels — the same space
// as `position: fixed`. Pointer clientX/Y are visual (zoomed). Multiply rects by scale to compare
// against the pointer; divide the pointer by scale to place a fixed ghost. See HANDOFF.md.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export type Side = 'hidden' | 'revealed'

export type SlideKind = 'play' | 'move'

export interface CardSlide {
  uid: string
  dataId: string
  kind: SlideKind
  /** Current side, when sliding a card already on the table. */
  from?: Side
  x: number
  y: number
  width: number
  height: number
  over: Side | null
}

const THRESHOLD = 8

export function clientInLayoutRect(
  clientX: number,
  clientY: number,
  rect: { left: number; right: number; top: number; bottom: number },
  scale: number,
): boolean {
  return (
    clientX >= rect.left * scale &&
    clientX <= rect.right * scale &&
    clientY >= rect.top * scale &&
    clientY <= rect.bottom * scale
  )
}

export function layoutFromClient(clientX: number, clientY: number, scale: number): { x: number; y: number } {
  return { x: clientX / scale, y: clientY / scale }
}

function dropSideUnder(clientX: number, clientY: number, scale: number): Side | null {
  const nodes = document.querySelectorAll<HTMLElement>('[data-drop-side]')
  for (const el of nodes) {
    const side = el.dataset.dropSide
    if (side !== 'hidden' && side !== 'revealed') continue
    if (clientInLayoutRect(clientX, clientY, el.getBoundingClientRect(), scale)) return side
  }
  return null
}

function suppressNextClick(): void {
  const eat = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    document.removeEventListener('click', eat, true)
  }
  document.addEventListener('click', eat, true)
}

export function useCardSlide({
  scale,
  canPlay,
  canMove,
  onPlay,
  onMove,
}: {
  scale: number
  canPlay: (uid: string, side: Side) => boolean
  canMove: (uid: string, side: Side) => boolean
  onPlay: (uid: string, side: Side) => void
  onMove: (uid: string, side: Side) => void
}): {
  slide: CardSlide | null
  beginPlay: (e: ReactPointerEvent, uid: string, dataId: string) => void
  beginMove: (e: ReactPointerEvent, uid: string, dataId: string, from: Side) => void
} {
  const [slide, setSlide] = useState<CardSlide | null>(null)
  const armed = useRef<{
    uid: string
    dataId: string
    kind: SlideKind
    from?: Side
    startX: number
    startY: number
    width: number
    height: number
    dragging: boolean
  } | null>(null)
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const canPlayRef = useRef(canPlay)
  canPlayRef.current = canPlay
  const canMoveRef = useRef(canMove)
  canMoveRef.current = canMove
  const onPlayRef = useRef(onPlay)
  onPlayRef.current = onPlay
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  const clear = useCallback(() => {
    armed.current = null
    setSlide(null)
    document.body.classList.remove('sliding-card')
  }, [])

  const begin = useCallback(
    (e: ReactPointerEvent, payload: { uid: string; dataId: string; kind: SlideKind; from?: Side }) => {
      if (e.button !== 0) return
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      armed.current = {
        ...payload,
        startX: e.clientX,
        startY: e.clientY,
        width: r.width,
        height: r.height,
        dragging: false,
      }
    },
    [],
  )

  useEffect(() => {
    const onMovePtr = (e: PointerEvent) => {
      const a = armed.current
      if (!a) return
      const dx = e.clientX - a.startX
      const dy = e.clientY - a.startY
      if (!a.dragging) {
        if (dx * dx + dy * dy < THRESHOLD * THRESHOLD) return
        a.dragging = true
        document.body.classList.add('sliding-card')
      }
      e.preventDefault()
      const s = scaleRef.current
      const { x, y } = layoutFromClient(e.clientX, e.clientY, s)
      const over = dropSideUnder(e.clientX, e.clientY, s)
      setSlide({
        uid: a.uid,
        dataId: a.dataId,
        kind: a.kind,
        from: a.from,
        x,
        y,
        width: a.width,
        height: a.height,
        over,
      })
    }

    const onUp = (e: PointerEvent) => {
      const a = armed.current
      if (!a) return
      if (a.dragging) {
        suppressNextClick()
        const s = scaleRef.current
        const over = dropSideUnder(e.clientX, e.clientY, s)
        const legal =
          over &&
          (a.kind === 'play' ? canPlayRef.current(a.uid, over) : canMoveRef.current(a.uid, over) && over !== a.from)
        if (over && legal) {
          if (a.kind === 'play') onPlayRef.current(a.uid, over)
          else onMoveRef.current(a.uid, over)
        }
      }
      clear()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && armed.current) {
        if (armed.current.dragging) suppressNextClick()
        clear()
      }
    }

    window.addEventListener('pointermove', onMovePtr)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMovePtr)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [clear])

  const beginPlay = useCallback(
    (e: ReactPointerEvent, uid: string, dataId: string) => begin(e, { uid, dataId, kind: 'play' }),
    [begin],
  )
  const beginMove = useCallback(
    (e: ReactPointerEvent, uid: string, dataId: string, from: Side) =>
      begin(e, { uid, dataId, kind: 'move', from }),
    [begin],
  )

  return { slide, beginPlay, beginMove }
}
