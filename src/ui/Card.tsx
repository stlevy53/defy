// The single card-rendering seam. Every card face in the app is drawn here.
//
// Today each face is text rendered from the /data JSON. When art assets arrive, this is the ONE
// file to change: swap the text bodies below for <img> faces (keeping the same outer wrappers +
// state classes for selection/defeat/face-down overlays) and the rest of the UI is untouched.

import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import type { GameState, MissionSlot, EnemyInstance } from '../engine'
import { missionOf, nameOfMaquis, maquisAttack, maquisSideAction, enemyOf, keywordTip } from './format'
import { maquisArt, enemyArt, enemyBackArt, missionArt, spyArt } from './cardArt'
import { Tip } from './Tip'
import { useZoom } from './Zoom'

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
      /** Live value of a count-based ATTACK action (e.g. Abel hidden's +1/revealed Maquis), or null. */
      liveBonus?: number | null
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
      /** Enemy uids just added to this Mission (a reinforcement) — animated in when present. */
      newEnemyUids?: string[]
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
          liveBonus={face.liveBonus}
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
          newEnemyUids={face.newEnemyUids}
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
  const zoom = useMaquisZoom(dataId)
  if (dataId === 'spy') {
    const spyImg = spyArt()
    if (spyImg) {
      return (
        <div className="card hand-card has-art spy" onContextMenu={zoom}>
          <img className="card-art" src={spyImg} alt="Spy" draggable={false} />
        </div>
      )
    }
    return (
      <div className="card hand-card mcard spy" onContextMenu={zoom}>
        <div className="mcard-banner">Spy</div>
        <div className="portrait spy">
          <span className="portrait-monogram">S</span>
        </div>
        <div className="spy-note">Can't be played — sits in your hand until Recover.</div>
      </div>
    )
  }
  const name = nameOfMaquis(dataId)
  const pick = pickable && onPick ? () => onPick(uid) : null
  const art = maquisArt(dataId)

  // Real card art: the image already carries the name + both Hidden/Revealed halves, so we just
  // overlay two invisible "play this side" hotspots over the left (Hidden) and right (Revealed) halves.
  if (art) {
    return (
      <div
        className={`card hand-card has-art ${pick ? 'pickable' : ''}`}
        onClick={pick ?? undefined}
        onContextMenu={zoom}
        role={pick ? 'button' : undefined}
        tabIndex={pick ? 0 : undefined}
        title={pick ? `Select ${name}` : undefined}
        onKeyDown={pick ? (e) => onEnter(e, pick) : undefined}
      >
        {pick && <div className="click-hint">Click to select</div>}
        <img className="card-art" src={art} alt={name} draggable={false} />
        <div className="play-hotspots">
          <button
            type="button"
            className="hot"
            disabled={!canPlayHidden}
            onClick={() => onPlay(uid, 'hidden')}
            title={canPlayHidden ? `Play ${name} — Hidden` : undefined}
          >
            <span className="hot-label">Play Hidden</span>
          </button>
          <button
            type="button"
            className="hot"
            disabled={!canPlayRevealed}
            onClick={() => onPlay(uid, 'revealed')}
            title={canPlayRevealed ? `Play ${name} — Revealed` : undefined}
          >
            <span className="hot-label">Play Revealed</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`card hand-card mcard ${pick ? 'pickable' : ''}`}
      onClick={pick ?? undefined}
      onContextMenu={zoom}
      role={pick ? 'button' : undefined}
      tabIndex={pick ? 0 : undefined}
      title={pick ? `Select ${name}` : undefined}
      onKeyDown={pick ? (e) => onEnter(e, pick) : undefined}
    >
      {pick && <div className="click-hint">Click to select</div>}
      <div className="mcard-banner">{name}</div>
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
  const monogram = nameOfMaquis(dataId).charAt(0)
  return (
    <button
      type="button"
      className={`side-panel ${side}`}
      disabled={!enabled}
      onClick={onPlay}
      title={enabled ? `Play ${nameOfMaquis(dataId)} — ${side}` : undefined}
    >
      <div className="side-tag">{side === 'hidden' ? 'Hidden' : 'Revealed'}</div>
      <div className={`portrait ${side}`}>
        <span className="atk-burst">{maquisAttack(dataId, side)}</span>
        <span className="portrait-monogram">{monogram}</span>
      </div>
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
  liveBonus,
}: {
  dataId: string
  uid: string
  side: Side
  canUse?: boolean
  onUse?: () => void
  pickable?: boolean
  onPick?: (uid: string) => void
  liveBonus?: number | null
}) {
  const action = maquisSideAction(dataId, side)
  const name = nameOfMaquis(dataId)
  const monogram = name.charAt(0)
  const pick = pickable && onPick ? () => onPick(uid) : null
  const art = maquisArt(dataId)
  const zoom = useMaquisZoom(dataId)

  // Real card art: show the whole card and dim the half that isn't in play, so the active side reads
  // clearly. The action fires from an overlaid "Use" ribbon; the live count-bonus sits in the corner.
  if (art) {
    const dimSide = side === 'hidden' ? 'right' : 'left'
    return (
      <div
        className={`card played has-art ${side} ${pick ? 'pickable' : ''}`}
        onClick={pick ?? undefined}
        onContextMenu={zoom}
        role={pick ? 'button' : undefined}
        tabIndex={pick ? 0 : undefined}
        title={pick ? `Select ${name}` : undefined}
        onKeyDown={pick ? (e) => onEnter(e, pick) : undefined}
      >
        {pick && <div className="click-hint">Click to select</div>}
        <img className="card-art" src={art} alt={`${name} — ${side}`} draggable={false} />
        <div className={`side-dim ${dimSide}`} aria-hidden="true" />
        <span className={`side-badge ${side}`}>{side}</span>
        {action && canUse && onUse && (
          <button type="button" className="use-ribbon" onClick={onUse} title={`Use ${name}'s action`}>
            {action.type} ▸ use
          </button>
        )}
        {liveBonus != null && (
          <Tip text="This action's current value — it locks in the moment you use it, so fire it after playing your other Maquis.">
            <span className="action-live art">⚔ +{liveBonus}</span>
          </Tip>
        )}
      </div>
    )
  }

  return (
    <div
      className={`card played mcard ${side} ${pick ? 'pickable' : ''}`}
      onClick={pick ?? undefined}
      onContextMenu={zoom}
      role={pick ? 'button' : undefined}
      tabIndex={pick ? 0 : undefined}
      title={pick ? `Select ${name}` : undefined}
      onKeyDown={pick ? (e) => onEnter(e, pick) : undefined}
    >
      {pick && <div className="click-hint">Click to select</div>}
      <div className="mcard-banner">
        {name}
        <span className="banner-side">{side}</span>
      </div>
      <div className={`portrait ${side}`}>
        <Tip text="Attack value — the Attack Strength this Maquis contributes on this side.">
          <span className="atk-burst">{maquisAttack(dataId, side)}</span>
        </Tip>
        <span className="portrait-monogram">{monogram}</span>
      </div>
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
      {liveBonus != null && (
        <Tip text="This action's current value — it locks in the moment you use it, so fire it after playing your other Maquis.">
          <span className="action-live">⚔ +{liveBonus} now</span>
        </Tip>
      )}
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
  newEnemyUids,
}: {
  slot: MissionSlot
  state: GameState
  canChoose?: boolean
  onChoose?: (uid: string) => void
  strikeTargets?: string[]
  onStrike?: (uid: string) => void
  pickTargets?: string[]
  onPick?: (uid: string) => void
  newEnemyUids?: string[]
}) {
  const reinforcedCount = newEnemyUids?.length ?? 0
  const zoomMission = useMissionZoom(slot.dataId)
  const data = missionOf(slot.dataId)
  const chosen = state.chosenMissionUid === slot.uid
  const defense = chosen && state.missionDefenseOverride != null ? state.missionDefenseOverride : data?.defense
  const name = data?.name ?? slot.dataId

  // Garrison is a printed card stat, but effects can add Enemies beyond it (Radio Operator,
  // Barracks, a moved Enemy). Show a persistent "+N" so the number always matches the chips on the
  // card. Based on the live count vs printed, so it self-corrects as Enemies are added or defeated.
  const garrisonBase = data?.garrison ?? 0
  const garrisonExtra = slot.enemies.length - garrisonBase

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

  const art = missionArt(slot.dataId)
  const cls = [
    'card',
    'mission',
    art ? 'has-art' : '',
    chosen ? 'chosen' : '',
    slot.faceDown ? 'failed' : '',
    slot.defeated ? 'defeated' : '',
    act ? 'actionable' : '',
    reinforcedCount > 0 ? 'reinforced' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const stamp = slot.defeated ? (
    <div className="defeated-stamp" aria-label="Mission defeated">
      <span className="defeated-word">Defeated</span>
      <span className="defeated-vp">+{data?.victoryPoints} VP</span>
    </div>
  ) : null

  // Reinforcement callout: a rising badge over the tile so the player can't miss that this
  // Mission's garrison just grew (Radio Operator, Barracks, or a moved Enemy).
  const reinforceBadge =
    reinforcedCount > 0 ? (
      <div className="reinforce-badge" aria-label={`${reinforcedCount} Enemy reinforcement`}>
        <span className="rb-count">+{reinforcedCount}</span>
        <span className="rb-cap">REINFORCED</span>
      </div>
    ) : null

  const enemiesRow = (
    <div className="enemies">
      {slot.enemies.map((e) => (
        <EnemyChip
          key={e.uid}
          enemy={e}
          canStrike={!!onStrike && (strikeTargets?.includes(e.uid) ?? false)}
          onStrike={onStrike ? () => onStrike(e.uid) : undefined}
          canPick={!!onPick && (pickTargets?.includes(e.uid) ?? false)}
          onPick={onPick ? () => onPick(e.uid) : undefined}
          isNew={newEnemyUids?.includes(e.uid) ?? false}
        />
      ))}
      {slot.enemies.length === 0 && <span className="muted">clear</span>}
    </div>
  )

  const wrap = {
    className: cls,
    onClick: act?.run,
    onContextMenu: zoomMission,
    role: act ? ('button' as const) : undefined,
    tabIndex: act ? 0 : undefined,
    title: act?.title,
    onKeyDown: act ? (e: KeyboardEvent) => onEnter(e, act.run) : undefined,
  }

  // Real mission art: the image carries name/stats/effect; we keep the click behaviour, the defeated
  // stamp, a Defense pill when it's modified this round, and the Enemies guarding it below.
  if (art) {
    const modified =
      chosen && state.missionDefenseOverride != null && data != null && state.missionDefenseOverride !== data.defense
    return (
      <div {...wrap}>
        {act && <div className="click-hint">{act.hint}</div>}
        {stamp}
        {reinforceBadge}
        <img className="card-art" src={art} alt={name} draggable={false} />
        {modified && (
          <Tip text="Defense modified for this round.">
            <span className="def-override">🛡 {defense}</span>
          </Tip>
        )}
        <div className="mission-body">{enemiesRow}</div>
      </div>
    )
  }

  return (
    <div {...wrap}>
      {act && <div className="click-hint">{act.hint}</div>}
      {stamp}
      {reinforceBadge}
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
        <Tip
          text={
            garrisonExtra > 0
              ? `Garrison — ${garrisonBase} printed, +${garrisonExtra} reinforced (${slot.enemies.length} Enemies here now).`
              : 'Garrison — how many Enemies guard this Mission.'
          }
        >
          <span className="garrison-stat">
            ☗ {garrisonBase}
            {garrisonExtra > 0 && <span className="garrison-plus">+{garrisonExtra}</span>}
          </span>
        </Tip>
      </div>
      <p className="effect">{data?.effect}</p>
      {enemiesRow}
    </div>
  )
}

function EnemyChip({
  enemy,
  canStrike,
  onStrike,
  canPick,
  onPick,
  isNew,
}: {
  enemy: EnemyInstance
  canStrike?: boolean
  onStrike?: () => void
  canPick?: boolean
  onPick?: () => void
  /** True when this Enemy was just added to the Mission (reinforcement) — plays an enter animation. */
  isNew?: boolean
}) {
  const type = enemyOf(enemy.typeId)
  const art = enemyArt(enemy.typeId)
  const newCls = isNew ? ' reinforce-enter' : ''
  const zoom = useEnemyZoom(enemy)

  if (!enemy.faceUp) {
    const back = enemyBackArt()
    const inner = back ? (
      <img className="enemy-art" src={back} alt="Face-down Enemy" draggable={false} />
    ) : (
      '🂠'
    )
    // A pick candidate on its Mission: clickable, but the identity stays hidden (no name, no zoom) —
    // the player is choosing which Mission's garrison to hit blind, as the physical game intends.
    if (canPick && onPick) {
      return (
        <button
          type="button"
          className={`enemy facedown pickable${back ? ' has-art' : ''}${newCls}`}
          onClick={(e) => {
            e.stopPropagation()
            onPick()
          }}
          title="Discard this Enemy — its identity stays hidden"
        >
          {inner}
        </button>
      )
    }
    return back ? (
      <span className={`enemy facedown has-art${newCls}`}>{inner}</span>
    ) : (
      <span className={`enemy facedown${newCls}`}>{inner}</span>
    )
  }

  // Copies of a type share the same art but differ in Defense, so with art we show the portrait and
  // overlay this instance's Defense; the full text lives in the hover tooltip.
  const tip = [
    `${type?.name ?? enemy.typeId} — Defense ${enemy.defense}${type?.keyword ? ` · ${type.keyword}` : ''}`,
    type?.effect,
  ]
    .filter(Boolean)
    .join('\n')

  const body = art ? (
    <>
      <img className="enemy-art" src={art} alt={type?.name ?? enemy.typeId} draggable={false} />
      <span className="enemy-def-pill">🛡 {enemy.defense}</span>
    </>
  ) : (
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
  const artCls = art ? ' has-art' : ''

  // A legal target during ATTACK: click to strike. stopPropagation so the click doesn't also bubble
  // to the Mission card (which may itself be a strike target).
  if (canStrike && onStrike) {
    return (
      <button
        type="button"
        className={`enemy faceup strikeable kw-${type?.keyword}${artCls}${newCls}`}
        onClick={(e) => {
          e.stopPropagation()
          onStrike()
        }}
        onContextMenu={zoom}
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
        className={`enemy faceup pickable kw-${type?.keyword}${artCls}${newCls}`}
        onClick={(e) => {
          e.stopPropagation()
          onPick()
        }}
        onContextMenu={zoom}
        title={`Select ${type?.name}`}
      >
        {body}
      </button>
    )
  }
  return (
    <div
      className={`enemy faceup kw-${type?.keyword}${artCls}${newCls}`}
      title={art ? tip : undefined}
      onContextMenu={zoom}
    >
      {body}
    </div>
  )
}

// --- Right-click zoom ------------------------------------------------------------------------------
// A right-click on any face-up card opens a large, read-only view (see Zoom.tsx) so the text is easy
// to read. Left-click behaviour is untouched. When real art exists we zoom the image; otherwise we
// render a big, legible text version of the same card.

/** Build a right-click handler that opens the zoom overlay with `content`. Stops the event from
 *  bubbling (an Enemy shouldn't also zoom its Mission) and suppresses the browser context menu. */
function useZoomHandler(content: () => ReactNode): (e: MouseEvent) => void {
  const openZoom = useZoom()
  return (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openZoom(content())
  }
}

const useMaquisZoom = (dataId: string) => useZoomHandler(() => <ZoomMaquisCard dataId={dataId} />)
const useMissionZoom = (dataId: string) => useZoomHandler(() => <ZoomMissionCard dataId={dataId} />)
const useEnemyZoom = (enemy: EnemyInstance) =>
  useZoomHandler(() => <ZoomEnemyCard typeId={enemy.typeId} defense={enemy.defense} />)

function ZoomMaquisCard({ dataId }: { dataId: string }) {
  const name = nameOfMaquis(dataId)
  const art = maquisArt(dataId)
  if (art) return <img className="zoom-art" src={art} alt={name} draggable={false} />
  if (dataId === 'spy') {
    return (
      <div className="zoom-card zoom-maquis">
        <h2>Spy</h2>
        <p className="zoom-note">Can't be played — sits in your hand until Recover.</p>
      </div>
    )
  }
  const hidden = maquisSideAction(dataId, 'hidden')
  const revealed = maquisSideAction(dataId, 'revealed')
  return (
    <div className="zoom-card zoom-maquis">
      <h2>{name}</h2>
      <div className="zoom-sides">
        <div className="zoom-side hidden">
          <div className="zoom-side-tag">Hidden · Attack {maquisAttack(dataId, 'hidden')}</div>
          {hidden ? (
            <p>
              <span className="zoom-action-type">{hidden.type}</span> {hidden.text}
            </p>
          ) : (
            <p className="zoom-note">No action</p>
          )}
        </div>
        <div className="zoom-side revealed">
          <div className="zoom-side-tag">Revealed · Attack {maquisAttack(dataId, 'revealed')}</div>
          {revealed ? (
            <p>
              <span className="zoom-action-type">{revealed.type}</span> {revealed.text}
            </p>
          ) : (
            <p className="zoom-note">No action</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ZoomMissionCard({ dataId }: { dataId: string }) {
  const data = missionOf(dataId)
  const name = data?.name ?? dataId
  const art = missionArt(dataId)
  if (art) return <img className="zoom-art" src={art} alt={name} draggable={false} />
  return (
    <div className="zoom-card zoom-mission">
      <h2>
        {name} <span className={`kw kw-${data?.keyword}`}>{data?.keyword}</span>
      </h2>
      <div className="zoom-stats">
        <span>🛡 Defense {data?.defense}</span>
        <span>★ {data?.victoryPoints} VP</span>
        <span>☗ Garrison {data?.garrison}</span>
      </div>
      {data?.effect && <p className="zoom-effect">{data.effect}</p>}
    </div>
  )
}

function ZoomEnemyCard({ typeId, defense }: { typeId: string; defense: number }) {
  const type = enemyOf(typeId)
  const name = type?.name ?? typeId
  const art = enemyArt(typeId)
  if (art) return <img className="zoom-art" src={art} alt={name} draggable={false} />
  return (
    <div className="zoom-card zoom-enemy">
      <h2>
        {name} <span className={`kw kw-${type?.keyword}`}>{type?.keyword}</span>
      </h2>
      <div className="zoom-stats">
        <span>🛡 Defense {defense}</span>
      </div>
      {type?.effect && <p className="zoom-effect">{type.effect}</p>}
    </div>
  )
}
