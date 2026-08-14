# Resist! — PC Port Project Plan

Digital single-player port of the physical solitaire card game *Resist!* (Salt & Pepper Games, 2022). For current working state and session bootstrap, read `HANDOFF.md` first; this document is the phased roadmap. The original research handoff (`RESIST_PC_PORT_HANDOFF.md`) is kept for its full rules writeup.

---

## 1. Strategy summary

**Platform: web app (TypeScript + React, built with Vite).** For a card game with text-rendered cards, the web platform is both the fastest path to a playable build and the best long-term experience. There is no physics, 3D, or real-time action to justify a game engine. The iteration loop is save-and-refresh, the ecosystem is the most documented and AI-assistable while learning, and distribution is a shared URL today or a wrapped Tauri desktop app (`.exe` / `.app`) later with no rewrite.

**Cards: text-rendered from structured data.** Each card is a styled component drawn from JSON (name, stats, keywords, effect text). Clean, scalable, no image cleanup. The photographed card faces remain available as a later drop-in swap that touches only the presentation layer, not the engine — so this choice costs nothing long-term.

**Build order: three layers, correctness gated.** Data → headless rules engine → UI. The engine is validated against the rulebook's worked example before any UI is built, so the interface is never layered on unproven rules.

---

## 2. Architecture

Three cleanly separated layers so each can be verified on its own:

**Data layer** — JSON files, one per card type (Maquis, Missions, Enemies, Civilians, Spies) plus `rules.json` constants. The single source of truth for all card names, stats, keywords, and effect text. No logic. *(Built — see `/data` and `data/README.md`.)*

**Rules engine** — pure TypeScript, no UI dependency. Holds all game state and the four-phase round loop, loss/win evaluation, and effect timing (DEFEND / DEFEAT / SURVIVE). Public API: `createGame({seed})`, `legalActions(state)`, `applyAction(state, action)`, `resolveDecision(state, response)` — fully unit-testable headless. Full spec: `docs/ENGINE_DESIGN.md`. This is the correctness backbone.

**UI layer** — React components rendering the tableau: two side rails (Hidden / Recruit decks + discards), a center strip of Mission + Enemy clusters, and a bottom hand tray. The UI only reads engine state (`legalActions` tells it what to offer) and sends player intents back; it contains no game rules of its own.

**Tooling:** TypeScript, React 18, Vite 5 (dev/build), Vitest (tests), Immer (add with the effect system). Later: Tauri for desktop packaging.

---

## 3. Phased plan

### Phase 0 — Project scaffold ✅ DONE
Vite + React + TypeScript project, three-layer folder structure, typed data loader, passing test suite.

### Phase 1 — Card data transcription ✅ DONE
All cards transcribed to `/data` and validated: 24 Maquis (hidden + revealed sides), 20 Missions (Era 1×8, 2×6, 3×6), 32 Enemies (8 types, per-copy defense values), 8 Civilians, 6 Spies, plus `rules.json`. Both open data questions resolved:
- Enemy count is **32** (photo rows 11+11+10); the original "33" was a miscount.
- Win table re-read from the PDF: Epic = defeat all 10 missions; 22+ Major; 19–21 Victory; 15–18 Minor; 1–14 Draw.

### Phase 2 — Rules engine ✅ DONE (rulebook-verified)
Built in verified slices, each with tests:

