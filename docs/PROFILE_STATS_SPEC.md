# Player profile & career stats — Spec (v0.1)

**Status:** design locked · not yet built · **Build target:** post-prototype · **Owner:** DEFY! · **Area:** UI (`src/ui`) + a new pure stats module

A single local player profile for prototyping: a display name plus a compact per-game snapshot,
kept in `localStorage`, from which every career stat and chart is derived at read time. This spec
locks the **data contract**, the **scoring/chart rules**, and the **local-now / Steam-later**
boundary so the first build slice has something unambiguous to code against. It does not build the
UI or the store — those come in the first implementation slice noted at the end.

Companion design doc: `player_profile_stats` plan (idea list and rationale). This spec is the part
that must not drift.

## Why a snapshot, not counters

DEFY already knows how every game ended: `GameResult` in
[`src/engine/types.ts`](../src/engine/types.ts) carries the win tier + points or the loss reason,
and the final `GameState` still holds every zone (`defeatedMissions`, `graveyard`, `failedMissions`,
`round`, `removedFromGame`, …). It keeps **no career**: only a one-slot mid-game save
(`defy.save.v1` in [`src/ui/useGame.ts`](../src/ui/useGame.ts)) and UI prefs.

The contract is therefore: **write one compact `GameRecord` when a game reaches `GAME_OVER`, and
derive everything else.** No pre-aggregated counters (they go stale the moment we invent a new
stat), no full undo history, no `state.log` archive. Adding a future stat is a new derivation over
existing records — never a migration — *unless* it needs a field we never snapshotted. That is why
the record below is generous with cheap, game-over-available fields.

---

## LOCKED 1 — `GameRecord` snapshot contract

Written once per finished game, appended to `profile.games`. All fields are derivable from the
final `GameState` + `GameResult` today (no mid-game instrumentation required). Field sources are
noted so the build wires them to the right place.

```ts
/** One finished game. Append-only; never mutated after write. */
interface GameRecord {
  // --- Run identity ---
  playedAt: number          // Date.now() at GAME_OVER
  seed: number              // the New Game seed (reproduces the deal from Settings)
  draft: boolean            // draft setup used? (state.draftPool history / New Game flag)
  durationMs?: number       // optional; only if a clock is started at New Game (see LOCKED 2 note)

  // --- Official result (from GameResult) ---
  outcome: 'win' | 'loss'   // result.outcome
  tier?: string             // result.tier  — win only: Draw|Minor Victory|Victory|Major Victory|Epic Victory
  points?: number           // result.points — win only: official banked VP
  reason?: string           // result.reason — loss only: 'civilians'|'missions'|'spies'

  // --- Progress, present even on a loss (from final GameState zones) ---
  defeatedVp: number        // sum of victoryPoints over defeatedMissions (MissionCard.victoryPoints)
  round: number             // state.round reached
  failedMissions: number    // state.failedMissions (0..2)
  civiliansLost: number     // sum of CivilianCard.civilians over graveyard
  missionsDefeated: string[]// dataIds in defeatedMissions (enables mission bingo / era reach)

  // --- Optional v1.1 (still cheap from final zones; add when the stat that needs it ships) ---
  spiesRemoved?: number     // count of spies in removedFromGame
  removedMaquisIds?: string[]// maquis dataIds in removedFromGame ("martyrs")
  eraReached?: 1 | 2 | 3    // max MissionCard.era among missionsDefeated
}
```

Field-source rules that are part of the contract:

- `points` / `tier` are **win-only** and come straight from `GameResult`; do **not** synthesize a
  score for a loss. Losses carry progress via `defeatedVp` instead.
- `defeatedVp` is always written (win *and* loss) = `sum(victoryPoints)` over `defeatedMissions`,
  looked up in mission data (`MissionCard.victoryPoints`,
  [`src/types/index.ts`](../src/types/index.ts)). On a win it will usually equal `points`; keep both
  so the chart's two series (LOCKED 2) never have to guess.
- `civiliansLost` = sum of `CivilianCard.civilians` over `graveyard` (the loss threshold is a **sum
  ≥ 5**, not a card count — do not use `graveyard.length`).
- `missionsDefeated` stores **dataIds**, not uids, so bingo/era/nemesis derivations join against
  static mission data across builds.

