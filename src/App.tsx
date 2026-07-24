// Resist! — playable prototype UI (Phase 3). A thin view over the headless engine: it renders
// GameState, offers legalActions as buttons, and answers pendingDecision via the DecisionPanel.

import { useGame } from './ui/useGame'
import { DecisionPanel } from './ui/DecisionPanel'
import { Card } from './ui/Card'
import { actionLabel, missionOf, phaseGuide, ROUND_PHASES } from './ui/format'
import type { RoundPhase } from './ui/format'
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
          <span className={`pill phase-${state.phase}`}>{state.phase}</span>
          {(state.phase === 'ATTACK' || state.attackStrength > 0) && (
            <span className="pill accent">⚔ {state.attackStrength}</span>
          )}
          <span className="pill">★ {victoryPoints(state)} VP</span>
          {state.failedMissions > 0 && <span className="pill warn">✗ {state.failedMissions} failed</span>}
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

      <PhaseGuide phase={state.phase} />

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

/** Breadcrumb of the four round phases with the current one highlighted, plus a what-to-do-now
 *  message for that phase. Steers a new player through PLAN → ATTACK → AFTERMATH → RECOVER. */
function PhaseGuide({ phase }: { phase: GameState['phase'] }) {
  const activeIndex = ROUND_PHASES.indexOf(phase as RoundPhase) // -1 at GAME_OVER
  const guide = activeIndex >= 0 ? phaseGuide[phase as RoundPhase] : null
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
            <span className="phase-name">{phase}</span>
            {guide.goal}
            {guide.auto && <span className="phase-auto">automatic</span>}
          </div>
          <ol className="phase-steps">
            {guide.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
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
