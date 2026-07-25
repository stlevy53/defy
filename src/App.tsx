// Resist! — playable prototype UI (Phase 3). A thin view over the headless engine: it renders
// GameState, offers legalActions as buttons, and answers pendingDecision via the DecisionPanel.

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useGame } from './ui/useGame'
import { DecisionPanel } from './ui/DecisionPanel'
import { Card } from './ui/Card'
import { Tip } from './ui/Tip'
import { actionLabel, missionOf, guidanceFor, ROUND_PHASES, boardPickable, countActionBonus } from './ui/format'
import type { Action, Decision, GameState } from './engine'

export function App() {
  const { state, actions, dispatch, respond, undo, newGame, canUndo, error, seed } = useGame()

  const group = (t: Action['type']) => actions.filter((a) => a.type === t)

  const canPlay = (acts: Action[], uid: string, side: 'hidden' | 'revealed') =>
    acts.some((a) => a.type === 'PlayMaquis' && a.uid === uid && a.side === side)

  const canChoose = (acts: Action[], uid: string) =>
    acts.some((a) => a.type === 'ChooseMission' && a.uid === uid)

  // Every legal strike target this Attack (the chosen Mission and/or its Enemies), so the board can
  // make them directly clickable instead of listing them as buttons.
  const strikeTargets = actions.flatMap((a) => (a.type === 'SpendAttackOn' ? [a.targetUid] : []))

  // A "pick exactly one" pending decision can be answered by clicking the candidate on the board
  // (same idiom as striking). Candidates without a board representation stay in the DecisionPanel.
  const pickTargets = singlePickCandidates(state.pendingDecision)
    .filter((uid) => boardPickable(state, uid))
  const onPick = (uid: string) => respond([uid])

  // Every player choice — a pending decision, the phase-level Turn buttons, or an error — lives in
  // one place: the right half of the guidance tile (see PhaseGuide), so the player never hunts for it.
  const turnActions = [...group('AdvancePhase'), ...group('EndResistance'), ...group('Continue')]
  const playerChoice = state.pendingDecision ? (
    // Keyed on the prompt so each step of a multi-stage decision re-mounts and flashes.
    <div className="phase-decision" key={state.pendingDecision.prompt}>
      <DecisionPanel decision={state.pendingDecision} state={state} onRespond={respond} />
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          <strong>RESIST!</strong> <span className="muted">Maquis vs. Franco</span>
        </div>
        <div className="status">
          <span className="pill">Round {state.round}</span>
          <Tip below text="The current phase of the round.">
            <span className={`pill phase-${state.phase}`}>{state.phase}</span>
          </Tip>
          {(state.phase === 'ATTACK' || state.attackStrength > 0) && (
            <AttackStrengthPill value={state.attackStrength} />
          )}
          <Tip below text="Victory Points — your score so far from defeated Missions.">
            <span className="pill">★ {victoryPoints(state)} VP</span>
          </Tip>
          {state.failedMissions > 0 && (
            <Tip below text="Failed Missions — fail two and the resistance is crushed.">
              <span className="pill warn">✗ {state.failedMissions} failed</span>
            </Tip>
          )}
        </div>
        <div className="controls">
          <button className="ghost" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button className="ghost" onClick={() => newGame()}>
            New game
          </button>
          <span className="muted seed">seed {seed}</span>
        </div>
      </header>

      {state.result && (
        <div className={`banner ${state.result.outcome}`}>
          {state.result.outcome === 'win'
            ? `${state.result.tier} — ${state.result.points} Victory Points`
            : `Defeat — ${lossReason(state.result.reason)}`}
          <button className="confirm" onClick={() => newGame()}>
            Play again
          </button>
        </div>
      )}

      <PhaseGuide state={state} actions={actions} choices={sideContent} />

      <section className="missions">
        {state.missionRow.map((slot) => (
          <Card
            key={slot.uid}
            kind="mission"
            slot={slot}
            state={state}
            canChoose={canChoose(actions, slot.uid)}
            onChoose={(uid) => dispatch({ type: 'ChooseMission', uid })}
            strikeTargets={strikeTargets}
            onStrike={(uid) => dispatch({ type: 'SpendAttackOn', targetUid: uid })}
            pickTargets={pickTargets}
            onPick={onPick}
          />
        ))}
      </section>

      <section className="play-area">
        <Zone
          title="Hidden Maquis"
          cards={state.inPlay.filter((m) => m.side === 'hidden')}
          side="hidden"
          state={state}
          actions={actions}
          onUse={(uid) => dispatch({ type: 'UseAction', uid })}
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
          pickTargets={pickTargets}
          onPick={onPick}
        />
      </section>

      <section className="hand">
        <h3>Your hand</h3>
        <div className="cards">
          {state.hand.map((c) => (
            <Card
              key={c.uid}
              kind="maquisHand"
              dataId={c.dataId}
              uid={c.uid}
              canPlayHidden={canPlay(actions, c.uid, 'hidden')}
              canPlayRevealed={canPlay(actions, c.uid, 'revealed')}
              onPlay={(uid, side) => dispatch({ type: 'PlayMaquis', uid, side })}
              pickable={pickTargets.includes(c.uid)}
              onPick={onPick}
            />
          ))}
          {state.hand.length === 0 && <span className="muted">empty</span>}
        </div>
      </section>

      <Piles state={state} />

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

/** Breadcrumb of the four round phases with the current one highlighted, plus sub-step-aware
 *  guidance: a prominent "what to do now" line and the phase's steps with the active ones lit.
 *  Steers a new player through PLAN → ATTACK → AFTERMATH → RECOVER. Any player choice (a decision
 *  or the Turn buttons), when present, fills the right half of the tile — no separate section, so
 *  the page doesn't grow and choices always appear in one consistent place. */
function PhaseGuide({ state, actions, choices }: { state: GameState; actions: Action[]; choices: ReactNode }) {
  const guide = guidanceFor(state, actions)
  const activeIndex = guide ? ROUND_PHASES.indexOf(guide.phase) : -1
  return (
    <section className="phase-guide">
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
      {(guide || choices) && (
        <div className="phase-message">
          {guide && (
            <div className="phase-message-main">
              <div className="phase-goal">
                <span className="phase-name">{guide.phase}</span>
                {guide.goal}
                {guide.auto && <span className="phase-auto">automatic</span>}
              </div>
              <p className="phase-now">{guide.now}</p>
              <ol className="phase-steps">
                {guide.steps.map((s, i) => (
                  <li key={i} className={s.active ? 'active' : ''}>
                    {s.text}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {choices && <div className="phase-message-side">{choices}</div>}
        </div>
      )}
    </section>
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
  pickTargets,
  onPick,
}: {
  title: string
  cards: GameState['inPlay']
  side: 'hidden' | 'revealed'
  state: GameState
  actions: Action[]
  onUse: (uid: string) => void
  pickTargets: string[]
  onPick: (uid: string) => void
}) {
  return (
    <div className="zone">
      <h4>{title}</h4>
      <div className="cards">
        {cards.map((m) => (
          <Card
            key={m.uid}
            kind="maquisPlayed"
            dataId={m.dataId}
            uid={m.uid}
            side={side}
            canUse={actions.some((a) => a.type === 'UseAction' && a.uid === m.uid)}
            onUse={() => onUse(m.uid)}
            pickable={pickTargets.includes(m.uid)}
            onPick={onPick}
            liveBonus={countActionBonus(state, m.dataId, side, m.uid)}
          />
        ))}
        {cards.length === 0 && <span className="muted">—</span>}
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

function Piles({ state }: { state: GameState }) {
  const p: [string, number][] = [
    ['Hidden deck', state.hidden.deck.length],
    ['Hidden discard', state.hidden.discard.length],
    ['Recruit', state.recruit.deck.length],
    ['Revealed pile', state.recruit.revealed.length],
    ['Enemy deck', state.enemyDeck.length],
    ['Enemy discard', state.enemyDiscard.length],
    ['Mission deck', state.missionDeck.length],
    ['Defeated', state.defeatedMissions.length],
    ['Graveyard', state.graveyard.length],
    ['Spy supply', state.spiesAvailable],
    ['Removed', state.removedFromGame.length],
  ]
  return (
    <section className="piles">
      {p.map(([label, n]) => (
        <span key={label} className="pile">
          <b>{n}</b> {label}
        </span>
      ))}
    </section>
  )
}

/** The Attack Strength pill. When the value rises (e.g. Consuelo discards an Enemy and gains its
 *  Defense as Attack, or a Maquis banks its attack), it pulses and floats a green "+N" so the gain
 *  is unmistakable. Spends (which lower it) already read clearly on the board, so only gains flash. */
function AttackStrengthPill({ value }: { value: number }) {
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
  return (
    <Tip below text="Attack Strength — points banked to spend defeating targets this Attack.">
      <span className={`pill accent atk ${gain > 0 ? 'atk-bump' : ''}`}>
        ⚔ {value}
        {gain > 0 && <span className="atk-delta">+{gain}</span>}
      </span>
    </Tip>
  )
}

function victoryPoints(state: GameState): number {
  return state.defeatedMissions.reduce((n, m) => n + (missionOf(m.dataId)?.victoryPoints ?? 0), 0)
}

function lossReason(reason?: string): string {
  if (reason === 'civilians') return '5 civilians lost'
  if (reason === 'missions') return 'two missions failed'
  if (reason === 'spies') return 'a hand of only Spies'
  return 'the resistance is broken'
}
