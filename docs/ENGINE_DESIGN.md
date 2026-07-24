# Rules Engine — Design (Phase 2)

Architecture for the headless *Resist!* rules engine. Goal: a pure, deterministic, framework-agnostic core that the UI drives via intents, validated against the rulebook's worked example before any UI is built.

Review this before implementation. Open decisions are listed at the end — approving them unblocks coding.

## 1. Principles

- **Pure & deterministic.** The engine is pure functions over a plain-data `GameState`. No I/O, no `Date`, no `Math.random` — randomness comes from a seeded RNG stored *in* the state. Same seed + same actions ⇒ same game. This is what makes save/load, undo, and reproducible tests trivial.
- **Headless & framework-agnostic.** Zero React. The UI reads `GameState` and dispatches `Action`s; it holds no rules.
- **Data-driven.** Static card data comes from `/data` (already built). Per-card behavior lives in an effect registry keyed by card id/type.
- **Explicit interaction.** Many effects require mid-resolution player choices ("look at top 3, discard any"). The engine surfaces these as a `pendingDecision` and suspends, rather than calling back into UI. Callers resolve it and the engine continues.
- **Serializable.** `GameState` is JSON — no classes, functions, or `Map`s in the state. Enables save files and an undo stack.

## 2. State shape (sketch)

```ts
type Side = 'hidden' | 'revealed'
type Phase = 'PLAN' | 'ATTACK' | 'AFTERMATH' | 'RECOVER' | 'GAME_OVER'

// A physical card instance in play — distinct from its static data row.
interface CardInstance { uid: string; dataId: string }         // maquis/spy/civilian/mission
interface EnemyInstance { uid: string; typeId: string; defense: number; faceUp: boolean }

interface MaquisInPlay { uid: string; dataId: string; side: Side }

interface MissionSlot {
  uid: string
  dataId: string
  faceDown: boolean          // a failed mission is flipped face-down in its slot
  enemies: EnemyInstance[]   // garrison, face-down until revealed
}

interface GameState {
  rng: number                // seeded RNG state (see §6)
  phase: Phase
  round: number

  hidden:  { deck: CardInstance[]; discard: CardInstance[] }   // Maquis + shuffled-in Spies
  recruit: { deck: CardInstance[]; revealed: CardInstance[] }
  hand: CardInstance[]

  inPlay: MaquisInPlay[]        // Maquis played this round (hidden + revealed zones)

  missionRow: MissionSlot[]     // fixed available-mission slots
  missionDeck: CardInstance[]
  defeatedMissions: CardInstance[]

  enemyDeck: EnemyInstance[]
  enemyDiscard: EnemyInstance[]

  civilianDeck: CardInstance[]
  graveyard: CardInstance[]     // civilians; loss at sum(civilians) >= 5

  spiesAvailable: number        // the 3 Spies set aside for effects

  // per-round scratch
  chosenMissionUid: string | null
  recoverDrawModifier: number   // Valley (+1) / Border (-1) effects on next draw
  failedMissions: number

  pendingDecision: Decision | null   // engine awaiting input
  effectQueue: EffectTask[]          // internal resolution queue (see §4)
  result: GameResult | null          // set at GAME_OVER
  log: LogEntry[]
}
```

Card conservation is an invariant: every instance created at setup lives in exactly one zone at all times (except cards "removed from the game"). A dev-only assert checks this after every action.

## 3. Public API

```ts
createGame(options: { seed: number; draft?: boolean }): GameState
// NOTE: `draft` is not yet implemented (setup.ts is standard setup only). Drafting is
// interactive (choose 1 of 2, twelve times), so it depends on the pendingDecision system —
// scheduled as its own Phase 2 slice after the decision loop exists.
legalActions(state: GameState): Action[]              // what the UI may offer now
applyAction(state: GameState, action: Action): GameState   // may set pendingDecision
resolveDecision(state: GameState, response: DecisionResponse): GameState
```

`Action` = player intents, e.g. `PlayMaquis{uid, side}`, `UseAction{uid}`, `ChooseMission{uid}`, `SpendAttackOn{targetUid}`, `AdvancePhase`, `EndResistance`, `Continue`. Every mutation goes through `applyAction`/`resolveDecision`; both return a fresh state (structural sharing via Immer — see decisions).

## 4. Effect system — the crux

Each card behavior is a handler in a registry:

```ts
maquisActions[dataId][side]  // Celia.hidden, Nicolás.revealed (null = X)
missionEffects[dataId]       // keyed by mission; runs on its keyword timing
enemyEffects[typeId]         // keyed by enemy type; runs on its keyword timing
```

A handler receives an `EffectContext` (the draft state + the source instance + relevant target) and mutates the draft. Handlers may need input, so resolution runs through an **effect queue** rather than nested callbacks:

- Triggering an effect pushes an `EffectTask` onto `effectQueue`.
- A driver loop pops and runs tasks. A task may push follow-up tasks.
- If a task needs a choice, it sets `pendingDecision` and returns; the loop halts. `resolveDecision` re-enters the loop with the response.

This keeps everything pure and serializable (the queue is plain data; a task references a handler by id + saved args, not a closure). It also gives correct ordering for simultaneous triggers by letting the player order the queued tasks.

