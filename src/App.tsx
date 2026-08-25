// Resist! — playable prototype UI (Phase 3). A thin view over the headless engine: it renders
// GameState, offers legalActions as buttons, and answers pendingDecision via the DecisionPanel.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useGame, useReinforcements, useCardFlights, useLogToasts } from './ui/useGame'
import type { CardFlight, LogToast } from './ui/useGame'
import { DecisionPanel } from './ui/DecisionPanel'
import { DecisionModal } from './ui/DecisionModal'
import { Card } from './ui/Card'
import { Tip } from './ui/Tip'
import { WhatsNew } from './ui/WhatsNew'
import { DraftOffer } from './ui/DraftOffer'
import { SettingsMenu } from './ui/SettingsMenu'
import { Coach } from './ui/Coach'
import { useUiScale } from './ui/useUiScale'
import { useCardSlide } from './ui/useCardSlide'
import type { CardSlide } from './ui/useCardSlide'
import { maquisArt, spyArt } from './ui/cardArt'
import { maquisSideAction, maquisAttack } from './ui/format'
import { APP_VERSION } from './ui/patchNotes'
import {
  WHATS_NEW_SEEN_KEY,
  hasCompletedCoach,
  shouldAutoShowCoach,
  shouldAutoShowWhatsNew,
  markCoachFinished,
} from './ui/coachLaunch'
import { isDraftPromptEnabled } from './ui/draftPref'
import { installUnlock, preloadAudio, playEndgameSfx } from './ui/audio'
import { actionLabel, missionOf, guidanceFor, ROUND_PHASES, boardPickable, countActionBonus, nameOfMaquis, graveyardCivilians } from './ui/format'
import { isDraftDecision, isDrafting, gatingStrikeUids } from './engine'
import type { Action, Decision, GameResult, GameState } from './engine'

/** Stable empty array so a "no board selection" render doesn't churn child props. */
const EMPTY: string[] = []

/** The Defense cost of striking `uid` — a Mission or one of its garrison Enemies — and the uid of
 *  the Mission slot it belongs to, read from the board at click time (before the dispatch that
 *  removes it). The mission uid is what the struck-target floater keys on: a defeated Enemy is
 *  spliced out of `slot.enemies` the instant the strike commits, so its own uid never exists in a
 *  post-strike render for a floater to attach to — the Mission tile it was on does. */
function findStrikeCost(state: GameState, uid: string): { missionUid: string; cost: number } | undefined {
  for (const slot of state.missionRow) {
    if (slot.uid === uid) {
      const data = missionOf(slot.dataId)
      const cost =
        slot.uid === state.chosenMissionUid && state.missionDefenseOverride != null
          ? state.missionDefenseOverride
          : data?.defense
      return cost != null ? { missionUid: slot.uid, cost } : undefined
    }
    const enemy = slot.enemies.find((e) => e.uid === uid)
    if (enemy) return { missionUid: slot.uid, cost: enemy.defense }
  }
  return undefined
}