Profile document shape (single local profile):

```ts
interface Profile {
  version: 1
  displayName: string       // editable; one profile while prototyping
  games: GameRecord[]       // append-only career, newest last
}
// localStorage key: 'defy.profile.v1'
```

The append hook lives where the game transitions to `GAME_OVER`
([`src/ui/useGame.ts`](../src/ui/useGame.ts) / [`src/App.tsx`](../src/App.tsx)). Append exactly once
per game (guard against re-render / reload double-writes, e.g. by `seed` + `playedAt` or an
"already recorded this game id" flag).

---

## LOCKED 2 — score chart & win-rate semantics

Two rules that must hold for every score-over-time chart and every "score" aggregate, because
DEFY's scoring has two traps.

**Trap A — a loss has no official score.** Plotting a loss as `0` makes a collapse at 18 VP look
like a wipe and the chart lies.

- **Primary series = official win VP.** One point per **win**, value = `points` (equivalently
  `defeatedVp` on that win). Losses are absent from this series.
- **Optional secondary series = progress VP.** One point per **game** (win or loss), value =
  `defeatedVp`. This is opt-in via a chart toggle ("include losses as progress VP") so a loss shows
  how far it got without being mistaken for an official score.
- "Highest score" and "average score" default to the **official** series (wins). If we ever surface
  an average that includes losses, it must be labeled *progress VP*, never *score*.

**Trap B — Draw is a win.** Ending resistance undefeated with low VP is
`outcome: 'win', tier: 'Draw'` (the engine also maps 0 VP → Draw). Therefore:

- **Win rate = share of games that ended undefeated** (`outcome === 'win'`, Draw included), not
  "share that hit a victory tier."
- Tier quality is a **separate** breakdown (Draw / Minor Victory / Victory / Major Victory / Epic
  Victory). Never fold Draw into "loss" and never fold it into "victory."
- **Epic Victory is a completion trophy, not a VP record** (all 10 missions defeated). Keep "best
  tier" and "highest VP" as distinct records — an Epic can bank fewer VP than a Major.

`durationMs` note: only meaningful if a start timestamp is captured at New Game. If we don't add
that clock, omit the field rather than back-filling a fake duration.

---

## LOCKED 3 — one local name now, Steam later

Identity while prototyping is **one editable local display name** on this install. No accounts, no
server, no per-player leaderboards. `Profile.displayName` is the only identity field.

The record shape is deliberately Steam-cloud-friendly (plain JSON, no local file handles, dataIds
not uids) so the transition is a swap, not a rewrite:

- **Persona** ← Steam player name replaces `displayName` (the `games[]` array is unchanged).
- **Cloud** ← the same `games[]` array syncs via Steam Cloud (still one JSON document).
- **Achievements** ← derived from records (first Epic, first Major, a zero-civilian win, mission
  bingo complete, beat seed X, …).
- **Leaderboards** ← highest official `points`; other boards deferred.

Do **not** design around Steamworks APIs now. No Steam SDK calls, no file-based cloud, no
achievement plumbing until packaging is real. The only forward-compatibility requirement is: keep
writing the LOCKED 1 record and keep identity as a single swappable name.

---

## First build slice (when we're ready — not this task)

Smallest slice that delivers the user's three asks and nothing that would fight the locks above:

1. `defy.profile.v1` store with `displayName` (editable) + append-on-`GAME_OVER` of a `GameRecord`.
2. A pure `stats` module deriving aggregates/series from `games[]` (no counters).
3. Profile surface next to Settings (a **Profile** tab or a Game-tab button in
   [`src/ui/SettingsMenu.tsx`](../src/ui/SettingsMenu.tsx)): name, games played, undefeated rate,
   best tier, best VP; a score-over-time line chart honoring LOCKED 2; a game-history list.
4. One line of career context on the existing win/loss overlay ("Personal best 22 VP · this game
   19" + a "new personal best" callout).
5. "Clear stats" (playtest reset) and JSON export/import so a wipe isn't fatal.

Everything else in the plan's idea list (tier histogram, loss pie, greed index, mission bingo,
favorite Maquis, martyrs, streaks, near-misses, records screen) is a derivation over the same
`GameRecord[]` and needs no new persistence, except the few fields flagged optional in LOCKED 1.
