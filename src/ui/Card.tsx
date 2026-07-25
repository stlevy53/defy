// The single card-rendering seam. Every card face in the app is drawn here.
//
// Today each face is text rendered from the /data JSON. When art assets arrive, this is the ONE
// file to change: swap the text bodies below for <img> faces (keeping the same outer wrappers +
// state classes for selection/defeat/face-down overlays) and the rest of the UI is untouched.

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
    }
  | { kind: 'maquisPlayed'; dataId: string; side: Side; canUse?: boolean; onUse?: () => void }
  | { kind: 'mission'; slot: MissionSlot; state: GameState; canChoose?: boolean; onChoose?: (uid: string) => void }

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
        />
      )
    case 'maquisPlayed':
      return <MaquisPlayedFace dataId={face.dataId} side={face.side} canUse={face.canUse} onUse={face.onUse} />
    case 'mission':
      return <MissionFace slot={face.slot} state={face.state} canChoose={face.canChoose} onChoose={face.onChoose} />
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
}: {
  dataId: string
  uid: string
  canPlayHidden: boolean
  canPlayRevealed: boolean
  onPlay: (uid: string, side: Side) => void
}) {
  if (dataId === 'spy') {
    return (
      <div className="card hand-card spy">
        <div className="card-name">Spy</div>
        <div className="spy-note">Can't be played — sits in hand until Recover.</div>
      </div>
    )
  }
  return (
    <div className="card hand-card">
      <div className="card-name">{nameOfMaquis(dataId)}</div>
      <div className="sides">
        <SidePanel dataId={dataId} side="hidden" enabled={canPlayHidden} onPlay={() => onPlay(uid, 'hidden')} />
        <SidePanel dataId={dataId} side="revealed" enabled={canPlayRevealed} onPlay={() => onPlay(uid, 'revealed')} />
      </div>
    </div>
  )
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
  side,
  canUse,
  onUse,
}: {
  dataId: string
  side: Side
  canUse?: boolean
  onUse?: () => void
}) {
  const action = maquisSideAction(dataId, side)
  return (
    <div className={`card played ${side}`}>
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
}: {
  slot: MissionSlot
  state: GameState
  canChoose?: boolean
  onChoose?: (uid: string) => void
}) {
  const data = missionOf(slot.dataId)
  const chosen = state.chosenMissionUid === slot.uid
  const defense = chosen && state.missionDefenseOverride != null ? state.missionDefenseOverride : data?.defense
  const cls = [
    'card',
    'mission',
    chosen ? 'chosen' : '',
    slot.faceDown ? 'failed' : '',
    slot.defeated ? 'defeated' : '',
    canChoose ? 'choosable' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const choose = canChoose && onChoose ? () => onChoose(slot.uid) : undefined
  return (
    <div
      className={cls}
      onClick={choose}
      role={choose ? 'button' : undefined}
      tabIndex={choose ? 0 : undefined}
      title={choose ? `Attack this Mission: ${data?.name ?? slot.dataId}` : undefined}
      onKeyDown={
        choose
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                choose()
              }
            }
          : undefined
      }
    >
      {choose && <div className="choose-hint">Click to attack</div>}
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
          <EnemyChip key={e.uid} enemy={e} />
        ))}
        {slot.enemies.length === 0 && <span className="muted">clear</span>}
      </div>
    </div>
  )
}

function EnemyChip({ enemy }: { enemy: EnemyInstance }) {
  const type = enemyOf(enemy.typeId)
  if (!enemy.faceUp) {
    return <span className="enemy facedown">🂠</span>
  }
  return (
    <div className={`enemy faceup kw-${type?.keyword}`}>
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
    </div>
  )
}