export function App() {
  const { state, actions, dispatch, respond, undo, newGame, saveGame, loadGame, savedMeta, canUndo, error, seed, gameId, step } =
    useGame()

  // First launch of a build: What's New. When it closes, the draft offer (if enabled), then the
  // coach if it has never been finished. Coach on launch only when nothing else is in the way.
  const [showCoach, setShowCoach] = useState(() =>
    isDraftPromptEnabled() ? false : shouldAutoShowCoach(APP_VERSION),
  )
  const closeCoach = useCallback(() => {
    setShowCoach(false)
    markCoachFinished(APP_VERSION)
  }, [])

  // Patch-notes modal: greets a playtester once per build (not every launch), including a first-ever
  // launch. Reopenable from the version button. Closing the auto-shown one continues the launch
  // sequence (draft offer, then coach). Reopening from the version button just closes.
  const autoWhatsNew = useRef(shouldAutoShowWhatsNew(APP_VERSION))
  const [showWhatsNew, setShowWhatsNew] = useState(() => shouldAutoShowWhatsNew(APP_VERSION))
  const closeWhatsNew = useCallback(() => {
    setShowWhatsNew(false)
    try {
      localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION)
    } catch {
      /* storage unavailable — just close for this session */
    }
    if (!autoWhatsNew.current) return
    autoWhatsNew.current = false
    if (isDraftPromptEnabled()) setShowDraftOffer(true)
    else if (!hasCompletedCoach()) setShowCoach(true)
  }, [])

  const [showDraftOffer, setShowDraftOffer] = useState(
    () => isDraftPromptEnabled() && !shouldAutoShowWhatsNew(APP_VERSION),
  )
  const pendingStartSeed = useRef<number | undefined>(undefined)
  const pendingCoachAfterDraft = useRef(false)

  const maybeCoach = useCallback(() => {
    if (!hasCompletedCoach()) setShowCoach(true)
  }, [])

  const startGame = useCallback(
    (draft: boolean) => {
      setShowDraftOffer(false)
      pendingCoachAfterDraft.current = draft
      newGame(pendingStartSeed.current, draft)
      pendingStartSeed.current = undefined
      if (!draft) maybeCoach()
    },
    [newGame, maybeCoach],
  )

  const requestNewGame = useCallback(
    (seed?: number) => {
      pendingStartSeed.current = seed
      if (isDraftPromptEnabled()) setShowDraftOffer(true)
      else {
        pendingCoachAfterDraft.current = false
        newGame(seed)
      }
    },
    [newGame],
  )

  // Settings modal (New/Save/Load, board size, sound). Opened by the cog or Escape.
  const [showSettings, setShowSettings] = useState(false)

  // Player-chosen board size. Owned here (not in the modal) so the Ctrl +/-/0 accelerators work
  // whether or not Settings is open, and so the scale survives closing it.
  const ui = useUiScale()

  // Every cue file starts loading at launch (bundled local assets, no network wait needed) so the
  // first sound the player triggers doesn't stall on decode; `installUnlock` separately arms
  // playback on the first click, since autoplay policy blocks .play() until a user gesture even
  // once a file is warmed.
  useEffect(() => {
    preloadAudio()
    return installUnlock()
  }, [])

  // Escape opens Settings, or closes it if already open. Yields to other overlays: WhatsNew, the
  // coach, and the card zoom bind their own Escape handlers, so we don't also pop Settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showSettings) {
        setShowSettings(false)
        return
      }
      // Don't hijack Escape out of a text field (e.g. the seed box), and yield to other overlays.
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (showWhatsNew) return
      if (showDraftOffer) return
      if (showCoach) return
      if (typeof document !== 'undefined' && document.querySelector('.zoom-overlay')) return
      if (typeof document !== 'undefined' && document.body.classList.contains('sliding-card')) return
      setShowSettings(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showSettings, showWhatsNew, showDraftOffer, showCoach])

  // Dev/preview aid: append `?preview=<state>` to the URL to see any end-of-game overlay without
  // reaching it in play — useful for iterating on the animations. Values: loss, draw, minor,
  // victory, major, epic. Off by default.
  const preview =
    typeof window !== 'undefined' ? window.location.search.match(/[?&]preview=([^&]+)/)?.[1] ?? null : null
  const playAgain = () => {
    if (preview && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('preview')
      window.history.replaceState({}, '', url)
    }
    requestNewGame()
  }

  // What end-of-game overlay to show: a preview override wins, else the real game result.
  const shown = previewResult(preview) ?? state.result

  // Enemy chips added to a Mission this transition (reinforcements) — used to animate them in.
  const reinforced = useReinforcements(state, gameId)

  // A strike's cost, flashed on the single Attack Strength token and mirrored on the struck target,
  // so the number reads at the seam between where it's generated and where it's spent (Phase 6).
  // Captured at click time (see findStrikeCost) since the target is gone from state the instant
  // after dispatch. seq forces the CSS animation to replay even if the same cost strikes twice in a
  // row.
  const strikeSeq = useRef(0)
  const [strikeFlash, setStrikeFlash] = useState<{ missionUid: string; cost: number; seq: number } | null>(null)
  const flashStrike = useCallback((missionUid: string, cost: number) => {
    strikeSeq.current += 1
    const seq = strikeSeq.current
    setStrikeFlash({ missionUid, cost, seq })
    setTimeout(() => {
      setStrikeFlash((cur) => (cur?.seq === seq ? null : cur))
    }, 1100)
  }, [])

  // Hover-peek: a large read-only preview lifted above whichever hand or committed art-mode card the
  // pointer is over, showing both sides' printed rules text — no click required (Phase 6). Delegated
  // on the app root and positioned via `position: fixed` from the hovered card's measured rect, the
  // same technique FloatingPickBar/SlidingCard use, so it isn't clipped by the scrolling zones/hand
  // (an ancestor `overflow` silently clips plain `position: absolute` popovers — see the phase-help
  // popover fix).
  const [peek, setPeek] = useState<{ dataId: string; x: number; y: number; width: number } | null>(null)
  const appRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const root = appRef.current
    if (!root) return
    const sel = '.card.hand-card.has-art[data-peek-id], .card.played.has-art[data-peek-id]'
    let hideTimer: ReturnType<typeof setTimeout> | undefined
    const onOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(sel) as HTMLElement | null
      if (!target) return
      clearTimeout(hideTimer)
      const dataId = target.getAttribute('data-peek-id')
      if (!dataId) return
      const r = target.getBoundingClientRect()
      setPeek({ dataId, x: r.left + r.width / 2, y: r.top, width: r.width })
    }
    const onOut = (e: MouseEvent) => {
      const from = (e.target as HTMLElement).closest(sel)
      if (!from) return
      const to = e.relatedTarget instanceof Node ? (e.relatedTarget as HTMLElement).closest(sel) : null
      if (to === from) return
      hideTimer = setTimeout(() => setPeek(null), 40)
    }
    root.addEventListener('mouseover', onOver)
    root.addEventListener('mouseout', onOut)
    return () => {
      clearTimeout(hideTimer)
      root.removeEventListener('mouseover', onOver)
      root.removeEventListener('mouseout', onOut)
    }
  }, [])

  // Cards moving in/out of the hand (discards, draws) — flown as tokens between hand and pile rail.
  const { flights, remove: removeFlight } = useCardFlights(state, gameId, step)

  useEffect(() => {
    if (isDrafting(state)) pendingCoachAfterDraft.current = true
  }, [state])
  useEffect(() => {
    if (!pendingCoachAfterDraft.current) return
    if (isDrafting(state) || flights.length > 0) return
    pendingCoachAfterDraft.current = false
    maybeCoach()
  }, [state, flights.length, maybeCoach])

  // Fresh log lines from the latest move, surfaced as transient toasts (so the player sees what an
  // action did without opening the Log).
  const { toasts, dismiss: dismissToast } = useLogToasts(state, gameId, step)

  const group = (t: Action['type']) => actions.filter((a) => a.type === t)

  const canPlay = (acts: Action[], uid: string, side: 'hidden' | 'revealed') =>
    acts.some((a) => a.type === 'PlayMaquis' && a.uid === uid && a.side === side)

  const canMoveTo = (uid: string, side: 'hidden' | 'revealed') =>
    actions.some((a) => a.type === 'MoveMaquis' && a.uid === uid && a.side === side)

  const { slide, beginPlay, beginMove } = useCardSlide({
    scale: ui.scale,
    canPlay: (uid, side) => canPlay(actions, uid, side),
    canMove: canMoveTo,
    onPlay: (uid, side) => dispatch({ type: 'PlayMaquis', uid, side }),
    onMove: (uid, side) => dispatch({ type: 'MoveMaquis', uid, side }),
  })

  const dropOk = (side: 'hidden' | 'revealed') => {
    if (!slide || slide.over !== side) return false
    if (slide.kind === 'play') return canPlay(actions, slide.uid, side)
    return slide.from !== side && canMoveTo(slide.uid, side)
  }

  const canChoose = (acts: Action[], uid: string) =>
    acts.some((a) => a.type === 'ChooseMission' && a.uid === uid)

  // Every legal strike target this Attack (the chosen Mission and/or its Enemies), so the board can
  // make them directly clickable instead of listing them as buttons.
  const strikeTargets = actions.flatMap((a) => (a.type === 'SpendAttackOn' ? [a.targetUid] : []))

  // After play-out, a click on a Guard/other Enemy/the Mission that isn't legal yet pulses the
  // Grunt or Guard that has to fall first (same order as gatingStrikeUids).
  const spendingAttack = actions.some((a) => a.type === 'AdvancePhase')
  const chosenSlot = spendingAttack
    ? state.missionRow.find((s) => s.uid === state.chosenMissionUid)
    : undefined
  const blockedStrikeUids = (() => {
    if (!chosenSlot) return EMPTY
    const uids: string[] = []
    const consider = (uid: string) => {
      if (!strikeTargets.includes(uid) && gatingStrikeUids(chosenSlot, uid).length > 0) uids.push(uid)
    }
    consider(chosenSlot.uid)
    for (const e of chosenSlot.enemies) consider(e.uid)
    return uids.length > 0 ? uids : EMPTY
  })()
  const [mustStrike, setMustStrike] = useState({ uids: EMPTY as string[], id: 0 })
  const onBlockedStrike = (uid: string) => {
    if (!chosenSlot) return
    const gates = gatingStrikeUids(chosenSlot, uid)
    if (gates.length === 0) return
    setMustStrike((s) => ({ uids: gates, id: s.id + 1 }))
  }
  useEffect(() => {
    if (mustStrike.uids.length === 0) return
    const id = mustStrike.id
    const t = window.setTimeout(() => {
      setMustStrike((s) => (s.id === id ? { uids: EMPTY, id: s.id } : s))
    }, 1500)
    return () => window.clearTimeout(t)
  }, [mustStrike])

  // Board-multi decision: a "choose N" (N>1) selectCards whose candidates all live on the board
  // (e.g. Paquita's "discard 2 Enemies from this Mission", or Juana's flip-1-or-2). Answered by
  // toggling the cards on the board — more intuitive than picking chips off the turn tile — with
  // the confirm bar remaining in the tile. Single-picks and off-board peeks are unchanged.
  const decision = state.pendingDecision
  const selectCards = decision?.kind === 'selectCards' ? decision : null
  const boardMulti =
    !!selectCards &&
    selectCards.max > 1 &&
    selectCards.candidates.length > 0 &&
    selectCards.candidates.every((uid) => boardPickable(state, uid))
  const [multiPicked, setMultiPicked] = useState<string[]>([])
  // Reset the running selection whenever the decision (or its candidates) changes, so a fresh or
  // next-stage prompt starts empty.
  const multiKey = boardMulti ? `${selectCards!.prompt}|${selectCards!.candidates.join(',')}` : ''
  useEffect(() => {
    setMultiPicked([])
  }, [multiKey])

  // A "pick exactly one" pending decision can be answered by clicking the candidate on the board
  // (same idiom as striking). Candidates without a board representation stay in the DecisionPanel.
  const singlePicks = singlePickCandidates(state.pendingDecision).filter((uid) => boardPickable(state, uid))
  const pickTargets = boardMulti ? selectCards!.candidates : singlePicks
  const pickedTargets = boardMulti ? multiPicked : EMPTY
  const onPick = boardMulti
    ? (uid: string) =>
        setMultiPicked((p) =>
          p.includes(uid) ? p.filter((x) => x !== uid) : p.length < selectCards!.max ? [...p, uid] : p,
        )
    : (uid: string) => respond([uid])

  // Off-board decisions (Revealed-pile pick, deck peeks, reorder, option choices) open a full-card
  // modal instead of the inline chip list; board-anchored picks stay in the tile/on the board.
  const modalDecision =
    decisionUsesModal(state, state.pendingDecision) &&
    !(isDraftDecision(state.pendingDecision) && flights.length > 0)
      ? state.pendingDecision
      : null

  // Every player choice — a pending decision, the phase-level Turn buttons, or an error — lives in
  // one place: the right half of the guidance tile (see PhaseGuide), so the player never hunts for it.
  const turnActions = [...group('AdvancePhase'), ...group('EndResistance'), ...group('Continue')]
  const playerChoice = state.pendingDecision && !modalDecision ? (
    // Keyed on the prompt so each step of a multi-stage decision re-mounts and flashes.
    <div className="phase-decision" key={state.pendingDecision.prompt}>
      <DecisionPanel
        decision={state.pendingDecision}
        state={state}
        onRespond={respond}
        boardSelection={boardMulti ? { picked: multiPicked, setPicked: setMultiPicked } : undefined}
      />
    </div>
  ) : !state.result && turnActions.length > 0 ? (
    <ActionGroup title="Your turn" actions={turnActions} state={state} onClick={dispatch} />
  ) : null
  const sideContent =
    error || playerChoice ? (
      <>
        {error && <div className="error">{error}</div>}
        {playerChoice}
      </>
    ) : null
  const civiliansLost = graveyardCivilians(state)

  // An on-board decision (flip/discard a highlighted Enemy, strike a Mission, etc.) asks the player
  // to click something down on the board — which can be scrolled well away from the turn-row panel
  // that shows the prompt and Confirm button. Mirror the essentials in a bar fixed to the bottom of
  // the viewport whenever there's something to click, so the player never loses track of what
  // they're mid-selecting. Off-board decisions (which already open the full-card modal) don't need
  // this — the modal itself is always in view.
  const floatingPick =
    decision && !modalDecision && pickTargets.length > 0 ? (
      boardMulti ? (
        <FloatingPickBar
          prompt={selectCards!.prompt}
          count={multiPicked.length}
          max={selectCards!.max}
          valid={multiPicked.length >= selectCards!.min && multiPicked.length <= selectCards!.max}
          onConfirm={() => respond(multiPicked)}
          onClear={multiPicked.length > 0 ? () => setMultiPicked([]) : undefined}
        />
      ) : (
        <FloatingPickBar prompt={decision.prompt} hint="Click a highlighted card on the board to choose." />
      )
    ) : null

  // Situational prompt for the Missions row label: which Mission is chosen (or needs choosing) is
  // about a specific card, so it lives on the row, not the guidance tile.
  const chosenSlotForHint = state.missionRow.find((s) => s.uid === state.chosenMissionUid)
  const chosenMissionName = chosenSlotForHint ? (missionOf(chosenSlotForHint.dataId)?.name ?? chosenSlotForHint.dataId) : null

  return (
    <div className="app" ref={appRef}>
      <header className="topbar">
        <div className="title">
          <strong>RESIST!</strong>
        </div>
        <div className="status-meters" data-coach="status">
          <Tip below text="Victory Points — your score so far from defeated Missions.">
            <div className="meter">
              <span className="meter-label">Score</span>
              <span className="meter-score-value">★ {victoryPoints(state)} VP</span>
            </div>
          </Tip>
          <Tip below text="Failed Missions — fail two and the resistance is crushed.">
            <div className="meter">
              <span className="meter-label">Missions failed</span>
              <div className="meter-segments">
                {[0, 1].map((i) => (
                  <span key={i} className={`meter-seg mf ${i < state.failedMissions ? 'filled' : ''}`} />
                ))}
              </div>
            </div>
          </Tip>
          <Tip below text="Civilians in the Graveyard — five or more and the resistance is crushed.">
            <div className="meter">
              <span className="meter-label">Civilians lost</span>
              <div className="meter-segments">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={`meter-seg cl ${i < civiliansLost ? civilianFillClass(civiliansLost) : ''}`} />
                ))}
              </div>
            </div>
          </Tip>
        </div>
        <Piles state={state} landingPiles={flights.map((f) => f.pileKey)} />
        <div className="controls" data-coach="controls">
          <Tip below text="Takes back the last move, including a targeting choice (so a used action resets). You cannot undo revealing Enemies (a scout or choosing a Mission) once they are face-up. During PLAN you can also click a played card's dimmed half to switch Hidden ↔ Revealed — until anyone uses an action.">
            <button className="undo-btn" onClick={undo} disabled={!canUndo}>
              ↺ Undo
            </button>
          </Tip>
          <Tip below text="Settings — new / save / load game (or press Esc)">
            <button className="ghost cog" onClick={() => setShowSettings(true)} aria-label="Settings">
              ⚙
            </button>
          </Tip>
          <SeedControl seed={seed} />
        </div>
      </header>

      <PhaseGuide state={state} actions={actions} />

      {modalDecision && <DecisionModal decision={modalDecision} state={state} onRespond={respond} />}

      {showWhatsNew && <WhatsNew onClose={closeWhatsNew} />}

      {showDraftOffer && !showWhatsNew && (
        <DraftOffer onDraft={() => startGame(true)} onSkip={() => startGame(false)} />
      )}

      {showCoach && !showWhatsNew && !showDraftOffer && <Coach scale={ui.scale} onClose={closeCoach} />}

      {showSettings && (
        <SettingsMenu
          onClose={() => setShowSettings(false)}
          onNewGame={() => requestNewGame()}
          onPlaySeed={(s) => requestNewGame(s)}
          onSave={saveGame}
          onLoad={loadGame}
          savedMeta={savedMeta}
          appVersion={APP_VERSION}
          ui={ui}
          onReplayCoach={() => {
            setShowSettings(false)
            setShowCoach(true)
          }}
          onShowWhatsNew={() => {
            setShowSettings(false)
            setShowWhatsNew(true)
          }}
        />
      )}

      {!showCoach && !showDraftOffer && shown?.outcome === 'loss' && (
        <LossOverlay reason={shown.reason} cueKey={`${gameId}-loss`} onPlayAgain={playAgain} />
      )}
      {!showCoach && !showDraftOffer && shown?.outcome === 'win' && (
        <WinOverlay
          tier={shown.tier}
          points={shown.points}
          cueKey={`${gameId}-win`}
          onPlayAgain={playAgain}
        />
      )}

      {floatingPick}

      {peek && <HoverPeek dataId={peek.dataId} x={peek.x} y={peek.y} width={peek.width} />}

      {slide && <SlidingCard slide={slide} />}

      {flights.length > 0 && (
        <div className="flights" aria-hidden="true">
          {flights.map((f) => (
            <FlyingCard key={f.id} flight={f} onDone={() => removeFlight(f.id)} />
          ))}
        </div>
      )}

      <div className="event-line" role="status" aria-live="polite">
        {toasts.length > 0 &&
          (() => {
            const latest = toasts[toasts.length - 1]
            return <Toast key={latest.id} toast={latest} onDone={() => dismissToast(latest.id)} />
          })()}
      </div>

      {sideContent && (
        <div className="turn-row" data-coach="turn">
          {sideContent}
        </div>
      )}

      <section className="missions" data-coach="missions">
        <h3 className="missions-head">
          Missions
          {state.phase === 'PLAN' && !chosenMissionName && (
            <span className="board-hint">Choose one to attack this round</span>
          )}
          {state.phase === 'ATTACK' && chosenMissionName && (
            <span className="board-hint attack">
              Attacking {chosenMissionName} — the other three are out of reach this round
            </span>
          )}
        </h3>
        <div className="missions-row">
          {state.missionRow.map((slot, i) => (
            <Card
              key={slot.uid}
              kind="mission"
              slot={slot}
              state={state}
              canChoose={canChoose(actions, slot.uid)}
              onChoose={(uid) => dispatch({ type: 'ChooseMission', uid })}
              strikeTargets={strikeTargets}
              onStrike={(uid) => {
                const hit = findStrikeCost(state, uid)
                if (hit) flashStrike(hit.missionUid, hit.cost)
                dispatch({ type: 'SpendAttackOn', targetUid: uid })
              }}
              blockedStrikeUids={blockedStrikeUids}
              onBlockedStrike={onBlockedStrike}
              pulseUids={mustStrike.uids}
              pulseId={mustStrike.id}
              pickTargets={pickTargets}
              pickedTargets={pickedTargets}
              onPick={onPick}
              newEnemyUids={reinforced[slot.uid]}
              strikeFlash={strikeFlash}
              coachMark={i === 0 ? 'zoom' : undefined}
            />
          ))}
        </div>
      </section>

      <section className="play-area">
        <Zone
          title="Hidden Maquis"
          cards={state.inPlay.filter((m) => m.side === 'hidden')}
          side="hidden"
          state={state}
          actions={actions}
          onUse={(uid) => dispatch({ type: 'UseAction', uid })}
          onMove={(uid, dest) => dispatch({ type: 'MoveMaquis', uid, side: dest })}
          onSlideStart={(e, uid, dataId, from) => beginMove(e, uid, dataId, from)}
          slidingUid={slide?.uid}
          dropOk={dropOk('hidden')}
          pickTargets={pickTargets}
          onPick={onPick}
        />
        <Zone
          title="Revealed Maquis"
          cards={state.inPlay.filter((m) => m.side === 'revealed')}
          side="revealed"
          state={state}
          actions={actions}
          onUse={(uid) => dispatch({ type: 'UseAction', uid })}
          onMove={(uid, dest) => dispatch({ type: 'MoveMaquis', uid, side: dest })}
          onSlideStart={(e, uid, dataId, from) => beginMove(e, uid, dataId, from)}
          slidingUid={slide?.uid}
          dropOk={dropOk('revealed')}
          pickTargets={pickTargets}
          onPick={onPick}
        />
        <AttackStrengthToken value={state.attackStrength} phase={state.phase} spend={strikeFlash} />
      </section>

      <section className="hand" data-coach="hand">
        <h3 className="hand-head">
          Your hand
          <HandDrawNote state={state} />
        </h3>
        <p className="hand-hint">click a half to commit that side · hover to read the card</p>
        <div className="cards" data-flight-hand>
          {state.hand.map((c) => (
            <Card
              key={c.uid}
              kind="maquisHand"
              dataId={c.dataId}
              uid={c.uid}
              canPlayHidden={canPlay(actions, c.uid, 'hidden')}
              canPlayRevealed={canPlay(actions, c.uid, 'revealed')}
              onPlay={(uid, side) => dispatch({ type: 'PlayMaquis', uid, side })}
              onSlideStart={(e) => beginPlay(e, c.uid, c.dataId)}
              sliding={slide?.uid === c.uid}
              pickable={pickTargets.includes(c.uid)}
              onPick={onPick}
            />
          ))}
          {state.hand.length === 0 && <span className="muted">empty</span>}
        </div>
      </section>

      <details className="log">
        <summary>Log</summary>
        <ol>
          {state.log
            .slice(-14)
            .reverse()
            .map((line, i) => (
              <li key={i}>{line}</li>
            ))}
        </ol>
      </details>
    </div>
  )
}

