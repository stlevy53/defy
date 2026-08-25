// The single card-rendering seam. Every card face in the app is drawn here.
//
// Today each face is text rendered from the /data JSON. When art assets arrive, this is the ONE
// file to change: swap the text bodies below for <img> faces (keeping the same outer wrappers +
// state classes for selection/defeat/face-down overlays) and the rest of the UI is untouched.

import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react'
import type { GameState, MissionSlot, EnemyInstance } from '../engine'
import { gatingStrikeUids } from '../engine'
import { missionOf, nameOfMaquis, maquisAttack, maquisSideAction, enemyOf, keywordTip, eraLabel, classifyCandidate } from './format'
import { maquisArt, enemyArt, enemyBackArt, missionArt, missionBackArt, spyArt } from './cardArt'
import { Tip } from './Tip'
import { useZoom } from './Zoom'

/** Fixed capacity of the garrison strip (see MissionFace) — the observed max printed garrison is 5
 *  (data/missions.json), with one slot of reinforcement headroom folded in since Radio Operator /
 *  the Barracks can push a Mission past its printed count. */
const GARRISON_SLOTS = 5

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

/** How many "waves" of striking must clear before `targetUid` becomes a legal target — 1 if it's
 *  legal right now, 2 if one gate must fall first (a non-Grunt Enemy while Grunts remain), 3 if two
 *  gates must fall (the Mission itself, gated by Guards, which are themselves gated by Grunts).
 *  Lets the strip teach strike order up front instead of only pulsing after an illegal click.
 *  Recursion always bottoms out: Grunts are never themselves gated. */
