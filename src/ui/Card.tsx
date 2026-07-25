// The single card-rendering seam. Every card face in the app is drawn here.
//
// Today each face is text rendered from the /data JSON. When art assets arrive, this is the ONE
// file to change: swap the text bodies below for <img> faces (keeping the same outer wrappers +
// state classes for selection/defeat/face-down overlays) and the rest of the UI is untouched.

import type { KeyboardEvent } from 'react'
import type { GameState, MissionSlot, EnemyInstance } from '../engine'
import { missionOf, nameOfMaquis, maquisAttack, maquisSideAction, enemyOf, keywordTip } from './format'
import { Tip } from './Tip'

type Side = 'hidden' | 'revealed'

export type CardFace =
  | {
      kind: 'maquisHand'
      dataId: string
      uid: string
      canPlayHidden: boolean
      canPlayRevealed: boolean
      onPlay: (uid: string, side: Side) => void
      /** True when this card is a candidate for the pending decision — click it to answer. */
      pickable?: boolean
      onPick?: (uid: string) => void
    }
  | {
      kind: 'maquisPlayed'
      dataId: string
      uid: string
      side: Side
      canUse?: boolean
      onUse?: () => void
      pickable?: boolean
      onPick?: (uid: string) => void
    }
  | {
      kind: 'mission'
      slot: MissionSlot
      state: GameState
      canChoose?: boolean
      onChoose?: (uid: string) => void
      /** UIDs (the Mission and/or its Enemies) that are legal SpendAttackOn targets right now. */
      strikeTargets?: string[]
      onStrike?: (uid: string) => void
      /** UIDs (the Mission and/or its Enemies) that are pending-decision candidates — click to pick. */
      pickTargets?: string[]
      onPick?: (uid: string) => void
    }

/** Render any card face. Discriminated on `kind` so callers pass only what that face needs. */
export function Card(face: CardFace) {
  switch (face.kind) {
    case 'maquisHand':
      return (
        <MaquisHandFace
          dataId={face.dataId}
          uid={face.uid}
          canPlayHidden={face.canPlayHidden}
          canPlayRevealed={face.canPlayRevealed}
          onPlay={face.onPlay}
          pickable={face.pickable}
          onPick={face.onPick}
        />
      )
    case 'maquisPlayed':
      return (
        <MaquisPlayedFace
          dataId={face.dataId}
          uid={face.uid}
          side={face.side}
          canUse={face.canUse}
          onUse={face.onUse}
          pickable={face.pickable}
          onPick={face.onPick}
        />
      )
    case 'mission':
      return (
        <MissionFace
          slot={face.slot}
          state={face.state}
          canChoose={face.canChoose}
          onChoose={face.onChoose}
          strikeTargets={face.strikeTargets}
          onStrike={face.onStrike}
          pickTargets={face.pickTargets}
          onPick={face.onPick}
        />
      )
  }
}

/** A Maquis in hand shown as its two sides — click the Hidden (left) or Revealed (right) panel to
 *  play that side. Spies aren't playable, so they render as a plain, non-interactive card. */
function MaquisHandFace({
  dataId,
  uid,
  canPlayHidden,
  canPlayRevealed,
  onPlay,
  pickable,
  onPick,
}: {
  dataId: string
  uid: string
  canPlayHidden: boolean
  canPlayRevealed: boolean
  onPlay: (uid: string, side: Side) => void
  pickable?: boolean
  onPick?: (uid: string) => void
}) {
  if (dataId === 'spy') {
    return (
      <div className="card hand-card spy">
        <div className="card-name">Spy</div>
        <div className="spy-note">Can't be played — sits in hand until Recover.</div>
      </div>
    )
  }
  const pick = pickable && onPick ? () => onPick(uid) : null
  return (
    <div
      className={`card hand-card ${pick ? 'pickable' : ''}`}
      onClick={pick ?? undefined}
      role={pick ? 'button' : undefined}
      tabIndex={pick ? 0 : undefined}
      title={pick ? `Select ${nameOfMaquis(dataId)}` : undefined}
      onKeyDown={pick ? (e) => onEnter(e, pick) : undefined}
    >
      {pick && <div className="click-hint">Click to select</div>}
      <div className="card-name">{nameOfMaquis(dataId)}</div>
      <div className="sides">
        <SidePanel dataId={dataId} side="hidden" enabled={canPlayHidden} onPlay={() => onPlay(uid, 'hidden')} />
        <SidePanel dataId={dataId} side="revealed" enabled={canPlayRevealed} onPlay={() => onPlay(uid, 'revealed')} />
      </div>
    </div>
  )
}

