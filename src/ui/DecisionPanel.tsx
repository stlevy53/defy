// Renders the engine's pendingDecision and collects a response. Covers all four decision kinds.

import { useState } from 'react'
import type { Decision, GameState } from '../engine'
import { describeUid, describeUidTip, boardPickable } from './format'

interface Props {
  decision: Decision
  state: GameState
  onRespond: (selection: string[]) => void
}

/** A candidate card whose face explains its attributes on hover (name-only chips leave a new
 *  player guessing what "Pilar" or "Ramona" actually does). */
function CardChip({
  uid,
  label,
  tip,
  className,
  onClick,
}: {
  uid: string
  label: string
  tip: string
  className: string
  onClick: () => void
}) {
  return (
    <button key={uid} className={`${className} tip`} data-tip={tip} onClick={onClick}>
      {label}
    </button>
  )
}

export function DecisionPanel({ decision, state, onRespond }: Props) {
  const label = (uid: string) => describeUid(state, uid)
  const tip = (uid: string) => describeUidTip(state, uid)

  // Decisions answered by picking exactly one card are made on the board (App highlights the
  // candidates); the panel just prompts and lists any candidates the board can't show.
  if (decision.kind === 'selectTarget') {
    return <SinglePick prompt={decision.prompt} candidates={decision.candidates} state={state} label={label} tip={tip} onRespond={onRespond} />
  }

  if (decision.kind === 'chooseOption') {
    return (
      <div className="decision">
        <p className="decision-prompt">{decision.prompt}</p>
        <div className="chips">
          {decision.options.map((opt) => (
            <button key={opt} className="chip" onClick={() => onRespond([opt])}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (decision.kind === 'selectCards') {
    if (decision.min === 1 && decision.max === 1) {
      return <SinglePick prompt={decision.prompt} candidates={decision.candidates} state={state} label={label} tip={tip} onRespond={onRespond} />
    }
    return <SelectCards decision={decision} label={label} tip={tip} onRespond={onRespond} />
  }
  return <OrderCards decision={decision} label={label} tip={tip} onRespond={onRespond} />
}

/** Prompt for a pick-exactly-one decision. Candidates the board renders are clicked there; any
 *  others (deck peeks, the Revealed pile, face-down Enemies) remain clickable chips here. */
function SinglePick({
  prompt,
  candidates,
  state,
  label,
  tip,
  onRespond,
}: {
  prompt: string
  candidates: string[]
  state: GameState
  label: (uid: string) => string
  tip: (uid: string) => string
  onRespond: (selection: string[]) => void
}) {
  const panelCandidates = candidates.filter((uid) => !boardPickable(state, uid))
  const anyOnBoard = panelCandidates.length < candidates.length
  return (
    <div className="decision">
      <p className="decision-prompt">{prompt}</p>
      {anyOnBoard && <p className="board-hint">Click a highlighted card on the board to choose.</p>}
      {panelCandidates.length > 0 && (
        <div className="chips">
          {panelCandidates.map((uid) => (
            <CardChip key={uid} uid={uid} label={label(uid)} tip={tip(uid)} className="chip" onClick={() => onRespond([uid])} />
          ))}
        </div>
      )}
    </div>
  )
}

function SelectCards({
  decision,
  label,
  tip,
  onRespond,
}: {
  decision: Extract<Decision, { kind: 'selectCards' }>
  label: (uid: string) => string
  tip: (uid: string) => string
  onRespond: (selection: string[]) => void
}) {
  const { min, max, candidates } = decision
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (uid: string) =>
    setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : p.length < max ? [...p, uid] : p))
  const valid = picked.length >= min && picked.length <= max
  const rangeLabel = min === max ? `${min}` : `${min}–${max}`
  const canSelectAll = candidates.length > 1 && max >= candidates.length

  return (
    <div className="decision">
      <p className="decision-prompt">
        {decision.prompt} <span className="muted">(choose {rangeLabel})</span>
      </p>
      <div className={`pick-count ${valid ? 'ok' : ''}`}>{picked.length}/{max} selected</div>
      <div className="chips">
        {candidates.map((uid) => (
          <CardChip
            key={uid}
            uid={uid}
            label={label(uid)}
            tip={tip(uid)}
            className={`chip ${picked.includes(uid) ? 'chip-on' : ''}`}
            onClick={() => toggle(uid)}
          />
        ))}
        {candidates.length === 0 && <span className="muted">no candidates</span>}
      </div>
      <div className="row">
        <button className="confirm" disabled={!valid} onClick={() => onRespond(picked)}>
          Confirm {picked.length > 0 ? `(${picked.length})` : min === 0 ? '(none)' : ''}
        </button>
        {canSelectAll && (
          <button className="ghost" disabled={picked.length === candidates.length} onClick={() => setPicked([...candidates])}>
            Select all
          </button>
        )}
        {max > 1 && picked.length > 0 && (
          <button className="ghost" onClick={() => setPicked([])}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

function OrderCards({
  decision,
  label,
  tip,
  onRespond,
}: {
  decision: Extract<Decision, { kind: 'orderCards' }>
  label: (uid: string) => string
  tip: (uid: string) => string
  onRespond: (selection: string[]) => void
}) {
  const [order, setOrder] = useState<string[]>([])
  const remaining = decision.cards.filter((uid) => !order.includes(uid))
  const complete = order.length === decision.cards.length

  return (
    <div className="decision">
      <p className="decision-prompt">
        {decision.prompt} <span className="muted">(click in order — first = top)</span>
      </p>
      {order.length > 0 && (
        <p className="order-preview">
          {order.map((uid, i) => (
            <button
              key={uid}
              className="order-item tip"
              data-tip={`${tip(uid)}\n\nClick to remove from the order`}
              onClick={() => setOrder((o) => o.filter((x) => x !== uid))}
            >
              {i + 1}. {label(uid)} ✕
            </button>
          ))}
        </p>
      )}
      <div className="chips">
        {remaining.map((uid) => (
          <CardChip key={uid} uid={uid} label={label(uid)} tip={tip(uid)} className="chip" onClick={() => setOrder((o) => [...o, uid])} />
        ))}
        {remaining.length === 0 && <span className="muted">all placed</span>}
      </div>
      <div className="row">
        <button className="confirm" disabled={!complete} onClick={() => onRespond(order)}>
          Confirm order
        </button>
        {order.length > 0 && (
          <button className="ghost" onClick={() => setOrder([])}>
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
