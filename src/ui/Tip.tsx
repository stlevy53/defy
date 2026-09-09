// Lightweight CSS hover tooltip. Wraps an icon/stat/badge and reveals `text` on hover, styled to
// match the app (native `title` tooltips are slow and easy to miss). Pure CSS — no JS state.

import type { ReactNode } from 'react'

/** Wrap `children` so hovering shows `text`. Set `below` for elements near the top edge (e.g. the
 *  header) so the bubble opens downward instead of clipping off-screen. Set `aside` to open left
 *  and a little down — used by the All piles menu so copy isn't clipped inside the panel. */
export function Tip({
  text,
  below,
  aside,
  children,
}: {
  text: string
  below?: boolean
  aside?: boolean
  children: ReactNode
}) {
  const pos = aside ? ' aside' : below ? ' below' : ''
  return (
    <span className={`tip${pos}`} data-tip={text}>
      {children}
    </span>
  )
}
