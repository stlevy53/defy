// Resist! — playable prototype UI (Phase 3). A thin view over the headless engine: it renders
// GameState, offers legalActions as buttons, and answers pendingDecision via the DecisionPanel.

import { useGame } from './ui/useGame'
import { DecisionPanel } from './ui/DecisionPanel'
import { Card } from './ui/Card'
import { Tip } from './ui/Tip'
import { actionLabel, missionOf, enemyOf, guidanceFor, ROUND_PHASES } from './ui/format'
import type { Action, GameState } from './engine'

export function App() {
  const { state, actions, dispatch, respond, undo, newGame, canUndo, error, seed } = useGame()

  const group = (t: Action['type']) => actions.filter((a) => a.type === t)

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
            <Tip below text="Attack Strength — points banked to spend defeating targets this Attack.">
              <span className="pill accent">⚔ {state.attackStrength}</span>
            </Tip>
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

      <PhaseGuide state={state} actions={actions} />

      <section className="missions">
        {state.missionRow.map((slot) => (
          <Card key={slot.uid} kind="mission" slot={slot} state={state} />
        ))}
      </section>

      <section className="play-area">
        <Zone title="Hidden Maquis" cards={state.inPlay.filter((m) => m.side === 'hidden')} side="hidden" />
        <Zone title="Revealed Maquis" cards={state.inPlay.filter((m) => m.side === 'revealed')} side="revealed" />
      </section>

      <section className="hand">
        <h3>Your hand</h3>
        <div className="cards">
          {state.hand.map((c) => (
            <Card key={c.uid} kind="maquisHand" dataId={c.dataId} />
          ))}
          {state.hand.length === 0 && <span className="muted">empty</span>}
        </div>
      </section>

      <section className="control-deck">
        {error && <div className="error">{error}</div>}

        <SurviveCaution state={state} />

        {state.pendingDecision ? (
          <DecisionPanel decision={state.pendingDecision} state={state} onRespond={respond} />
        ) : state.result ? null : (
          <div className="actions">
            <ActionGroup title="Play" actions={group('PlayMaquis')} state={state} onClick={dispatch} />
            <ActionGroup title="Actions" actions={group('UseAction')} state={state} onClick={dispatch} />
            <ActionGroup title="Choose a Mission" actions={group('ChooseMission')} state={state} onClick={dispatch} />
            <ActionGroup title="Strike" actions={group('SpendAttackOn')} state={state} onClick={dispatch} />
            <ActionGroup
              title="Turn"
              actions={[...group('AdvancePhase'), ...group('EndResistance'), ...group('Continue')]}
              state={state}
              onClick={dispatch}
            />
            {actions.length === 0 && <span className="muted">Nothing to do.</span>}
          </div>
        )}
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
 *  Steers a new player through PLAN → ATTACK → AFTERMATH → RECOVER. */
function PhaseGuide({ state, actions }: { state: GameState; actions: Action[] }) {
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
      {guide && (
        <div className="phase-message">
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
    </section>
  )
}

/** During ATTACK, warn that any undefeated SURVIVE defenders at the chosen Mission will resolve
 *  their effect when the player finishes attacking — even if the Mission itself is defeated. */
function SurviveCaution({ state }: { state: GameState }) {
  if (state.phase !== 'ATTACK') return null
  const slot = state.missionRow.find((s) => s.uid === state.chosenMissionUid)
  if (!slot) return null

  const counts = new Map<string, number>()
  for (const e of slot.enemies) {
    if (enemyOf(e.typeId)?.keyword === 'SURVIVE') counts.set(e.typeId, (counts.get(e.typeId) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((n, c) => n + c, 0)
  if (total === 0) return null

  return (
    <div className="caution">
      <div className="caution-head">
        ⚠ {total} defender{total > 1 ? 's' : ''} will resolve a SURVIVE effect when you finish attacking
        {slot.defeated ? ' — even though the Mission is defeated' : ''}:
      </div>
      <ul>
        {[...counts.entries()].map(([typeId, n]) => {
          const t = enemyOf(typeId)
          return (
            <li key={typeId}>
              <b>
                {t?.name}
                {n > 1 ? ` ×${n}` : ''}
              </b>{' '}
              — {t?.effect}
            </li>
          )
        })}
      </ul>
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

function Zone({ title, cards, side }: { title: string; cards: GameState['inPlay']; side: 'hidden' | 'revealed' }) {
  return (
    <div className="zone">
      <h4>{title}</h4>
      <div className="cards">
        {cards.map((m) => (
          <Card key={m.uid} kind="maquisPlayed" dataId={m.dataId} side={side} />
        ))}
        {cards.length === 0 && <span className="muted">—</span>}
      </div>
    </div>
  )
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

function victoryPoints(state: GameState): number {
  return state.defeatedMissions.reduce((n, m) => n + (missionOf(m.dataId)?.victoryPoints ?? 0), 0)
}

function lossReason(reason?: string): string {
  if (reason === 'civilians') return '5 civilians lost'
  if (reason === 'missions') return 'two missions failed'
  if (reason === 'spies') return 'a hand of only Spies'
  return 'the resistance is broken'
}