**Triggers vs. constraints.** Not every effect is a queueable one-shot. Some DEFEND effects are round-long *constraints* (Train Depot: "Maquis cannot be revealed during ATTACK"; Grunt/Guard: defeat-order restrictions). The registry supports both shapes: `trigger` handlers run through the queue; `constraint` entries are declarative facts that `legalActions` and `SpendAttackOn` validation consult while the source card is active. "When this Mission is chosen, immediately…" effects (Bunker, Crossroads) fire at `ChooseMission`; the engine allows no action between `ChooseMission` and DEFEND resolution, so this is equivalent to start-of-ATTACK — but the sequencing must enforce that.

`Decision` shape (unified so the UI renders one component):

```ts
type Decision =
  | { kind: 'selectCards';  from: Zone; min: number; max: number; prompt: string }
  | { kind: 'selectTarget'; candidates: string[]; prompt: string }
  | { kind: 'orderCards';   cards: string[]; prompt: string }
  | { kind: 'chooseOption'; options: string[]; prompt: string }
```

## 5. Phase flow

State machine `PLAN → ATTACK → AFTERMATH → RECOVER → (loop)`, each with sub-steps that may raise decisions:

- **PLAN** — play Maquis (choose hidden/revealed), optionally fire PLAN / PLAN‑ATTACK actions; then `ChooseMission` and reveal its face-down enemies.
- **ATTACK** — resolve chosen mission's + enemies' **DEFEND** effects; play remaining Maquis (all must be played), firing ATTACK actions; compute Attack Strength and spend it target-by-target (`SpendAttackOn`). **DEFEAT** effects fire on defeat; leftover strength is lost; undefeated enemies resolve **SURVIVE** then discard.
- **AFTERMATH** — check civilian loss (≥5); resolve mission outcome (refill on success, flip face-down + failed-count on failure, 2nd failure = loss); choose `EndResistance` or `Continue` (must end if no available missions).
- **RECOVER** — cleanup (revealed→revealed pile, hidden+spies→hidden discard); draw new hand of 5 (apply `recoverDrawModifier`, reshuffle discard if needed); all-Spy hand = loss.

`legalActions` is derived from `phase` + sub-step so the UI never has to know the rules.

## 6. Calculations, RNG, undo

- **Attack Strength** is computed when entering the Defeat-Targets step: base sum of played Maquis side-attack + aggregate modifiers evaluated against the *then-current* board (Soledad/Abel "+1 per…", Marcelino "+1 per other Maquis"). Computed fresh so dynamic counts are correct.
- **Effective defense** of a target = base ± active modifiers, layered by a single `effectiveDefense(target, state)` (Engineer +1 to others here, Mayor's House +1, Benigno −1 for ≥2, Ricardo halves mission defense round-up). One function, so timing/order is centralized. **Application order is a rulebook FAQ ruling and is player-visible: DEFEND-sourced modifiers (Engineer, Mayor's House) apply before ATTACK-action modifiers (Benigno, Ricardo).** (A 1-defense enemy under Engineer+Benigno ends at 1, not 2.)
- **Scoring edge:** the rulebook win table starts at 1 VP ("1–14 Draw"); 0 VP is unmapped. Engine decision (proposed: treat 0 as Draw) — record the ruling in `rules.json` when implemented. Scoring applies whenever the game ends undefeated, including the forced end when no Available Missions remain.
- **Supply caps & resets:** "Add a new Spy" effects no-op when `spiesAvailable` is 0 (only 6 physical spies exist). `recoverDrawModifier` (Valley +1 / Border −1, DEFEAT effects) applies only to that round's Recover draw, then resets to 0.
- **RNG**: `mulberry32` seeded integer in state; `shuffle` consumes it. Deterministic and serializable.
- **Undo/serialization**: `GameState` is JSON. History = stack of prior states (simplest) or an action log to replay. Undo pops to the last player-decision boundary.

## 7. Module layout

```
src/engine/
  types.ts            GameState, CardInstance, Action, Decision
  rng.ts              seeded RNG + shuffle
  setup.ts            createGame (standard + draft variant)
  zones.ts            zone move helpers + conservation invariant
  calc.ts             attackStrength, effectiveDefense
  phases/             plan.ts attack.ts aftermath.ts recover.ts
  effects/            maquis.ts missions.ts enemies.ts registry.ts
  actions.ts          applyAction, legalActions, resolveDecision, effect-queue driver
  index.ts            public API
  __tests__/
    workedExample.test.ts     // rulebook pp. 11–13, the M2 acceptance gate
    effects/*.test.ts         // per-effect unit tests
    invariants.test.ts        // card conservation, counts
```

## 8. Testing & acceptance

- **Unit** — each Maquis/mission/enemy effect tested in isolation.
- **Integration** — encode the rulebook's worked first turn as a scripted `Action`/`Decision` sequence; assert intermediate and final state. Passing this is the **M2 gate** — the engine is "correct" when it reproduces the rulebook turn-by-turn.
- **Invariants** — card conservation and per-zone counts hold after every action (property-style).

## 9. Decisions to confirm

1. **Immer** for ergonomic immutable updates in handlers (adds one dependency). *Proposed: yes.*
2. **First-pass coverage** — implement all 24 Maquis + all 20 mission + all 8 enemy effects up front, vs. stub the rarest and fill in later. *Proposed: implement all; the set is small and closed.*
3. **Undo model** — full state-history stack (simple, more memory) vs. action-replay (compact, more logic). *Proposed: state-history stack for v1.*
4. **Effect edge cases** — cover the rulebook FAQ clarifications (reshuffle-on-empty, discard≠defeat, mid-round draws must be played) in v1. *Proposed: yes, they're core.*
5. **RNG seed** — expose seed in `createGame` for reproducible games/tests. *Proposed: yes.*
```
