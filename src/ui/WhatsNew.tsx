// "What's New" launch modal. Shown when the app opens so a playtester sees what changed since the
// previous build, then dismisses it to play. Reads the latest entry from patchNotes.ts. Standard on
// every prototype build — updating patchNotes.ts is all it takes to refresh this.

import { useEffect } from 'react'
import { LATEST } from './patchNotes'

export function WhatsNew({ onClose }: { onClose: () => void }) {
  // Dismiss on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="whatsnew-overlay" role="dialog" aria-modal="true" aria-label="What's new in this build">
      <div className="whatsnew-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="whatsnew-panel">
        <button className="whatsnew-x" onClick={onClose} aria-label="Dismiss">
          ✕
        </button>
        <div className="whatsnew-head">
          <span className="whatsnew-kicker">What’s New</span>
          <h2 className="whatsnew-title">RESIST! {LATEST.title ? `— ${LATEST.title}` : ''}</h2>
          <p className="whatsnew-ver">
            v{LATEST.version} · {LATEST.date}
          </p>
        </div>
        <ul className="whatsnew-list">
          {LATEST.changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
        <button className="whatsnew-cta" onClick={onClose}>
          Start playing →
        </button>
      </div>
    </div>
  )
}
