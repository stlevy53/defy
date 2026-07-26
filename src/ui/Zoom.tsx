// A lightweight card-zoom lightbox. Right-clicking a card (see Card.tsx) opens an enlarged,
// read-only view so players can read the text without changing any left-click game interaction.
// The overlay is generic: callers hand it whatever node to show; dismiss on click / right-click / Esc.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type ZoomFn = (content: ReactNode) => void

const ZoomContext = createContext<ZoomFn>(() => {})

/** Open an enlarged view. Call from a card's `onContextMenu` handler. */
export function useZoom(): ZoomFn {
  return useContext(ZoomContext)
}

export function ZoomProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null)
  const open = useCallback((c: ReactNode) => setContent(c), [])
  const close = useCallback(() => setContent(null), [])

  useEffect(() => {
    if (!content) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [content, close])

  return (
    <ZoomContext.Provider value={open}>
      {children}
      {content && (
        <div
          className="zoom-overlay"
          onClick={close}
          onContextMenu={(e) => {
            e.preventDefault()
            close()
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="zoom-inner">{content}</div>
          <div className="zoom-hint">Click anywhere or press Esc to close</div>
        </div>
      )}
    </ZoomContext.Provider>
  )
}