- **Slice 1 — state + RNG + setup ✅.** `GameState` model, seeded mulberry32 RNG, `createGame` (standard setup), with card-conservation checks.
- **Slice 2 — PLAN phase ✅.** `applyAction` / `legalActions` / `resolveDecision` + effect-queue driver; play Maquis hidden/revealed; PLAN and PLAN/ATTACK actions (`pendingDecision` effects); `ChooseMission` + enemy reveal. Immer added here.
- **Slice 3 — ATTACK phase ✅.** DEFEND triggers, mandatory play-out of hand, Attack Strength pooling, target-by-target spending via `SpendAttackOn`, DEFEAT/SURVIVE resolution.
- **Slice 4 — AFTERMATH + RECOVER ✅.** Civilian/mission-failure loss checks, mission refill, end-or-continue, cleanup, redraw, all-Spy loss, scoring. A full round loops.
- **Slice 5 — full effect coverage ✅.** All 24 Maquis actions, 20 mission effects, 8 enemy-type effects (no stubs — every effect real, including Emilio's copy), plus the rulebook FAQ edge cases. The enemy-Defense-reset-on-reshuffle bug is fixed (`baseDefense`).
- **Slice 6 — draft-variant setup ✅.** `createGame({draft: true})` per the rulebook's recommended drafting rule; the UI offers it at the start of a new game (Settings can turn the prompt off).

*Deliverable:* headless engine playable via a script/console — **done.** *Gate (M2):* `worked_example.test.ts` reproduces the rulebook's worked example (pp. 11–13) turn-by-turn — **passing.**

### Phase 3 — Playable prototype UI 🔨 IN PROGRESS (functional, polished, themed)
The tableau is built and a full game is clickable start to finish: play cards hidden/revealed by clicking a card's side, use actions and choose/strike missions and enemies by clicking them on the board, run the attack, see outcomes and score. Polished with a single `Card` rendering seam, a round-phase breadcrumb with new-player guidance, all player choices consolidated into the guidance tile, auto-resolved trivial decisions, feedback aids (defeated stamp, Attack-Strength pulse, live count-bonus badges), and CSS hover tooltips. Themed with a wooden tabletop background and, via the `Card` seam, **real per-card art when present with a themed frame fallback**. Undo + new-game via a state-history stack. `ui/playthrough.test.ts` drives full games to an ending across 40 seeds through the UI path.

*Deliverable:* a full game of Resist! playable in the browser — **achieved.** Remaining: drop in the real card art (reshoot + slice; pipeline in `tools/`), then minor polish.

### Phase 4 — Polish & packaging 🔨 IN PROGRESS
Iteration pass: animations/transitions, undo (state-history stack, approved), save/resume, edge-case handling, and a rules/help overlay.

**Desktop packaging (done for playtesting):** the app is wrapped with **Electron** and `npm run package` produces a **Windows portable `.exe`** (`DEFY-Playtest-<version>.exe`, ~86 MB) testers can double-click — no install, no dev tools. Electron was chosen over Tauri for the first playtest build because it needs no extra toolchain; a smaller **Tauri** build remains an option later. Details + gotchas in `HANDOFF.md` §10.

*Deliverable:* shippable build.

---

## 4. Milestones & checkpoints

| Milestone | What proves it's done | Status |
|---|---|---|
| M0 — Scaffold | Dev server runs, test suite passes | ✅ |
| M1 — Data complete | All cards in JSON, counts reconciled to rulebook | ✅ |
| M2 — Engine correct | Worked-example test passes headless | ✅ |
| M3 — Playable prototype | A full game is completable in-browser | ✅ |
| M4 — Shippable | Polished, packaged desktop/web build | 🔨 (Windows portable `.exe` builds; polish ongoing) |

M2 was the most important gate — everything visual rested on it, and it passes. M3 (a full game is completable in-browser) is met; polish toward M4 continues.

---

## 5. Risks & open items

Rules-fidelity items surfaced during data transcription and design review — each needs an explicit answer in the engine (most are cheap; the point is not to discover them mid-implementation):

- **Modifier ordering is player-visible.** Rulebook FAQ: the Engineer's +1 (DEFEND, start of ATTACK) applies **before** Benigno's −1 (ATTACK action). Order changes results (a 1-defense enemy: Engineer then Benigno → 1; reversed → 2). `effectiveDefense` must apply DEFEND-sourced modifiers before ATTACK-action modifiers.
- **Two effect shapes, not one.** Some DEFEND effects are one-shot triggers (Bunker: discard a Maquis from hand), others are round-long **constraints** (Train Depot: "Maquis cannot be revealed during ATTACK"; Grunts/Guards: defeat-order restrictions). Constraints must be consumed by `legalActions`, not just run once from the effect queue.
- **"When this Mission is chosen, immediately…"** (Bunker, Crossroads) fires at mission choice in PLAN, not at the generic start-of-ATTACK DEFEND step. Functionally equivalent today (nothing happens between the two moments), but the engine must not allow any action between `ChooseMission` and DEFEND resolution.
- **Scoring gap at 0 VP.** The rulebook table starts at 1 point ("1–14 Draw"); ending the resistance with 0 VP is unmapped. Decision needed (proposed: treat as Draw). `rules.json` should record whatever is decided.
- **Spy supply is capped at 6.** "Add a new Spy card" effects (Spy Master, Caves) must no-op when `spiesAvailable` is 0 — the physical game has no more spies to add.
- **Recover-draw modifiers are one-shot.** Valley (+1) / Border (−1) are DEFEAT effects on the mission defeated *this* round; `recoverDrawModifier` applies to that round's Recover draw only and resets after it.
- **Spies never leave the hand mid-round.** They cannot be played; they sit in hand until Recover cleanup moves them to the Hidden discard. `legalActions` must never offer playing a spy, and the mandatory play-all-Maquis rule excludes them.
- **Card-effect complexity generally.** The registry + effect-queue design (see `ENGINE_DESIGN.md` §4) is the mitigation; expand the worked-example suite as effects land.
- **Scope creep on polish** — Phase 4 is deliberately fenced off so it can't delay a playable build.

---

## 6. Immediate next step

**Phase 3 (continue).** The engine is done (including optional draft setup), the UI is playable end-to-end, real card art is in, and the first-run coach + draft offer have shipped. Next: playtest and minor niceties. See `HANDOFF.md` §8.
