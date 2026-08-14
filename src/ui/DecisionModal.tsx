// Full-card decision modal. Home for any pending decision whose candidates are NOT already on the
// table — the Revealed pile, deck peeks, reorder-the-top-N, and abstract option choices. It shows
// the real cards at readable size and forces the player to see the action they must take. Board
// picks (Missions, on-board Enemies, played/hand Maquis) are unaffected — they stay in place and are
// answered by clicking the glowing card. See docs/DECISION_MODAL_SPEC.md.
//
// UI only: it reads the engine's pendingDecision and calls onRespond(selection) — no rules here.

import { useEffect, useState } from 'react'
import type { Decision, GameState } from '../engine'
import { classifyCandidate, maquisOf, enemyOf, missionOf } from './format'
import { maquisArt, enemyArt, missionArt, spyArt } from './cardArt'
import { DRAFT_FROM } from '../engine'

export function DecisionModal({
  decision,
  state,
  onRespond,
}: {
  decision: Decision
  state: GameState
  onRespond: (selection: string[]) => void
}) {
  return (
    // Not dismissable: a pending decision is mandatory, so there is no close control and Escape is
    // intentionally ignored — the required action is unmissable.
    <div className="dm-overlay" role="dialog" aria-modal="true" aria-label={decision.prompt}>
      <div className="dm">
        <DecisionBody decision={decision} state={state} onRespond={onRespond} />
      </div>
    </div>
  )
}

function DecisionBody({
  decision,
  state,
  onRespond,
}: {
  decision: Decision
  state: GameState
  onRespond: (selection: string[]) => void
}) {
  if (decision.kind === 'chooseOption') {
    return <OptionChoice prompt={decision.prompt} options={decision.options} onRespond={onRespond} />
  }
  if (decision.kind === 'orderCards') {
    return <OrderChoice prompt={decision.prompt} cards={decision.cards} state={state} onRespond={onRespond} />
  }
  if (decision.kind === 'selectCards' && decision.from === DRAFT_FROM) {
    return <DraftChoice decision={decision} state={state} onRespond={onRespond} />
  }
  const min = decision.kind === 'selectTarget' ? 1 : decision.min
  const max = decision.kind === 'selectTarget' ? 1 : decision.max
  return (
    <CardChoice
      prompt={decision.prompt}
      candidates={decision.candidates}
      state={state}
      min={min}
      max={max}
      onRespond={onRespond}
    />
  )
}

// --- Select one / many cards ---------------------------------------------------------------------

