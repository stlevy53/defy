// Hover-peek: a large read-only preview of a hand or committed art-mode Maquis, positioned
// `fixed` from the hovered card's rect so overflow on the lanes/hand can't clip it.
// Right-click zoom is the sticky look; this glance must vanish the moment the pointer leaves.

import { useEffect, useState, type RefObject } from 'react'

export const PEEK_CARD_SEL = '.card.hand-card.has-art[data-peek-id], .card.played.has-art[data-peek-id]'

export type HoverPeek = { dataId: string; x: number; y: number; width: number }

type ClosestHost = { closest: (selectors: string) => Element | null }

/** Walk to an element that can `closest()`, including a text-node relatedTarget. */
export function closestPeekCard(node: EventTarget | null, sel = PEEK_CARD_SEL): Element | null {
  if (node == null) return null
  const host = node as Partial<ClosestHost> & { parentElement?: ClosestHost | null }
  if (typeof host.closest === 'function') return host.closest(sel)
  const parent = host.parentElement
  if (parent && typeof parent.closest === 'function') return parent.closest(sel)
  return null
}

/** True when the pointer left this peek card — not when it moved between the card's children,
 *  and not when it entered a different peek card (that retargets via pointerover). */
export function leftPeekCard(
  from: EventTarget | null,
  related: EventTarget | null,
  sel = PEEK_CARD_SEL,
): boolean {
  const card = closestPeekCard(from, sel)
  if (!card) return false
  const to = closestPeekCard(related, sel)
  return to !== card && to == null
}

export function peekFromCard(el: {
  getAttribute: (name: string) => string | null
  getBoundingClientRect: () => { left: number; top: number; width: number }
}): HoverPeek | null {
  const dataId = el.getAttribute('data-peek-id')
  if (!dataId) return null
  const r = el.getBoundingClientRect()
  return { dataId, x: r.left + r.width / 2, y: r.top, width: r.width }
}

export function useHoverPeek(rootRef: RefObject<HTMLElement | null>): HoverPeek | null {
  const [peek, setPeek] = useState<HoverPeek | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let hovered: Element | null = null

    const show = (card: Element) => {
      const next = peekFromCard(card)
      if (!next) return
      hovered = card
      setPeek(next)
    }
    const hide = () => {
      hovered = null
      setPeek(null)
    }

    const onOver = (e: PointerEvent) => {
      const card = closestPeekCard(e.target)
      if (!card) return
      show(card)
    }
    const onOut = (e: PointerEvent) => {
      if (!leftPeekCard(e.target, e.relatedTarget)) return
      hide()
    }

    root.addEventListener('pointerover', onOver)
    root.addEventListener('pointerout', onOut)
    // Right-click zoom covers the table without a pointerout on the card underneath.
    root.addEventListener('contextmenu', hide)
    // Scroll (hand, lanes, window) leaves the card's measured rect stale — and often skips pointerout.
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    document.addEventListener('pointerleave', hide)

    // Playing / discarding the hovered card removes it; pointerout frequently never fires.
    const mo = new MutationObserver(() => {
      if (hovered && !hovered.isConnected) hide()
    })
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      hovered = null
      root.removeEventListener('pointerover', onOver)
      root.removeEventListener('pointerout', onOut)
      root.removeEventListener('contextmenu', hide)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
      document.removeEventListener('pointerleave', hide)
      mo.disconnect()
    }
  }, [rootRef])

  return peek
}