/** One-line guidance: a phase chip (which phase, colored) plus the single most important
 *  instruction right now. The full four-step breadcrumb and the phase's sub-steps (active ones
 *  lit) move behind the "?" button — always available, never taking up board space. Sits in its own
 *  thin band directly under the status bar (not folded into it) so the status bar's fixed set of
 *  controls — score, loss-condition meters, piles, Undo, Settings — stays uncrowded. Turn actions /
 *  the pending-decision panel render separately in `.turn-row`, below this band. */
function PhaseGuide({ state, actions }: { state: GameState; actions: Action[] }) {
  const guide = guidanceFor(state, actions)
  const activeIndex = guide ? ROUND_PHASES.indexOf(guide.phase) : -1
  const [showSteps, setShowSteps] = useState(false)
  return (
    <section className="phase-guide" data-coach="guide">
      <div className="phase-guide-row">
        {guide && <PhaseChip phase={guide.phase} />}
        <div className="phase-help">
          <button
            type="button"
            className="phase-help-btn"
            onClick={() => setShowSteps((s) => !s)}
            aria-expanded={showSteps}
            aria-label="How this phase works"
          >
            ?
          </button>
          {showSteps && <div className="popover-backdrop" onClick={() => setShowSteps(false)} aria-hidden="true" />}
          <div className={`phase-help-popover ${showSteps ? 'open' : ''}`} role="dialog" aria-label="How this phase works">
            <ol className="breadcrumb">
              {ROUND_PHASES.map((p, i) => {
                const cls = [
                  'crumb',
                  i === activeIndex ? 'current' : '',
                  activeIndex >= 0 && i < activeIndex ? 'done' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <li key={p} className={cls}>
                    <span className="crumb-num">{i + 1}</span>
                    <span className="crumb-label">{p}</span>
                  </li>
                )
              })}
            </ol>
            {guide && (
              <>
                <p className="phase-help-goal">{guide.goal}</p>
                <ol className="phase-steps">
                  {guide.steps.map((s, i) => (
                    <li key={i} className={s.active ? 'active' : ''}>
                      {s.text}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
        {guide && (
          <p className="phase-now-line">
            {guide.now}
            {guide.hint && <span className="phase-now-hint"> {guide.hint}</span>}
            {guide.auto && <span className="phase-auto">automatic</span>}
          </p>
        )}
      </div>
    </section>
  )
}

/** Compact chip: which round phase (numbered 1–4, same order as the breadcrumb) plus its name,
 *  colored by phase — folds what used to be an always-on 4-item breadcrumb into one line. */
function PhaseChip({ phase }: { phase: (typeof ROUND_PHASES)[number] }) {
  const num = ROUND_PHASES.indexOf(phase) + 1
  return (
    <span className={`phase-chip phase-${phase}`}>
      <span className="phase-chip-num">{num}</span>
      <span className="phase-chip-label">{phase}</span>
    </span>
  )
}

/** Fixed to the bottom of the viewport whenever the player needs to click something on the board to
 *  answer a decision — the turn-row panel that also shows this prompt can scroll out of view (the
 *  candidates it's asking about are often further down the page than the panel itself), so this bar
 *  stays reachable regardless of scroll position. Two shapes: a multi-pick with a running count and
 *  Confirm/Clear (`onConfirm` set), or a single-pick that's just a reminder of what's being chosen
 *  (no confirm needed — clicking the card itself answers it). */
function FloatingPickBar({
  prompt,
  hint,
  count,
  max,
  valid,
  onConfirm,
  onClear,
}: {
  prompt: string
  hint?: string
  count?: number
  max?: number
  valid?: boolean
  onConfirm?: () => void
  onClear?: () => void
}) {
  return (
    <div className="floating-pick-bar" role="status">
      <span className="fpb-prompt">{prompt}</span>
      {hint && <span className="fpb-hint">{hint}</span>}
      {onConfirm && (
        <>
          <span className={`fpb-count ${valid ? 'ok' : ''}`}>
            {count}/{max} selected
          </span>
          <button className="confirm" disabled={!valid} onClick={onConfirm}>
            Confirm{count ? ` (${count})` : ''}
          </button>
          {onClear && (
            <button className="ghost" onClick={onClear}>
              Clear
            </button>
          )}
        </>
      )}
    </div>
  )
}

function ActionGroup({
  title,
  actions,
  state,
  onClick,
}: {
  title: string
  actions: Action[]
  state: GameState
  onClick: (a: Action) => void
}) {
  if (actions.length === 0) return null
  return (
    <div className="action-group">
      <h4>{title}</h4>
      <div className="chips">
        {actions.map((a, i) => (
          <button key={i} className="chip action" onClick={() => onClick(a)}>
            {actionLabel(state, a)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Zone({
  title,
  cards,
  side,
  state,
  actions,
  onUse,
  onMove,
  onSlideStart,
  slidingUid,
  dropOk,
  pickTargets,
  onPick,
}: {
  title: string
  cards: GameState['inPlay']
  side: 'hidden' | 'revealed'
  state: GameState
  actions: Action[]
  onUse: (uid: string) => void
  onMove: (uid: string, side: 'hidden' | 'revealed') => void
  onSlideStart: (e: ReactPointerEvent, uid: string, dataId: string, from: 'hidden' | 'revealed') => void
  slidingUid?: string
  dropOk?: boolean
  pickTargets: string[]
  onPick: (uid: string) => void
}) {
  const hint = side === 'hidden' ? 'concealed from Franco' : 'active — visible to Franco'
  return (
    <div className={`zone${dropOk ? ' drop-ok' : ''}`} data-drop-side={side}>
      <div className="zone-head">
        <span className={`zone-swatch ${side}`} aria-hidden="true" />
        <span className="zone-name">{title}</span>
        <span className="zone-hint">{hint}</span>
      </div>
      <div className="cards">
        {cards.map((m) => {
          const canUse = actions.some((a) => a.type === 'UseAction' && a.uid === m.uid)
          const moveTo = actions.find((a) => a.type === 'MoveMaquis' && a.uid === m.uid)
          return (
            <Card
              key={m.uid}
              kind="maquisPlayed"
              dataId={m.dataId}
              uid={m.uid}
              side={side}
              canUse={canUse}
              onUse={() => onUse(m.uid)}
              canMove={!!moveTo}
              onMove={moveTo && moveTo.type === 'MoveMaquis' ? () => onMove(m.uid, moveTo.side) : undefined}
              onSlideStart={(e) => onSlideStart(e, m.uid, m.dataId, side)}
              sliding={slidingUid === m.uid}
              pickable={pickTargets.includes(m.uid)}
              onPick={onPick}
              attackBonus={m.attackBonus}
              // A count-based action's preview ("⚔ +N now") only makes sense before it fires; once
              // used, the gained attack is baked into the card's value, so drop the stale preview.
              liveBonus={canUse ? countActionBonus(state, m.dataId, side, m.uid) : null}
              actionUsed={m.actionUsed}
            />
          )
        })}
        {cards.length === 0 && <div className="zone-empty">nothing here yet</div>}
      </div>
    </div>
  )
}

/** Candidate uids for a decision that is answered by picking exactly one card: any selectTarget, or
 *  a selectCards that must take exactly one. Other decisions return [] (handled by the panel). */
function singlePickCandidates(decision: Decision | null): string[] {
  if (!decision) return []
  if (decision.kind === 'selectTarget') return decision.candidates
  if (decision.kind === 'selectCards' && decision.min === 1 && decision.max === 1) return decision.candidates
  return []
}

/** A decision opens the full-card modal when its candidates aren't on the table: reorder and option
 *  choices always, and any card selection whose every candidate is off-board (deck peeks, the
 *  Revealed pile). Board-anchored picks (Missions, on-board Enemies, played/hand Maquis) and the
 *  rare mixed-candidate case stay in the inline panel / on the board. See DECISION_MODAL_SPEC.md. */
function decisionUsesModal(state: GameState, decision: Decision | null): boolean {
  if (!decision) return false
  if (decision.kind === 'orderCards' || decision.kind === 'chooseOption') return true
  const candidates = decision.candidates
  if (candidates.length === 0) return false
  return candidates.every((uid) => !boardPickable(state, uid))
}

interface PileInfo {
  label: string
  n: number
  tone: string
  hint: string
  /** Zone key matching useCardFlights' FLIGHT_ZONES, so cards can fly to/from this tile. */
  flightKey?: string
}

/** Labels of the four piles a player checks constantly — these stay inline in the status bar.
 *  The rest (played less often, or purely informational) move behind the "All piles" disclosure. */
const INLINE_PILE_LABELS = new Set(['Hidden deck', 'Enemy deck', 'Mission deck', 'Graveyard'])

function Piles({ state, landingPiles = EMPTY }: { state: GameState; landingPiles?: string[] }) {
  const piles: PileInfo[] = [
    { label: 'Hidden deck', n: state.hidden.deck.length, tone: 'hidden', flightKey: 'hidden.deck', hint: 'Hidden Maquis (and shuffled Spies) you draw your hand from.' },
    { label: 'Hidden discard', n: state.hidden.discard.length, tone: 'hidden', flightKey: 'hidden.discard', hint: 'Played hidden Maquis + discarded Spies; reshuffled into the Hidden deck when it runs out.' },
    { label: 'Recruit deck', n: state.recruit.deck.length, tone: 'revealed', flightKey: 'recruit.deck', hint: 'Inactive Maquis — only recovered by specific effects.' },
    { label: 'Revealed pile', n: state.recruit.revealed.length, tone: 'revealed', flightKey: 'recruit.revealed', hint: 'Maquis played revealed this game — set aside, out of the decks.' },
    { label: 'Enemy deck', n: state.enemyDeck.length, tone: 'enemy', hint: 'Face-down Enemies dealt to refilled Missions by their Garrison.' },
    { label: 'Enemy discard', n: state.enemyDiscard.length, tone: 'enemy', hint: 'Defeated/discarded Enemies; reshuffled into the Enemy deck when it runs out.' },
    { label: 'Mission deck', n: state.missionDeck.length, tone: 'mission', hint: 'Era-2 then Era-3 Missions that refill the row as you defeat Missions.' },
    { label: 'Defeated', n: state.defeatedMissions.length, tone: 'mission', hint: 'Missions you have defeated — these score their Victory Points.' },
    { label: 'Graveyard', n: state.graveyard.length, tone: 'civ', hint: 'Lost Civilians. Reach 5 civilians here and the resistance is crushed.' },
    { label: 'Spy supply', n: state.spiesAvailable, tone: 'spy', hint: 'Spies available to be added to your Hidden deck by enemy effects.' },
    { label: 'Removed', n: state.removedFromGame.length, tone: 'removed', flightKey: 'removed', hint: 'Cards removed from the game entirely (back in the box).' },
  ]
  const inline = piles.filter((p) => INLINE_PILE_LABELS.has(p.label))
  const rest = piles.filter((p) => !INLINE_PILE_LABELS.has(p.label))
  const [open, setOpen] = useState(false)

  return (
    <div className="status-piles">
      {inline.map((p) => (
        <div
          key={p.label}
          data-pile-key={p.flightKey}
          className={`status-pile ${p.n === 0 ? 'empty' : ''} ${p.flightKey && landingPiles.includes(p.flightKey) ? 'flight-land' : ''}`}
          title={`${p.label} — ${p.hint}`}
        >
          <span className={`deck-ico-sm tone-${p.tone}`}>
            <span className="status-pile-count">{p.n}</span>
          </span>
          <span className="status-pile-label">{p.label}</span>
        </div>
      ))}
      <div className="piles-disclosure">
        <button
          type="button"
          className="ghost piles-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="All piles"
        >
          All piles
        </button>
        {open && <div className="popover-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
        {/* Stays mounted (shown/hidden via CSS, not conditional rendering) even while closed, so
         *  useCardFlights can still measure these tiles as flight targets. See Phase 6. */}
        <div className={`piles-popover ${open ? 'open' : ''}`} role="dialog" aria-label="All piles">
          <h3 className="piles-popover-head">Card Piles</h3>
          {rest.map((p) => (
            <div
              key={p.label}
              data-pile-key={p.flightKey}
              className={`pile ${p.n === 0 ? 'empty' : ''} ${p.flightKey && landingPiles.includes(p.flightKey) ? 'flight-land' : ''}`}
              title={`${p.label} — ${p.hint}`}
            >
              <span className={`deck-ico tone-${p.tone}`}>
                <span className="deck-count">{p.n}</span>
              </span>
              <span className="pile-label">{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A card token that follows the pointer while the player slides a Maquis onto Hidden or Revealed. */
function SlidingCard({ slide }: { slide: CardSlide }) {
  const art = maquisArt(slide.dataId)
  return (
    <div
      className="sliding-ghost"
      style={{
        left: slide.x - slide.width / 2,
        top: slide.y - slide.height / 2,
        width: slide.width,
        height: slide.height,
      }}
      aria-hidden="true"
    >
      {art ? (
        <img src={art} alt="" draggable={false} />
      ) : (
        <span>{nameOfMaquis(slide.dataId)}</span>
      )}
    </div>
  )
}

/** A single card token in flight between the hand and a pile tile. Mounts at its source point, then
 *  on the next frame transitions to the destination (CSS handles the ease), fading and shrinking as
 *  it lands; removes itself when the motion completes. Purely a visual cue — no interaction. */
function FlyingCard({ flight, onDone }: { flight: CardFlight; onDone: () => void }) {
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    // Two rAFs guarantee the browser paints the start position before the transition target lands,
    // so the transition actually runs instead of snapping.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMoved(true))
    })
    const t = setTimeout(onDone, 720 + flight.delay)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(t)
    }
  }, [onDone, flight.delay])

  const spy = flight.dataId === 'spy'
  const art = spy ? spyArt() : maquisArt(flight.dataId)
  const w = spy ? 96 : 66
  const h = spy ? 68 : 92
  const dx = flight.toX - flight.fromX
  const dy = flight.toY - flight.fromY
  return (
    <div
      className={`flying-card ${spy ? 'spy' : 'maquis'}${art ? ' has-art' : ''}`}
      style={{
        left: flight.fromX - w / 2,
        top: flight.fromY - h / 2,
        width: w,
        height: h,
        transitionDelay: `${flight.delay}ms`,
        transform: moved
          ? `translate(${dx}px, ${dy}px) scale(0.45) rotate(8deg)`
          : 'translate(0, 0) scale(1) rotate(-4deg)',
        opacity: moved ? 0 : 1,
      }}
    >
      {art ? <img src={art} alt="" draggable={false} /> : <span className="fc-name">{nameOfMaquis(flight.dataId)}</span>}
    </div>
  )
}

/** A single transient log toast: fades/slides in, sits for a few seconds, then dismisses itself.
 *  Click to dismiss early. Purely informational — mirrors a line the engine already logged. */
function Toast({ toast, onDone }: { toast: LogToast; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3600)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <button type="button" className="toast" onClick={onDone} title="Dismiss">
      {toast.text}
    </button>
  )
}

/** The single Attack Strength object (Phase 6 — was a topbar pill AND a turn-tile meter, ~400px
 *  apart, showing the same number with two different animations). Lives at the right end of the
 *  committed lanes, the seam between where the number is generated (playing/using Maquis) and
 *  where it's spent (striking). Dormant outside ATTACK (value always 0 then): quieter, no accent
 *  border, and a sublabel explaining what fills it instead of "left to spend". */
function AttackStrengthToken({
  value,
  phase,
  spend,
}: {
  value: number
  phase: GameState['phase']
  spend: { missionUid: string; cost: number; seq: number } | null
}) {
  const prev = useRef(value)
  const [gain, setGain] = useState(0)
  useEffect(() => {
    const delta = value - prev.current
    prev.current = value
    if (delta > 0) {
      setGain(delta)
      const t = setTimeout(() => setGain(0), 1300)
      return () => clearTimeout(t)
    }
  }, [value])
  const dormant = phase !== 'ATTACK'
  return (
    <div className={`attack-token ${dormant ? 'dormant' : ''} ${gain > 0 ? 'gain' : ''}`} role="status" aria-label={`${value} Attack Strength left to spend`}>
      <span className="at-label">Attack Strength</span>
      <span key={`v${value}`} className="at-value">
        {value}
      </span>
      <span className="at-sub">{dormant ? 'builds as you commit Maquis' : 'left to spend'}</span>
      {gain > 0 && <span className="at-gain">+{gain}</span>}
      {spend && <span key={spend.seq} className="at-spend">−{spend.cost}</span>}
    </div>
  )
}

/** Hover-only expanded preview of a hand or committed art-mode Maquis card: both sides' printed
 *  rules text as real HTML, lifted above the card the pointer is over. Answers "what does this do"
 *  without the click the right-click zoom still requires for a closer look at the art itself
 *  (Phase 6 — reading a card's rules text should never require a click). Positioned `fixed` from
 *  the hovered card's measured rect (see the delegated listener in App()) rather than a CSS-only
 *  `:hover` popover, since the committed lanes and hand both scroll/clip via `overflow` and a plain
 *  `position: absolute` child would be cut off (the same lesson as the phase-help popover fix). */
function HoverPeek({ dataId, x, y, width }: { dataId: string; x: number; y: number; width: number }) {
  if (dataId === 'spy') return null
  const name = nameOfMaquis(dataId)
  const art = maquisArt(dataId)
  const hidden = maquisSideAction(dataId, 'hidden')
  const revealed = maquisSideAction(dataId, 'revealed')
  return (
    <div className="hover-peek" style={{ left: x, top: y, ['--peek-w' as string]: `${Math.max(width, 260)}px` }} aria-hidden="true">
      {!art && <div className="hp-name">{name}</div>}
      {art && <img className="hp-art" src={art} alt="" draggable={false} />}
      <div className="hp-sides">
        <div className="hp-side hidden">
          <div className="hp-tag">HIDDEN · ⚔ {maquisAttack(dataId, 'hidden')}</div>
          <p>{hidden ? <><span className="hp-type">{hidden.type}</span> {hidden.text}</> : 'No action'}</p>
        </div>
        <div className="hp-side revealed">
          <div className="hp-tag">REVEALED · ⚔ {maquisAttack(dataId, 'revealed')}</div>
          <p>{revealed ? <><span className="hp-type">{revealed.type}</span> {revealed.text}</> : 'No action'}</p>
        </div>
      </div>
    </div>
  )
}

/** Topbar seed indicator: shows the current game's seed; click to copy it (playtesters paste it
 *  into bug reports to reproduce a deal). Starting a game *from* a seed lives in the Settings menu. */
function SeedControl({ seed }: { seed: number }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    const done = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(String(seed)).then(done, done)
    } else {
      done()
    }
  }

  return (
    <Tip below text="Seed for this game — click to copy. Share it to reproduce this exact deal (great for bug reports).">
      <button className="seed-pill" onClick={copy} aria-label={`Copy seed ${seed}`}>
        {copied ? 'copied ✓' : `seed ${seed}`}
      </button>
    </Tip>
  )
}

function victoryPoints(state: GameState): number {
  return state.defeatedMissions.reduce((n, m) => n + (missionOf(m.dataId)?.victoryPoints ?? 0), 0)
}

/** Civilians-lost meter fill color: green while there's slack, amber as it gets close, red once the
 *  5-civilian loss condition is one card away. */
function civilianFillClass(civiliansLost: number): string {
  if (civiliansLost >= 5) return 'filled-loss'
  if (civiliansLost >= 3) return 'filled-warn'
  return 'filled-win'
}

/** A defeated Mission (Cross the Border −1 / Attack Francoists in the Valley +1) can change the size
 *  of the hand drawn next Recover. `recoverDrawModifier` is live from the moment of defeat until the
 *  new hand is drawn, so this note warns the player ahead of clicking Continue. */
function HandDrawNote({ state }: { state: GameState }) {
  const delta = state.recoverDrawModifier
  if (delta === 0 || state.result) return null
  const size = Math.max(0, 5 + delta)
  const srcId = delta < 0 ? 'border' : 'valley'
  const source = state.defeatedMissions.some((m) => m.dataId === srcId) ? missionOf(srcId)?.name : undefined
  const sign = delta > 0 ? `+${delta}` : `${delta}` // e.g. "+1" or "-1"
  const tip = `${source ? `${source} was defeated — you'll` : "You'll"} draw ${size} card${size === 1 ? '' : 's'} (${
    delta > 0 ? 'one extra' : 'one fewer'
  }) when you Continue to the next round.`
  return (
    <Tip text={tip}>
      <span className={`hand-draw-note ${delta < 0 ? 'warn' : 'good'}`}>
        Next hand: {size} ({sign})
      </span>
    </Tip>
  )
}

/** A full-sentence, thematic cause of defeat for the game-over modal. */
function lossHeadline(reason?: string): string {
  if (reason === 'civilians') return 'Too many civilians have fallen — the people can bear no more.'
  if (reason === 'missions') return 'Two missions failed. The network is shattered.'
  if (reason === 'spies') return 'Informants have overrun your cell — nothing but spies remain.'
  return 'The resistance is broken.'
}

/** Full-screen, animated defeat modal. Covers the board so the loss lands with weight; the only
 *  action out is Play again. */
function LossOverlay({
  reason,
  cueKey,
  onPlayAgain,
}: {
  reason?: string
  cueKey: string
  onPlayAgain: () => void
}) {
  useEffect(() => playEndgameSfx('loss', cueKey), [cueKey])
  return (
    <div className="gameover-overlay loss" role="alertdialog" aria-modal="true" aria-label="Defeat">
      <div className="gameover-vignette" aria-hidden="true" />
      <div className="gameover-panel loss">
        <div className="gameover-emblem" aria-hidden="true">✶</div>
        <h1 className="gameover-title">The Resistance Has Fallen</h1>
        <p className="gameover-sub">You lose.</p>
        <p className="gameover-reason">{lossHeadline(reason)}</p>
        <button className="gameover-btn" onClick={onPlayAgain}>
          Play again
        </button>
      </div>
    </div>
  )
}

// --- Victory --------------------------------------------------------------------------------------
// The win overlay escalates with the score tier: a subdued Draw (level 0) up to a full-spectacle
// Epic Victory (level 4). Higher levels add rotating rays and more confetti (see CSS `.win-l{n}`).

interface WinTier {
  level: 0 | 1 | 2 | 3 | 4
  headline: string
  flavor: string
}

/** Tier metadata keyed by the engine's `scoreTier` strings. Flavor text is from the rulebook table. */
const WIN_TIERS: Record<string, WinTier> = {
  Draw: {
    level: 0,
    headline: 'Draw',
    flavor:
      'The Maquis fight valiantly, but are unable to achieve any major victories in the battle against Franco’s forces.',
  },
  'Minor Victory': {
    level: 1,
    headline: 'Minor Victory',
    flavor:
      'The Maquis liberate some villages and towns, raising the Spanish Republican flag over them — though they are ultimately defeated by Franco’s forces.',
  },
  Victory: {
    level: 2,
    headline: 'Victory',
    flavor:
      'Victories against Franco’s forces inspire guerrilla activity across Spain. Spain is not liberated, but the Maquis achieve major successes in their battle against Franco.',
  },
  'Major Victory': {
    level: 3,
    headline: 'Major Victory',
    flavor:
      'The Maquis achieve major success, victory after victory across Spain, forcing Franco to the negotiation table and ending his dictatorship early.',
  },
  'Epic Victory': {
    level: 4,
    headline: 'Epic Victory',
    flavor: 'The Maquis overwhelm Franco’s forces, overthrow the dictator, and liberate Spain!',
  },
}

/** Full-screen victory modal, escalating with the tier. */
function WinOverlay({
  tier,
  points,
  cueKey,
  onPlayAgain,
}: {
  tier?: string
  points?: number
  cueKey: string
  onPlayAgain: () => void
}) {
  const info = WIN_TIERS[tier ?? 'Draw'] ?? WIN_TIERS.Draw
  const level = info.level
  useEffect(() => playEndgameSfx('win', cueKey, { tier: tier ?? info.headline }), [cueKey, tier, info.headline])
  return (
    <div className={`gameover-overlay win win-l${level}`} role="alertdialog" aria-modal="true" aria-label={tier}>
      {level >= 2 && <div className="win-rays" aria-hidden="true" />}
      {level >= 1 && <Confetti count={CONFETTI_BY_LEVEL[level]} />}
      <div className={`gameover-panel win win-l${level}`}>
        <WinEmblem level={level} />
        {tier && tier !== info.headline && <div className="win-tier-tag">{tier}</div>}
        <h1 className="gameover-title win">{info.headline}</h1>
        <p className="gameover-sub win">{points} Victory Points</p>
        <p className="gameover-reason win">{info.flavor}</p>
        <button className="gameover-btn win" onClick={onPlayAgain}>
          Play again
        </button>
      </div>
    </div>
  )
}

/** The emblem escalates in form, not just size: a single star (Victory), a pulsing trio (Major),
 *  and a large star wrapped in its own spinning sunburst (Epic). */
function WinEmblem({ level }: { level: number }) {
  if (level >= 4) {
    return (
      <div className="gameover-emblem win emblem-epic" aria-hidden="true">
        <span className="emblem-sunburst" />
        <span className="emblem-star">★</span>
      </div>
    )
  }
  if (level === 3) {
    return (
      <div className="gameover-emblem win emblem-trio" aria-hidden="true">
        <span>★</span>
        <span className="mid">★</span>
        <span>★</span>
      </div>
    )
  }
  return (
    <div className="gameover-emblem win" aria-hidden="true">
      {level === 2 ? '★' : level === 1 ? '✦' : '✷'}
    </div>
  )
}

const CONFETTI_BY_LEVEL: Record<number, number> = { 1: 16, 2: 30, 3: 56, 4: 100 }
const CONFETTI_COLORS = ['#c8452f', '#d99a24', '#efe6d6', '#7c5cff', '#6ea84f']

/** CSS-only falling confetti. Pieces are randomized once (useMemo) so they don't reshuffle on
 *  re-render, and loop continuously to keep the celebration alive. */
function Confetti({ count }: { count: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 3,
        dur: 2.6 + Math.random() * 2.4,
        size: 6 + Math.random() * 8,
        drift: (Math.random() * 2 - 1) * 80,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() < 0.35,
      })),
    [count],
  )
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.round ? p.size : p.size * 0.5}px`,
            background: p.color,
            borderRadius: p.round ? '50%' : '1px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

/** Map a `?preview=` value to a synthetic result so end-of-game overlays can be previewed. */
function previewResult(preview: string | null): GameResult | null {
  switch (preview) {
    case 'loss':
      return { outcome: 'loss', reason: 'missions' }
    case 'draw':
      return { outcome: 'win', tier: 'Draw', points: 10 }
    case 'minor':
      return { outcome: 'win', tier: 'Minor Victory', points: 16 }
    case 'victory':
      return { outcome: 'win', tier: 'Victory', points: 20 }
    case 'major':
      return { outcome: 'win', tier: 'Major Victory', points: 24 }
    case 'epic':
      return { outcome: 'win', tier: 'Epic Victory', points: 34 }
    default:
      return null
  }
}
