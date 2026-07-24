// Resist! — playable prototype UI (Phase 3). A thin view over the headless engine: it renders
// GameState, offers legalActions as buttons, and answers pendingDecision via the DecisionPanel.

import { useGame } from './ui/useGame'
import { DecisionPanel } from './ui/DecisionPanel'
import { actionLabel, missionOf, nameOfMaquis, maquisAttack, enemyOf, phaseBlurb } from './ui/format'
import type { Action, GameState, MissionSlot } from './engine'

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

      <p className="blurb">{phaseBlurb[state.phase]}</p>

      <section className="missions">
        {state.missionRow.map((slot) => (
          <MissionCard key={slot.uid} slot={slot} state={state} />
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
            <div key={c.uid} className={`card hand-card ${c.dataId === 'spy' ? 'spy' : ''}`}>
              <div className="card-name">{nameOfMaquis(c.dataId)}</div>
              {c.dataId !== 'spy' && (
                <div className="card-sub">
                  H {maquisAttack(c.dataId, 'hidden')} · R {maquisAttack(c.dataId, 'revealed')}
                </div>
              )}
            </div>
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

function MissionCard({ slot, state }: { slot: MissionSlot; state: GameState }) {
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
        <span className={`kw kw-${data?.keyword}`}>{data?.keyword}</span>
      </div>
      <div className="mission-stats">
        <span title="Defense">🛡 {defense}</span>
        <span title="Victory Points">★ {data?.victoryPoints}</span>
        <span title="Garrison">☗ {data?.garrison}</span>
      </div>
      <p className="effect">{data?.effect}</p>
      <div className="enemies">
        {slot.enemies.map((e) => (
          <span key={e.uid} className={`enemy ${e.faceUp ? '' : 'facedown'} kw-${enemyOf(e.typeId)?.keyword}`}>
            {e.faceUp ? `${enemyOf(e.typeId)?.name} ${e.defense}` : '🂠'}
          </span>
        ))}
        {slot.enemies.length === 0 && <span className="muted">clear</span>}
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
          <div key={m.uid} className={`card played ${side}`}>
            <div className="card-name">{nameOfMaquis(m.dataId)}</div>
            <div className="card-sub">⚔ {maquisAttack(m.dataId, side)}</div>
          </div>
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
