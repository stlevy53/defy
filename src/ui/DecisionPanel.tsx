// Renders the engine's pendingDecision and collects a response. Covers all four decision kinds.

import { useState } from 'react'
import type { Decision, GameState } from '../engine'
import { describeUid } from './format'

interface Props {
  decision: Decision
  state: GameState
  onRespond: (selection: string[]) => void
}

export function DecisionPanel({ decision, state, onRespond }: Props) {
  const label = (uid: string) => describeUid(state, uid)

  if (decision.kind === 'selectTarget') {
    return (
      <div className="decision">
        <p className="decision-prompt">{decision.prompt}</p>
        <div className="chips">
          {decision.candidates.map((uid) => (
            <button key={uid} className="chip" onClick={() => onRespond([uid])}>
              {label(uid)}
            </button>
          ))}
        </div>
      </div>
    )
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

  if (decision.kind === 'selectCards') return <SelectCards decision={decision} label={label} onRespond={onRespond} />
  return <OrderCards decision={decision} label={label} onRespond={onRespond} />
}

function SelectCards({
  decision,
  label,
  onRespond,
}: {
  decision: Extract<Decision, { kind: 'selectCards' }>
  label: (uid: string) => string
  onRespond: (selection: string[]) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (uid: string) =>
    setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : p.length < decision.max ? [...p, uid] : p))
  const valid = picked.length >= decision.min && picked.length <= decision.max

  return (
    <div className="decision">
      <p className="decision-prompt">
        {decision.prompt} <span className="muted">(choose {decision.min === decision.max ? decision.min : `${decision.min}–${decision.max}`})</span>
      </p>
      <div className="chips">
        {decision.candidates.map((uid) => (
          <button
            key={uid}
            className={`chip ${picked.includes(uid) ? 'chip-on' : ''}`}
            onClick={() => toggle(uid)}
          >
            {label(uid)}
          </button>
        ))}
        {decision.candidates.length === 0 && <span className="muted">no candidates</span>}
      </div>
      <button className="confirm" disabled={!valid} onClick={() => onRespond(picked)}>
        Confirm {picked.length > 0 ? `(${picked.length})` : decision.min === 0 ? '(none)' : ''}
      </button>
    </div>
  )
}

function OrderCards({
  decision,
  label,
  onRespond,
}: {
  decision: Extract<Decision, { kind: 'orderCards' }>
  label: (uid: string) => string
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
            <span key={uid} className="order-item">
              {i + 1}. {label(uid)}
            </span>
          ))}
        </p>
      )}
      <div className="chips">
        {remaining.map((uid) => (
          <button key={uid} className="chip" onClick={() => setOrder((o) => [...o, uid])}>
            {label(uid)}
          </button>
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
