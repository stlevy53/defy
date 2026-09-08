// Dismissable look-through for a face-up pile. Reuses DecisionCard so pile cards match the
// off-board choice window. Not a decision — Escape / click-outside / X close it. May sit on top
// of a pending choice (you can spread the discard while Domingo's top-three are still in hand).

import { useEffect, type MouseEvent } from 'react'
import type { GameState } from '../engine'
import { DecisionCard } from './DecisionModal'
import { spyArt } from './cardArt'
import { useZoom } from './Zoom'
import { inspectUids, pileById, spySupplyCount, type PileId } from './pileInspect'

export function PileInspect({
  pileId,
  state,
  onClose,
}: {
  pileId: PileId
  state: GameState
  onClose: () => void
}) {
  const pile = pileById(state, pileId)
  const uids = inspectUids(state, pileId)
  const spyCopies = pileId === 'spy.supply' ? spySupplyCount(state) : 0
  const empty = pileId === 'spy.supply' ? spyCopies === 0 : uids.length === 0
  const spyNote =
    pileId === 'hidden.discard' && pile?.spyCount
      ? `${pile.spyCount} ${pile.spyCount === 1 ? 'Spy' : 'Spies'} · newest on top`
      : 'newest on top'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="pile-inspect-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={pile?.label ?? 'Pile'}
      onClick={onClose}
    >
      <div className="dm pile-inspect" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="whatsnew-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="dm-head">
          <h2 className="dm-title">{pile?.label ?? 'Pile'}</h2>
          {!empty && <span className="dm-hint">({spyNote})</span>}
        </div>
        {empty ? (
          <p className="dm-empty">Nothing here yet.</p>
        ) : pileId === 'spy.supply' ? (
          <div className="dm-cards">
            {Array.from({ length: spyCopies }, (_, i) => (
              <SpySupplyCard key={i} />
            ))}
          </div>
        ) : (
          <div className="dm-cards">
            {uids.map((uid) => (
              <DecisionCard key={uid} state={state} uid={uid} inspect />
            ))}
          </div>
        )}
        <div className="dm-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function SpySupplyCard() {
  const openZoom = useZoom()
  const art = spyArt()
  const zoom = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openZoom(art ? <img className="zoom-art" src={art} alt="Spy" draggable={false} /> : <div className="zoom-card"><h2>Spy</h2></div>)
  }
  return (
    <button type="button" className="dm-card spy inspect" onClick={zoom} onContextMenu={zoom} title="Click or right-click to zoom">
      {art ? <img className="dm-art" src={art} alt="Spy" draggable={false} /> : <div className="dm-card-name">Spy</div>}
    </button>
  )
}