function strikeWave(slot: MissionSlot, targetUid: string, cache: Map<string, number>): number {
  const cached = cache.get(targetUid)
  if (cached != null) return cached
  const gates = gatingStrikeUids(slot, targetUid)
  const wave = gates.length === 0 ? 1 : 1 + Math.max(...gates.map((g) => strikeWave(slot, g, cache)))
  cache.set(targetUid, wave)
  return wave
}

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
      /** Grab-to-slide onto Hidden / Revealed. Omitted for Spies and decision picks. */
      onSlideStart?: (e: PointerEvent) => void
      sliding?: boolean
    }
  | {
      kind: 'maquisPlayed'
      dataId: string
      uid: string
      side: Side
      canUse?: boolean
      onUse?: () => void
      /** PLAN rearrange: click the dimmed half to move this card to the other play area. */
      canMove?: boolean
      onMove?: () => void
      /** Grab-to-slide onto the other play area. */
      onSlideStart?: (e: PointerEvent) => void
      /** Dim the source card while it is being slid. */
      sliding?: boolean
      pickable?: boolean
      onPick?: (uid: string) => void
      /** Live value of a count-based ATTACK action (e.g. Abel hidden's +1/revealed Maquis), or null. */
      liveBonus?: number | null
      /** Attack this card's own action has already granted (Consuelo/Marcelino/etc.), added to its
       *  printed value on the face so the card reflects its true contribution. */
      attackBonus?: number
      /** Whether this card's action has already fired this round — labels the foot bar "SPENT". */
      actionUsed?: boolean
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
      /** UIDs already selected in a multi-pick (board-multi selectCards) — shown highlighted. */
      pickedTargets?: string[]
      onPick?: (uid: string) => void
      /** Enemy uids just added to this Mission (a reinforcement) — animated in when present. */
      newEnemyUids?: string[]
      /** UIDs that are on the chosen Mission but gated by Grunt/Guard order — click pulses the gate. */
      blockedStrikeUids?: string[]
      onBlockedStrike?: (uid: string) => void
      /** Enemies that must be struck first; `pulseId` remounts the ring so a repeat click retriggers. */
      pulseUids?: string[]
      pulseId?: number
      /** The most recent strike's cost, mirrored here from the single Attack Strength token so the
       *  struck target's Mission flashes its own "-{cost}" too (see App's strikeFlash /
       *  findStrikeCost). Keyed on the Mission's uid, not the struck target's — a defeated Enemy is
       *  spliced out of the slot the instant the strike commits, so its own uid can't anchor a
       *  floater in the post-strike render; the Mission tile it was on can. */
      strikeFlash?: { missionUid: string; cost: number; seq: number } | null
      /** Spotlight target for the first-run coach (right-click-zoom beat). */
      coachMark?: string
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
          onSlideStart={face.onSlideStart}
          sliding={face.sliding}
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
          canMove={face.canMove}
          onMove={face.onMove}
          onSlideStart={face.onSlideStart}
          sliding={face.sliding}
          pickable={face.pickable}
          onPick={face.onPick}
          liveBonus={face.liveBonus}
          attackBonus={face.attackBonus}
          actionUsed={face.actionUsed}
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
          pickedTargets={face.pickedTargets}
          onPick={face.onPick}
          newEnemyUids={face.newEnemyUids}
          blockedStrikeUids={face.blockedStrikeUids}
          onBlockedStrike={face.onBlockedStrike}
          pulseUids={face.pulseUids}
          pulseId={face.pulseId}
          strikeFlash={face.strikeFlash}
          coachMark={face.coachMark}
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
  onSlideStart,
  sliding,
}: {
  dataId: string
  uid: string
  canPlayHidden: boolean
  canPlayRevealed: boolean
  onPlay: (uid: string, side: Side) => void
  pickable?: boolean
  onPick?: (uid: string) => void
  onSlideStart?: (e: PointerEvent) => void
  sliding?: boolean
}) {
  const zoom = useMaquisZoom(dataId)
  if (dataId === 'spy') {
    const spyImg = spyArt()
    if (spyImg) {
      return (
        <div className="card hand-card has-art spy" data-card-uid={uid} onContextMenu={zoom}>
          <img className="card-art" src={spyImg} alt="Spy" draggable={false} />
        </div>
      )
    }
    return (
      <div className="card hand-card mcard spy" data-card-uid={uid} onContextMenu={zoom}>
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
  const canSlide = !pick && !!onSlideStart && (canPlayHidden || canPlayRevealed)

  // Real card art: the image already carries the name + both Hidden/Revealed halves, so we just
  // overlay two invisible "play this side" hotspots over the left (Hidden) and right (Revealed) halves.
  if (art) {
    return (
      <div
        className={`card hand-card has-art ${pick ? 'pickable pick-target' : ''} ${canSlide ? 'slidable' : ''} ${sliding ? 'is-sliding' : ''}`}
        data-card-uid={uid}
        data-peek-id={dataId}
        onClick={pick ?? undefined}
        onContextMenu={zoom}
        onPointerDown={canSlide ? onSlideStart : undefined}
        onDragStart={(e) => e.preventDefault()}
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
        {/* Readable strip matching the printed Hidden/Revealed split — the art alone can't show the
         *  side's Attack or which phase its action fires in. Non-interactive: the hotspots above
         *  handle the click. */}
        <div className="hand-side-plates" aria-hidden="true">
          <HandSidePlate dataId={dataId} side="hidden" />
          <HandSidePlate dataId={dataId} side="revealed" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`card hand-card mcard ${pick ? 'pickable pick-target' : ''} ${canSlide ? 'slidable' : ''} ${sliding ? 'is-sliding' : ''}`}
      data-card-uid={uid}
      onClick={pick ?? undefined}
      onContextMenu={zoom}
      onPointerDown={canSlide ? onSlideStart : undefined}
      onDragStart={(e) => e.preventDefault()}
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

/** One half of the readable strip on an arted hand card: the printed side's Attack and which
 *  phase its action fires in — the one scannable fact that tells a player whether this side is
 *  useful *this* phase without reading the fine print. */
function HandSidePlate({ dataId, side }: { dataId: string; side: Side }) {
  const attack = maquisAttack(dataId, side)
  const phase = maquisSideAction(dataId, side)?.type ?? '—'
  return (
    <div className={`hand-side-plate ${side}`}>
      <span className="hsp-label">{side === 'hidden' ? 'Hidden' : 'Revealed'}</span>
      <span className="hsp-value">⚔ {attack}</span>
      <span className="hsp-phase">{phase}</span>
    </div>
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
  canMove,
  onMove,
  onSlideStart,
  sliding,
  pickable,
  onPick,
  liveBonus,
  attackBonus,
  actionUsed,
}: {
  dataId: string
  uid: string
  side: Side
  canUse?: boolean
  onUse?: () => void
  canMove?: boolean
  onMove?: () => void
  onSlideStart?: (e: PointerEvent) => void
  sliding?: boolean
  pickable?: boolean
  onPick?: (uid: string) => void
  liveBonus?: number | null
  attackBonus?: number
  actionUsed?: boolean
}) {
  const action = maquisSideAction(dataId, side)
  const name = nameOfMaquis(dataId)
  const monogram = name.charAt(0)
  const pick = pickable && onPick ? () => onPick(uid) : null
  const art = maquisArt(dataId)
  const zoom = useMaquisZoom(dataId)
  // The card's true contribution this round: its printed Attack plus whatever its own action added
  // (e.g. Consuelo gains a discarded Enemy's Defense). The "+N" cue makes the boost unmistakable.
  const baseAttack = maquisAttack(dataId, side)
  const bonus = attackBonus ?? 0
  const totalAttack = baseAttack + bonus
  const otherSide: Side = side === 'hidden' ? 'revealed' : 'hidden'
  const dimSide = side === 'hidden' ? 'right' : 'left'
  const move = canMove && onMove && !pick ? onMove : null
  const otherLabel = otherSide === 'hidden' ? 'Hidden' : 'Revealed'
  const canSlide = !pick && !!onSlideStart && !!canMove
  const slideCls = `${canSlide ? 'slidable' : ''} ${sliding ? 'is-sliding' : ''}`

  const dim =
    move ? (
      <button
        type="button"
        className={`side-dim ${dimSide} moveable`}
        onClick={(e) => {
          e.stopPropagation()
          move()
        }}
        title={`Move ${name} to ${otherLabel}`}
      >
        <span className="move-label">Move {otherLabel}</span>
      </button>
    ) : (
      <div className={`side-dim ${dimSide}`} aria-hidden="true" />
    )

  // Real card art: show the whole card and dim the half that isn't in play. Use sits *under* the
  // card so the printed name and action text stay readable. The zone title already says Hidden /
  // Revealed, so there is no side badge on the face.
  if (art) {
    // A bar across the foot of the card, always present, replacing the old use-under button (which
    // only appeared while firable and otherwise left the card's attack value unlabeled). Left side
    // is always the card's live attack contribution; right side is the action state — clickable only
    // while firable.
    const firable = !!(action && canUse && onUse)
    // The action's own type (PLAN / ATTACK / PLAN/ATTACK), not a hardcoded phase — a PLAN-only
    // action used during PLAN must say so, not imply it only fires during an Attack. When the action
    // exists but isn't firable right now and hasn't fired yet, just name its type (no verb) — it may
    // be the wrong phase, or there's no valid target yet, and claiming it was "used" would be wrong.
    const footState = firable ? `${action?.type} · USE` : actionUsed ? 'SPENT' : action ? action.type : '—'
    const footBar = (
      <button
        type="button"
        className={`card-foot-bar ${firable ? 'firable' : ''}`}
        onClick={firable ? onUse : undefined}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={!firable}
        title={firable ? `Use ${name}'s ${action?.type} action` : undefined}
      >
        <span className="cfb-attack">⚔ {totalAttack}</span>
        <span className="cfb-state">{footState}</span>
      </button>
    )
    return (
      <div className={`played-wrap ${sliding ? 'is-sliding' : ''}`}>
        <div
          className={`card played has-art ${side} ${pick ? 'pickable pick-target' : ''} ${canSlide ? 'slidable' : ''}`}
          data-peek-id={dataId}
          onClick={pick ?? undefined}
          onContextMenu={zoom}
          onPointerDown={canSlide ? onSlideStart : undefined}
          onDragStart={(e) => e.preventDefault()}
          role={pick ? 'button' : undefined}
          tabIndex={pick ? 0 : undefined}
          title={pick ? `Select ${name}` : undefined}
          onKeyDown={pick ? (e) => onEnter(e, pick) : undefined}
        >
          {pick && <div className="click-hint">Click to select</div>}
          <img className="card-art" src={art} alt={`${name} — ${side}`} draggable={false} />
          {dim}
          {bonus > 0 && (
            <Tip text={`Attack ${baseAttack} +${bonus} from this card's action = ${totalAttack}.`}>
              <span className="attack-gain-badge">⚔ {totalAttack} (+{bonus})</span>
            </Tip>
          )}
          {liveBonus != null && (
            <Tip text="This action's current value — it locks in the moment you use it, so fire it after playing your other Maquis.">
              <span className="action-live art">⚔ +{liveBonus}</span>
            </Tip>
          )}
        </div>
        {footBar}
      </div>
    )
  }

  return (
    <div
      className={`card played mcard ${side} ${pick ? 'pickable pick-target' : ''} ${slideCls}`}
      onClick={pick ?? undefined}
      onContextMenu={zoom}
      onPointerDown={canSlide ? onSlideStart : undefined}
      onDragStart={(e) => e.preventDefault()}
      role={pick ? 'button' : undefined}
      tabIndex={pick ? 0 : undefined}
      title={pick ? `Select ${name}` : undefined}
      onKeyDown={pick ? (e) => onEnter(e, pick) : undefined}
    >
      {pick && <div className="click-hint">Click to select</div>}
      <div className="mcard-banner">{name}</div>
      <div className={`portrait ${side}`}>
        <Tip
          text={
            bonus > 0
              ? `Attack value — ${baseAttack} printed +${bonus} from this card's action = ${totalAttack}.`
              : 'Attack value — the Attack Strength this Maquis contributes on this side.'
          }
        >
          <span className={`atk-burst ${bonus > 0 ? 'boosted' : ''}`}>
            {totalAttack}
            {bonus > 0 && <span className="atk-gain">+{bonus}</span>}
          </span>
        </Tip>
        <span className="portrait-monogram">{monogram}</span>
      </div>
      {move && (
        <button type="button" className="move-side" onClick={move} title={`Move ${name} to ${otherLabel}`}>
          Move to {otherLabel}
        </button>
      )}
      {action &&
        (canUse && onUse ? (
          <button
            type="button"
            className="card-action usable"
            onClick={onUse}
            onPointerDown={(e) => e.stopPropagation()}
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
  pickedTargets,
  onPick,
  newEnemyUids,
  blockedStrikeUids,
  onBlockedStrike,
  pulseUids,
  pulseId,
  strikeFlash,
  coachMark,
}: {
  slot: MissionSlot
  state: GameState
  canChoose?: boolean
  onChoose?: (uid: string) => void
  strikeTargets?: string[]
  onStrike?: (uid: string) => void
  pickTargets?: string[]
  pickedTargets?: string[]
  onPick?: (uid: string) => void
  newEnemyUids?: string[]
  blockedStrikeUids?: string[]
  onBlockedStrike?: (uid: string) => void
  pulseUids?: string[]
  pulseId?: number
  strikeFlash?: { missionUid: string; cost: number; seq: number } | null
  coachMark?: string
}) {
  const reinforcedCount = newEnemyUids?.length ?? 0
  const zoomMission = useMissionZoom(slot.dataId, slot.faceDown)
  const data = missionOf(slot.dataId)
  const chosen = state.chosenMissionUid === slot.uid
  const defense = chosen && state.missionDefenseOverride != null ? state.missionDefenseOverride : data?.defense
  const name = data?.name ?? slot.dataId
  // During ATTACK the chosen Mission is the only one that matters this round — dim the other three
  // so it's unmistakable which one is live, and mark it plainly rather than leaving that to the
  // border color alone.
  const duringAttack = state.phase === 'ATTACK'
  const underAttack = duringAttack && chosen
  const attackDimmed = duringAttack && !chosen && !slot.faceDown && !slot.defeated

  // Garrison is a printed card stat, but effects can add Enemies beyond it (Radio Operator,
  // Barracks, a moved Enemy). Show a persistent "+N" so the number always matches the chips on the
  // card. Based on the live count vs printed, so it self-corrects as Enemies are added or defeated.
  const garrisonBase = data?.garrison ?? 0
  const garrisonExtra = slot.enemies.length - garrisonBase

  // The whole card is clickable for exactly one reason at a time (they live in different moments):
  // choose it to attack (PLAN), strike it (ATTACK), or pick it as a decision target.
  const canStrikeMission = !!onStrike && (strikeTargets?.includes(slot.uid) ?? false)
  const canPickMission = !!onPick && (pickTargets?.includes(slot.uid) ?? false)
  const blockedMission = !!onBlockedStrike && (blockedStrikeUids?.includes(slot.uid) ?? false)
  const act =
    canChoose && onChoose
      ? { run: () => onChoose(slot.uid), hint: 'Click to attack', title: `Attack this Mission: ${name}` }
      : canStrikeMission
        ? { run: () => onStrike!(slot.uid), hint: 'Click to strike', title: `Strike this Mission: ${name}` }
        : canPickMission
          ? { run: () => onPick!(slot.uid), hint: 'Click to select', title: `Select this Mission: ${name}` }
          : null

  const art = missionArt(slot.dataId)
  const back = slot.faceDown ? missionBackArt() : undefined
  const cls = [
    'card',
    'mission',
    art || back ? 'has-art' : '',
    chosen ? 'chosen' : '',
    underAttack ? 'under-attack' : '',
    attackDimmed ? 'attack-dimmed' : '',
    slot.faceDown ? 'failed' : '',
    slot.defeated ? 'defeated' : '',
    act ? 'actionable' : '',
    canPickMission ? 'pick-target' : '',
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
          picked={pickedTargets?.includes(e.uid) ?? false}
          onPick={onPick ? () => onPick(e.uid) : undefined}
          blocked={!!onBlockedStrike && (blockedStrikeUids?.includes(e.uid) ?? false)}
          onBlocked={onBlockedStrike ? () => onBlockedStrike(e.uid) : undefined}
          pulse={pulseUids?.includes(e.uid) ?? false}
          pulseId={pulseId}
          isNew={newEnemyUids?.includes(e.uid) ?? false}
        />
      ))}
      {slot.enemies.length === 0 && <span className="muted">clear</span>}
    </div>
  )

  // Fixed five-slot garrison strip (art-mode Missions only): a constant tile height regardless of
  // how many Enemies are actually here, instead of flex-wrapping chips that push the tile taller.
  // Five covers every printed garrison in data/missions.json (max 5) with no headroom to spare, so a
  // Mission that's been reinforced past that (Radio Operator / the Barracks, repeatedly, on a
  // Mission that's gone unattacked for a while) collapses into a "+N" overflow slot rather than
  // silently growing the row or hiding Enemies with no indication they're there.
  const waveCache = new Map<string, number>()
  const overflow = slot.enemies.length > GARRISON_SLOTS ? slot.enemies.length - (GARRISON_SLOTS - 1) : 0
  const visibleEnemies = overflow > 0 ? slot.enemies.slice(0, GARRISON_SLOTS - 1) : slot.enemies
  const emptyCount = Math.max(0, GARRISON_SLOTS - visibleEnemies.length - (overflow > 0 ? 1 : 0))
  const garrisonStrip = (
    <div className="enemies garrison-strip">
      {visibleEnemies.map((e) => (
        <EnemyChip
          key={e.uid}
          enemy={e}
          canStrike={!!onStrike && (strikeTargets?.includes(e.uid) ?? false)}
          onStrike={onStrike ? () => onStrike(e.uid) : undefined}
          canPick={!!onPick && (pickTargets?.includes(e.uid) ?? false)}
          picked={pickedTargets?.includes(e.uid) ?? false}
          onPick={onPick ? () => onPick(e.uid) : undefined}
          blocked={!!onBlockedStrike && (blockedStrikeUids?.includes(e.uid) ?? false)}
          onBlocked={onBlockedStrike ? () => onBlockedStrike(e.uid) : undefined}
          pulse={pulseUids?.includes(e.uid) ?? false}
          pulseId={pulseId}
          isNew={newEnemyUids?.includes(e.uid) ?? false}
          rank={strikeWave(slot, e.uid, waveCache)}
        />
      ))}
      {overflow > 0 && (
        <Tip text={`${overflow} more Enem${overflow === 1 ? 'y' : 'ies'} here, past the usual garrison — reinforcements have stacked up.`}>
          <div className="enemy has-art enemy-overflow">+{overflow}</div>
        </Tip>
      )}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <div key={`empty-${i}`} className="enemy has-art enemy-slot-empty">
          {chosen && i === emptyCount - 1 && <span className="enemy-slot-hint">room for 1 more</span>}
        </div>
      ))}
      {/* Keyed on the Mission, not the struck target: a defeated Enemy is gone from `slot.enemies`
       *  by the time this re-renders, so nothing on the strip itself could anchor the floater. */}
      {strikeFlash?.missionUid === slot.uid && (
        <span key={strikeFlash.seq} className="strike-cost-flash">−{strikeFlash.cost}</span>
      )}
    </div>
  )

  const wrap = {
    className: cls,
    onClick: act?.run ?? (blockedMission ? () => onBlockedStrike!(slot.uid) : undefined),
    onContextMenu: zoomMission,
    role: act ? ('button' as const) : undefined,
    tabIndex: act ? 0 : undefined,
    title: act?.title ?? (blockedMission ? 'Defeat Guards before the Mission' : slot.faceDown ? 'Failed Mission' : undefined),
    onKeyDown: act ? (e: KeyboardEvent) => onEnter(e, act.run) : undefined,
    ...(coachMark ? { 'data-coach': coachMark } : {}),
  }

  // Failed Missions stay in the row face-down. The printed back is the whole face — no era chip,
  // no garrison, no zoom of the hidden front.
  if (slot.faceDown) {
    return (
      <div {...wrap}>
        {back ? (
          <img className="card-art" src={back} alt="Failed Mission" draggable={false} />
        ) : (
          <div className="mission-failed-fallback">Failed</div>
        )}
      </div>
    )
  }

  // Real mission art: the image carries name/stats/effect; we keep the click behaviour, the defeated
  // stamp, a Defense pill when it's modified this round, and the Enemies guarding it below.
  if (art) {
    // The photo carries no legible stats at board scale, so the numbers a player scans — Defense,
    // VP, Garrison, the keyword — are overlaid as real text via a stat rail across the foot of the
    // art. (No era plate: the era is already printed on the card under the name banner, and it's on
    // the card art below.) `defense` already honours missionDefenseOverride, so the rail always
    // shows the live number — no separate "modified" pill needed.
    return (
      <div {...wrap}>
        {act && <div className="click-hint">{act.hint}</div>}
        {stamp}
        {reinforceBadge}
        <div className="mission-art">
          <img className="card-art" src={art} alt={data ? `${name} · ${eraLabel(data.era)}` : name} draggable={false} />
          {underAttack && <div className="under-attack-plate">Under attack</div>}
          <div className="mission-stat-rail">
            {data && (
              <Tip text={keywordTip(data.keyword)}>
                <span className={`stat-rail-badge kw-${data.keyword}`}>{data.keyword}</span>
              </Tip>
            )}
            <div className="mission-stat-rail-figures">
              <Tip text="Defense — the Attack Strength needed to defeat this Mission.">
                <span className="ms-def">🛡 {defense}</span>
              </Tip>
              <Tip text="Victory Points — scored when you defeat this Mission.">
                <span className="ms-vp">★ {data?.victoryPoints}</span>
              </Tip>
              <Tip
                text={
                  garrisonExtra > 0
                    ? `Garrison — ${garrisonBase} printed, +${garrisonExtra} reinforced (${slot.enemies.length} Enemies here now).`
                    : 'Garrison — how many Enemies guard this Mission.'
                }
              >
                <span className="ms-garrison garrison-stat">
                  ☗ {garrisonBase}
                  {garrisonExtra > 0 && <span className="garrison-plus">+{garrisonExtra}</span>}
                </span>
              </Tip>
            </div>
          </div>
        </div>
        <div className="mission-text">
          <div className="mission-name">{name}</div>
          <p className="mission-effect">{data?.effect}</p>
        </div>
        <div className="mission-body">{garrisonStrip}</div>
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
        {data && <span className="era-inline">{eraLabel(data.era)}</span>}
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
  picked,
  onPick,
  blocked,
  onBlocked,
  pulse,
  pulseId,
  isNew,
  rank,
}: {
  enemy: EnemyInstance
  canStrike?: boolean
  onStrike?: () => void
  canPick?: boolean
  /** True when this Enemy is already toggled on in a multi-pick — shown highlighted. */
  picked?: boolean
  onPick?: () => void
  /** Click is illegal until Grunts fall — pulse those instead of striking. */
  blocked?: boolean
  onBlocked?: () => void
  pulse?: boolean
  pulseId?: number
  /** True when this Enemy was just added to the Mission (reinforcement) — plays an enter animation. */
  isNew?: boolean
  /** Strike order (1 = legal now, 2/3/… = waves of gating still ahead) — see strikeWave. Shown as a
   *  badge so the order is taught before the click, not only after an illegal one. */
  rank?: number
}) {
  const type = enemyOf(enemy.typeId)
  const art = enemyArt(enemy.typeId)
  const newCls = isNew ? ' reinforce-enter' : ''
  const hostCls = pulse ? ' must-strike-host' : ''
  const zoom = useEnemyZoom(enemy)
  const ring = pulse ? <span key={pulseId} className="must-strike-ring" aria-hidden /> : null

  if (!enemy.faceUp) {
    const back = enemyBackArt()
    // Every face-down Enemy occupies a fixed art-sized garrison slot, whether or not the card-back
    // art has landed yet — the "?" placeholder fills the same slot rather than shrinking to a chip.
    const inner = back ? (
      <img className="enemy-art" src={back} alt="Face-down Enemy" draggable={false} />
    ) : (
      <span className="enemy-backfill" aria-hidden="true">?</span>
    )
    // A pick candidate on its Mission: clickable, but the identity stays hidden (no name, no zoom) —
    // the player is choosing which Mission's garrison to hit blind, as the physical game intends.
    if (canPick && onPick) {
      return (
        <button
          type="button"
          aria-pressed={picked || undefined}
          className={`enemy facedown pickable has-art${picked ? ' picked' : ''}${newCls}`}
          onClick={(e) => {
            e.stopPropagation()
            onPick()
          }}
          title="Select this Enemy — its identity stays hidden"
        >
          {inner}
        </button>
      )
    }
    return <span className={`enemy facedown has-art${newCls}`}>{inner}</span>
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
        className={`enemy faceup strikeable kw-${type?.keyword}${artCls}${newCls}${hostCls}`}
        onClick={(e) => {
          e.stopPropagation()
          onStrike()
        }}
        onContextMenu={zoom}
        title={`Strike ${type?.name} (cost ${enemy.defense})`}
      >
        {rank != null && <span className="strike-rank">STRIKE {ordinal(rank)}</span>}
        {body}
        {ring}
      </button>
    )
  }
  // A pending-decision candidate: click to pick it. stopPropagation so the pick doesn't bubble to a
  // pickable Mission card.
  if (canPick && onPick) {
    return (
      <button
        type="button"
        aria-pressed={picked || undefined}
        className={`enemy faceup pickable kw-${type?.keyword}${picked ? ' picked' : ''}${artCls}${newCls}${hostCls}`}
        onClick={(e) => {
          e.stopPropagation()
          onPick()
        }}
        onContextMenu={zoom}
        title={`Select ${type?.name}`}
      >
        {body}
        {ring}
      </button>
    )
  }
  // Order-blocked (a Guard or other Enemy while Grunts remain): the click pulses the Grunts.
  if (blocked && onBlocked) {
    return (
      <button
        type="button"
        className={`enemy faceup order-blocked kw-${type?.keyword}${artCls}${newCls}${hostCls}`}
        onClick={(e) => {
          e.stopPropagation()
          onBlocked()
        }}
        onContextMenu={zoom}
        title="Defeat Grunts first"
      >
        {rank != null && <span className="strike-rank quiet">{ordinal(rank)}</span>}
        {body}
        {ring}
      </button>
    )
  }
  return (
    <div
      className={`enemy faceup kw-${type?.keyword}${artCls}${newCls}${hostCls}`}
      title={art ? tip : undefined}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={zoom}
    >
      {body}
      {ring}
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
const useMissionZoom = (dataId: string, faceDown = false) =>
  useZoomHandler(() => <ZoomMissionCard dataId={dataId} faceDown={faceDown} />)
const useEnemyZoom = (enemy: EnemyInstance) =>
  useZoomHandler(() => <ZoomEnemyCard typeId={enemy.typeId} defense={enemy.defense} />)

export function zoomNodeFor(state: GameState, uid: string): ReactNode | null {
  const c = classifyCandidate(state, uid)
  switch (c.kind) {
    case 'maquis':
      return <ZoomMaquisCard dataId={c.dataId} />
    case 'spy':
      return <ZoomMaquisCard dataId="spy" />
    case 'mission':
      return <ZoomMissionCard dataId={c.slot.dataId} faceDown={c.slot.faceDown} />
    case 'enemy':
      return <ZoomEnemyCard typeId={c.enemy.typeId} defense={c.enemy.defense} />
    default:
      return null
  }
}

function ZoomMaquisCard({ dataId }: { dataId: string }) {
  const name = nameOfMaquis(dataId)
  const art = dataId === 'spy' ? spyArt() : maquisArt(dataId)
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

function ZoomMissionCard({ dataId, faceDown }: { dataId: string; faceDown?: boolean }) {
  const data = missionOf(dataId)
  const name = data?.name ?? dataId
  const back = faceDown ? missionBackArt() : undefined
  if (back) return <img className="zoom-art" src={back} alt="Failed Mission" draggable={false} />
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