function CardChoice({
  prompt,
  candidates,
  state,
  min,
  max,
  onRespond,
}: {
  prompt: string
  candidates: string[]
  state: GameState
  min: number
  max: number
  onRespond: (selection: string[]) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const multi = max > 1
  const valid = picked.length >= min && picked.length <= max
  const rangeLabel = min === max ? `${min}` : `${min}–${max}`
  const canSelectAll = candidates.length > 1 && max >= candidates.length

  const toggle = (uid: string) =>
    setPicked((p) => {
      if (!multi) return p.includes(uid) ? [] : [uid]
      if (p.includes(uid)) return p.filter((x) => x !== uid)
      return p.length < max ? [...p, uid] : p
    })

  useEnterToConfirm(valid, () => onRespond(picked))

  return (
    <>
      <ModalHead prompt={prompt} hint={`choose ${rangeLabel}`} />
      {multi && <div className={`dm-count ${valid ? 'ok' : ''}`}>{picked.length}/{max} selected</div>}
      <div className="dm-cards">
        {candidates.map((uid) => (
          <DecisionCard
            key={uid}
            state={state}
            uid={uid}
            selected={picked.includes(uid)}
            order={multi ? picked.indexOf(uid) + 1 || undefined : undefined}
            onClick={() => toggle(uid)}
          />
        ))}
      </div>
      <div className="dm-actions">
        <button className="confirm" disabled={!valid} onClick={() => onRespond(picked)}>
          Confirm{picked.length > 0 ? ` (${picked.length})` : min === 0 ? ' (none)' : ''}
        </button>
        {canSelectAll && (
          <button className="ghost" disabled={picked.length === candidates.length} onClick={() => setPicked([...candidates])}>
            Select all
          </button>
        )}
        {multi && picked.length > 0 && (
          <button className="ghost" onClick={() => setPicked([])}>
            Clear
          </button>
        )}
      </div>
    </>
  )
}

// --- Reorder ("look at the top N, put them back in any order") ------------------------------------

function OrderChoice({
  prompt,
  cards,
  state,
  onRespond,
}: {
  prompt: string
  cards: string[]
  state: GameState
  onRespond: (selection: string[]) => void
}) {
  // Default to the order the cards are already shown in (the deck's current order), so a player who
  // is happy with it confirms in one click and is never forced to re-sequence. Clicking a placed
  // card pulls it out; clicking an unplaced card appends it — that's how you set a custom order.
  const [order, setOrder] = useState<string[]>(cards)
  const complete = order.length === cards.length
  const isShownOrder = complete && order.every((uid, i) => uid === cards[i])
  const place = (uid: string) => setOrder((o) => (o.includes(uid) ? o.filter((x) => x !== uid) : [...o, uid]))

  useEnterToConfirm(complete, () => onRespond(order))

  return (
    <>
      <ModalHead
        prompt={prompt}
        hint="in the deck's current order — Confirm to keep it, or click a card to pull it out and re-place it (first = top)"
      />
      <div className="dm-cards">
        {cards.map((uid) => (
          <DecisionCard
            key={uid}
            state={state}
            uid={uid}
            selected={order.includes(uid)}
            order={order.indexOf(uid) + 1 || undefined}
            onClick={() => place(uid)}
          />
        ))}
      </div>
      <div className="dm-actions">
        <button className="confirm" disabled={!complete} onClick={() => onRespond(order)}>
          {isShownOrder ? 'Keep this order' : 'Confirm order'}
        </button>
        {!isShownOrder && (
          <button className="ghost" onClick={() => setOrder(cards)}>
            Reset to shown order
          </button>
        )}
      </div>
    </>
  )
}

// --- Abstract option choice (not cards) ----------------------------------------------------------

function OptionChoice({
  prompt,
  options,
  onRespond,
}: {
  prompt: string
  options: string[]
  onRespond: (selection: string[]) => void
}) {
  return (
    <>
      <ModalHead prompt={prompt} />
      <div className="dm-options">
        {options.map((opt) => (
          <button key={opt} className="dm-option" onClick={() => onRespond([opt])}>
            {opt}
          </button>
        ))}
      </div>
    </>
  )
}

// --- Pieces --------------------------------------------------------------------------------------

function ModalHead({ prompt, hint }: { prompt: string; hint?: string }) {
  return (
    <div className="dm-head">
      <h2 className="dm-title">{prompt}</h2>
      {hint && <span className="dm-hint">({hint})</span>}
    </div>
  )
}

/** A full, readable, read-only card face for a decision candidate. Uses the card-art seam and falls
 *  back to the themed text face (as the rest of the app does) when no image exists. */
function DecisionCard({
  state,
  uid,
  selected,
  order,
  onClick,
}: {
  state: GameState
  uid: string
  selected: boolean
  order?: number
  onClick: () => void
}) {
  const c = classifyCandidate(state, uid)
  const cls = `dm-card ${c.kind} ${selected ? 'selected' : ''}`

  // Art vs. text is either/or, exactly as the board's card renderer does: when a card image exists
  // it IS the face (the Maquis image already carries the name + both Hidden/Revealed halves side by
  // side); until then, the themed text face is the fallback.
  const body = (() => {
    switch (c.kind) {
      case 'maquis': {
        const m = maquisOf(c.dataId)!
        const art = maquisArt(c.dataId)
        if (art) return <img className="dm-art" src={art} alt={m.name} draggable={false} />
        return (
          <>
            <div className="dm-card-name">{m.name}</div>
            <div className="dm-sides">
              {(['hidden', 'revealed'] as const).map((side) => (
                <div key={side} className={`dm-side ${side}`}>
                  <div className="dm-side-top">
                    <span className="dm-side-label">{side}</span>
                    <span className="dm-atk">{m[side].attack}</span>
                  </div>
                  <p className="dm-effect">
                    {m[side].action ? (
                      <>
                        {m[side].actionType && <b>{m[side].actionType}: </b>}
                        {m[side].action}
                      </>
                    ) : (
                      <span className="muted">No action</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </>
        )
      }
      case 'enemy': {
        const t = enemyOf(c.enemy.typeId)
        const art = enemyArt(c.enemy.typeId)
        if (art) return <img className="dm-art" src={art} alt={t?.name ?? c.enemy.typeId} draggable={false} />
        return (
          <>
            <div className="dm-card-name">
              {t?.name ?? c.enemy.typeId} <span className="dm-def">Def {c.enemy.defense}</span>
            </div>
            {t?.keyword && <div className="dm-keyword">{t.keyword}</div>}
            {t?.effect && <p className="dm-effect">{t.effect}</p>}
          </>
        )
      }
      case 'mission': {
        const m = missionOf(c.slot.dataId)
        const art = missionArt(c.slot.dataId)
        if (art) return <img className="dm-art" src={art} alt={m?.name ?? c.slot.dataId} draggable={false} />
        return (
          <>
            <div className="dm-card-name">{m?.name ?? c.slot.dataId}</div>
            <div className="dm-stats">
              Def {m?.defense} · ★ {m?.victoryPoints} · Garrison {m?.garrison}
              {m?.keyword ? ` · ${m.keyword}` : ''}
            </div>
            {m?.effect && <p className="dm-effect">{m.effect}</p>}
          </>
        )
      }
      case 'spy': {
        const art = spyArt()
        if (art) return <img className="dm-art" src={art} alt="Spy" draggable={false} />
        return (
          <>
            <div className="dm-card-name">Spy</div>
            <p className="dm-effect muted">Cannot be played; clogs your hand until Recover.</p>
          </>
        )
      }
      case 'unknown':
        return <div className="dm-card-name">{c.label}</div>
    }
  })()

  return (
    <button type="button" className={cls} onClick={onClick} aria-pressed={selected}>
      {order !== undefined && <span className="dm-order">{order}</span>}
      {body}
    </button>
  )
}

function DraftChoice({
  decision,
  state,
  onRespond,
}: {
  decision: Extract<Decision, { kind: 'selectCards' }>
  state: GameState
  onRespond: (selection: string[]) => void
}) {
  const pick = state.hidden.deck.length + 1
  return (
    <>
      <ModalHead prompt={`Hidden deck — pick ${pick} of 12`} hint="click one" />
      <p className="dm-draft-note">
        Click the Maquis you want in your Hidden deck. The other card goes to Recruit.
      </p>
      <div className="dm-cards dm-draft-pair">
        {decision.candidates.map((uid) => (
          <div key={uid} className="dm-draft-slot">
            <DecisionCard state={state} uid={uid} selected={false} onClick={() => onRespond([uid])} />
            <span className="dm-draft-cap">Goes to Hidden</span>
          </div>
        ))}
      </div>
    </>
  )
}

/** Enter confirms when the current selection is valid. */
function useEnterToConfirm(valid: boolean, confirm: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && valid) {
        e.preventDefault()
        confirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [valid, confirm])
}
