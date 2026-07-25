// The single card-rendering seam. Every card face in the app is drawn here.
//
// Today each face is text rendered from the /data JSON. When art assets arrive, this is the ONE
// file to change: swap the text bodies below for <img> faces (keeping the same outer wrappers +
// state classes for selection/defeat/face-down overlays) and the rest of the UI is untouched.

import type { GameState, MissionSlot, EnemyInstance } from '../engine'
import { missionOf, nameOfMaquis, maquisAttack, maquisSideAction, enemyOf, keywordTip } from './format'
import { Tip } from './Tip'

export type CardFace =
  | { kind: 'maquisHand'; dataId: string }
  | { kind: 'maquisPlayed'; dataId: string; side: 'hidden' | 'revealed' }
  | { kind: 'mission'; slot: MissionSlot; state: GameState }

/** Render any card face. Discriminated on `kind` so callers pass only what that face needs. */
export function Card(face: CardFace) {
  switch (face.kind) {
    case 'maquisHand':
      return <MaquisHandFace dataId={face.dataId} />
    case 'maquisPlayed':
      return <MaquisPlayedFace dataId={face.dataId} side={face.side} />
    case 'mission':
      return <MissionFace slot={face.slot} state={face.state} />
  }
}

/** A Maquis (or Spy) in hand: both sides shown, since the player hasn't committed to one yet. */
function MaquisHandFace({ dataId }: { dataId: string }) {
  const isSpy = dataId === 'spy'
  return (
    <div className={`card hand-card ${isSpy ? 'spy' : ''}`}>
      <div className="card-name">{nameOfMaquis(dataId)}</div>
      {!isSpy && (
        <>
          <Tip text="Attack value — the strength this Maquis adds, played Hidden (H) vs. Revealed (R).">
            <div className="card-sub">
              H {maquisAttack(dataId, 'hidden')} · R {maquisAttack(dataId, 'revealed')}
            </div>
          </Tip>
          <ActionLine dataId={dataId} side="hidden" label="H" />
          <ActionLine dataId={dataId} side="revealed" label="R" />
        </>
      )}
    </div>
  )
}

/** A Maquis committed to the table on a known side. */
function MaquisPlayedFace({ dataId, side }: { dataId: string; side: 'hidden' | 'revealed' }) {
  return (
    <div className={`card played ${side}`}>
      <div className="card-name">{nameOfMaquis(dataId)}</div>
      <Tip text="Attack value — the Attack Strength this Maquis contributes on this side.">
        <span className="card-sub">⚔ {maquisAttack(dataId, side)}</span>
      </Tip>
      <ActionLine dataId={dataId} side={side} />
    </div>
  )
}

function MissionFace({ slot, state }: { slot: MissionSlot; state: GameState }) {
  const data = missionOf(slot.dataId)
  const chosen = state.chosenMissionUid === slot.uid
  const defense = chosen && state.missionDefenseOverride != null ? state.missionDefenseOverride : data?.defense
  const cls = ['card', 'mission', chosen ? 'chosen' : '', slot.faceDown ? 'failed' : '', slot.defeated ? 'defeated' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls}>
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

/** One Maquis side's action, inline. Renders nothing when the side has no action (an X). */
function ActionLine({ dataId, side, label }: { dataId: string; side: 'hidden' | 'revealed'; label?: string }) {
  const a = maquisSideAction(dataId, side)
  if (!a) return null
  return (
    <div className="card-action">
      <span className="action-type">
        {label ? `${label} · ` : ''}
        {a.type}
      </span>
      <span className="action-text">{a.text}</span>
    </div>
  )
}
