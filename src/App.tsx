// Resist! — playable prototype UI (Phase 3). A thin view over the headless engine: it renders
// GameState, offers legalActions as buttons, and answers pendingDecision via the DecisionPanel.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useGame, useReinforcements } from './ui/useGame'
import { DecisionPanel } from './ui/DecisionPanel'
import { Card } from './ui/Card'
import { Tip } from './ui/Tip'
import { actionLabel, missionOf, guidanceFor, ROUND_PHASES, boardPickable, countActionBonus } from './ui/format'
import type { Action, Decision, GameResult, GameState } from './engine'

export function App() {
  const { state, actions, dispatch, respond, undo, newGame, canUndo, error, seed, gameId } = useGame()

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
    newGame()
  }

  // What end-of-game overlay to show: a preview override wins, else the real game result.
  const shown = previewResult(preview) ?? state.result

  // Enemy chips added to a Mission this transition (reinforcements) — used to animate them in.
  const reinforced = useReinforcements(state, gameId)

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

      {shown?.outcome === 'loss' && <LossOverlay reason={shown.reason} onPlayAgain={playAgain} />}
      {shown?.outcome === 'win' && (
        <WinOverlay tier={shown.tier} points={shown.points} onPlayAgain={playAgain} />
      )}

      <PhaseGuide state={state} actions={actions} choices={sideContent} />

      <div className="board-grid">
      <div className="board-main">
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
            newEnemyUids={reinforced[slot.uid]}
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
        <h3 className="hand-head">
          Your hand
          <HandDrawNote state={state} />
        </h3>
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

      <Piles state={state} />
      </div>
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

interface PileInfo {
  label: string
  n: number
  tone: string
  hint: string
}

function Piles({ state }: { state: GameState }) {
  const piles: PileInfo[] = [
    { label: 'Hidden deck', n: state.hidden.deck.length, tone: 'hidden', hint: 'Hidden Maquis (and shuffled Spies) you draw your hand from.' },
    { label: 'Hidden discard', n: state.hidden.discard.length, tone: 'hidden', hint: 'Played hidden Maquis + discarded Spies; reshuffled into the Hidden deck when it runs out.' },
    { label: 'Recruit deck', n: state.recruit.deck.length, tone: 'revealed', hint: 'Inactive Maquis — only recovered by specific effects.' },
    { label: 'Revealed pile', n: state.recruit.revealed.length, tone: 'revealed', hint: 'Maquis played revealed this game — set aside, out of the decks.' },
    { label: 'Enemy deck', n: state.enemyDeck.length, tone: 'enemy', hint: 'Face-down Enemies dealt to refilled Missions by their Garrison.' },
    { label: 'Enemy discard', n: state.enemyDiscard.length, tone: 'enemy', hint: 'Defeated/discarded Enemies; reshuffled into the Enemy deck when it runs out.' },
    { label: 'Mission deck', n: state.missionDeck.length, tone: 'mission', hint: 'Era-2 then Era-3 Missions that refill the row as you defeat Missions.' },
    { label: 'Defeated', n: state.defeatedMissions.length, tone: 'mission', hint: 'Missions you have defeated — these score their Victory Points.' },
    { label: 'Graveyard', n: state.graveyard.length, tone: 'civ', hint: 'Lost Civilians. Reach 5 civilians here and the resistance is crushed.' },
    { label: 'Spy supply', n: state.spiesAvailable, tone: 'spy', hint: 'Spies available to be added to your Hidden deck by enemy effects.' },
    { label: 'Removed', n: state.removedFromGame.length, tone: 'removed', hint: 'Cards removed from the game entirely (back in the box).' },
  ]
  return (
    <aside className="piles">
      <h3 className="piles-head">Card Piles</h3>
      {piles.map((p) => (
        <div key={p.label} className={`pile ${p.n === 0 ? 'empty' : ''}`} title={`${p.label} — ${p.hint}`}>
          <span className={`deck-ico tone-${p.tone}`}>
            <span className="deck-count">{p.n}</span>
          </span>
          <span className="pile-label">{p.label}</span>
        </div>
      ))}
    </aside>
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
function LossOverlay({ reason, onPlayAgain }: { reason?: string; onPlayAgain: () => void }) {
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
function WinOverlay({ tier, points, onPlayAgain }: { tier?: string; points?: number; onPlayAgain: () => void }) {
  const info = WIN_TIERS[tier ?? 'Draw'] ?? WIN_TIERS.Draw
  const level = info.level
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