/** Shared keyboard handler: activate a click-run on Enter/Space. */
function onEnter(e: KeyboardEvent, run: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    run()
  }
}

/** One clickable side of a hand Maquis (its attack value + action), playable when `enabled`. */
function SidePanel({
  dataId,
  side,
  enabled,
  onPlay,
}: {
  dataId: string
  side: Side
  enabled: boolean
  onPlay: () => void
}) {
  const action = maquisSideAction(dataId, side)
  return (
    <button
      type="button"
      className={`side-panel ${side}`}
      disabled={!enabled}
      onClick={onPlay}
      title={enabled ? `Play ${nameOfMaquis(dataId)} — ${side}` : undefined}
    >
      <div className="side-tag">{side === 'hidden' ? 'Hidden' : 'Revealed'}</div>
      <div className="side-attack">⚔ {maquisAttack(dataId, side)}</div>
      {action ? (
        <div className="side-action">
          <span className="side-action-type">{action.type}</span> {action.text}
        </div>
      ) : (
        <div className="side-action none">no action</div>
      )}
    </button>
  )
}

/** A Maquis committed to the table on a known side. Its action is clickable when it can be fired
 *  in the current phase (`canUse`); otherwise it renders as plain reference text. */
function MaquisPlayedFace({
  dataId,
  uid,
  side,
  canUse,
  onUse,
  pickable,
  onPick,
}: {
  dataId: string
  uid: string
  side: Side
  canUse?: boolean
  onUse?: () => void
  pickable?: boolean
  onPick?: (uid: string) => void
}) {
  const action = maquisSideAction(dataId, side)
  const pick = pickable && onPick ? () => onPick(uid) : null
  return (
    <div
      className={`card played ${side} ${pick ? 'pickable' : ''}`}
      onClick={pick ?? undefined}
      role={pick ? 'button' : undefined}
      tabIndex={pick ? 0 : undefined}
      title={pick ? `Select ${nameOfMaquis(dataId)}` : undefined}
      onKeyDown={pick ? (e) => onEnter(e, pick) : undefined}
    >
      {pick && <div className="click-hint">Click to select</div>}
      <div className="card-name">{nameOfMaquis(dataId)}</div>
      <Tip text="Attack value — the Attack Strength this Maquis contributes on this side.">
        <span className="card-sub">⚔ {maquisAttack(dataId, side)}</span>
      </Tip>
      {action &&
        (canUse && onUse ? (
          <button
            type="button"
            className="card-action usable"
            onClick={onUse}
            title={`Use ${nameOfMaquis(dataId)}'s action`}
          >
            <span className="action-type">{action.type} ▸ use</span>
            <span className="action-text">{action.text}</span>
          </button>
        ) : (
          <div className="card-action">
            <span className="action-type">{action.type}</span>
            <span className="action-text">{action.text}</span>
          </div>
        ))}
    </div>
  )
}

