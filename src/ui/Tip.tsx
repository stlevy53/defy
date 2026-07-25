// Lightweight CSS hover tooltip. Wraps an icon/stat/badge and reveals `text` on hover, styled to
// match the app (native `title` tooltips are slow and easy to miss). Pure CSS — no JS state.

import type { ReactNode } from 'react'

/** Wrap `children` so hovering shows `text`. Set `below` for elements near the top edge (e.g. the
 *  header) so the bubble opens downward instead of clipping off-screen. */
export function Tip({ text, below, children }: { text: string; below?: boolean; children: ReactNode }) {
  return (
    <span className={`tip${below ? ' below' : ''}`} data-tip={text}>
      {children}
    </span>
  )
}