function MissionFace({
  slot,
  state,
  canChoose,
  onChoose,
  strikeTargets,
  onStrike,
  pickTargets,
  onPick,
}: {
  slot: MissionSlot
  state: GameState
  canChoose?: boolean
  onChoose?: (uid: string) => void
  strikeTargets?: string[]
  onStrike?: (uid: string) => void
  pickTargets?: string[]
  onPick?: (uid: string) => void
}) {
  const data = missionOf(slot.dataId)
  const chosen = state.chosenMissionUid === slot.uid
  const defense = chosen && state.missionDefenseOverride != null ? state.missionDefenseOverride : data?.defense
  const name = data?.name ?? slot.dataId

  // The whole card is clickable for exactly one reason at a time (they live in different moments):
  // choose it to attack (PLAN), strike it (ATTACK), or pick it as a decision target.
  const canStrikeMission = !!onStrike && (strikeTargets?.includes(slot.uid) ?? false)
  const canPickMission = !!onPick && (pickTargets?.includes(slot.uid) ?? false)
  const act =
    canChoose && onChoose
      ? { run: () => onChoose(slot.uid), hint: 'Click to attack', title: `Attack this Mission: ${name}` }
      : canStrikeMission
        ? { run: () => onStrike!(slot.uid), hint: 'Click to strike', title: `Strike this Mission: ${name}` }
        : canPickMission
          ? { run: () => onPick!(slot.uid), hint: 'Click to select', title: `Select this Mission: ${name}` }
          : null

  const cls = [
    'card',
    'mission',
    chosen ? 'chosen' : '',
    slot.faceDown ? 'failed' : '',
    slot.defeated ? 'defeated' : '',
    act ? 'actionable' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={cls}
      onClick={act?.run}
      role={act ? 'button' : undefined}
      tabIndex={act ? 0 : undefined}
      title={act?.title}
      onKeyDown={
        act
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                act.run()
              }
            }
          : undefined
      }
    >
      {act && <div className="click-hint">{act.hint}</div>}
      {slot.defeated && (
        <div className="defeated-stamp" aria-label="Mission defeated">
          <span className="defeated-word">Defeated</span>
          <span className="defeated-vp">+{data?.victoryPoints} VP</span>
        </div>
      )}
      <div className="card-head">
        <span className="card-name">{data?.name ?? slot.dataId}</span>
        <Tip text={keywordTip(data?.keyword)}>
          <span className={`kw kw-${data?.keyword}`}>{data?.keyword}</span>
        </Tip>
      </div>
      <div className="mission-stats">
        <Tip text="Defense — the Attack Strength needed to defeat this Mission.">
          <span>🛡 {defense}</span>
        </Tip>
        <Tip text="Victory Points — scored when you defeat this Mission.">
          <span>★ {data?.victoryPoints}</span>
        </Tip>
        <Tip text="Garrison — how many Enemies guard this Mission.">
          <span>☗ {data?.garrison}</span>
        </Tip>
      </div>
      <p className="effect">{data?.effect}</p>
      <div className="enemies">
        {slot.enemies.map((e) => (
          <EnemyChip
            key={e.uid}
            enemy={e}
            canStrike={!!onStrike && (strikeTargets?.includes(e.uid) ?? false)}
            onStrike={onStrike ? () => onStrike(e.uid) : undefined}
            canPick={!!onPick && (pickTargets?.includes(e.uid) ?? false)}
            onPick={onPick ? () => onPick(e.uid) : undefined}
          />
        ))}
        {slot.enemies.length === 0 && <span className="muted">clear</span>}
      </div>
    </div>
  )
}

function EnemyChip({
  enemy,
  canStrike,
  onStrike,
  canPick,
  onPick,
}: {
  enemy: EnemyInstance
  canStrike?: boolean
  onStrike?: () => void
  canPick?: boolean
  onPick?: () => void
}) {
  const type = enemyOf(enemy.typeId)
  if (!enemy.faceUp) {
    return <span className="enemy facedown">🂠</span>
  }
  const body = (
    <>
      <div className="enemy-head">
        <Tip text={keywordTip(type?.keyword)}>
          <span className={`kw kw-${type?.keyword}`}>{type?.keyword}</span>
        </Tip>
        <span className="enemy-name">{type?.name}</span>
        <Tip text="Defense — the Attack Strength needed to defeat this Enemy.">
          <span className="enemy-def">🛡 {enemy.defense}</span>
        </Tip>
      </div>
      {type?.effect && <div className="enemy-effect">{type.effect}</div>}
    </>
  )
  // A legal target during ATTACK: click to strike. stopPropagation so the click doesn't also bubble
  // to the Mission card (which may itself be a strike target).
  if (canStrike && onStrike) {
    return (
      <button
        type="button"
        className={`enemy faceup strikeable kw-${type?.keyword}`}
        onClick={(e) => {
          e.stopPropagation()
          onStrike()
        }}
        title={`Strike ${type?.name} (cost ${enemy.defense})`}
      >
        {body}
      </button>
    )
  }
  // A pending-decision candidate: click to pick it. stopPropagation so the pick doesn't bubble to a
  // pickable Mission card.
  if (canPick && onPick) {
    return (
      <button
        type="button"
        className={`enemy faceup pickable kw-${type?.keyword}`}
        onClick={(e) => {
          e.stopPropagation()
          onPick()
        }}
        title={`Select ${type?.name}`}
      >
        {body}
      </button>
    )
  }
  return <div className={`enemy faceup kw-${type?.keyword}`}>{body}</div>
}
