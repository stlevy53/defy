# Resist! — PC Port Project Plan

Digital single-player port of the physical solitaire card game *Resist!* (Salt & Pepper Games, 2022). This plan builds on `RESIST_PC_PORT_HANDOFF.md`, which captures the verified rules, asset inventory, and table layout.

---

## 1. Strategy summary

**Platform: web app (TypeScript + React, built with Vite).** For a card game with text-rendered cards, the web platform is both the fastest path to a playable build and the best long-term experience. There is no physics, 3D, or real-time action to justify a game engine. The iteration loop is save-and-refresh, the ecosystem is the most documented and AI-assistable while learning, and distribution is a shared URL today or a wrapped Tauri desktop app (`.exe` / `.app`) later with no rewrite.

**Cards: text-rendered from structured data.** Each card is a styled component drawn from JSON (name, stats, keywords, effect text). Clean, scalable, no image cleanup. The photographed card faces remain available as a later drop-in swap that touches only the presentation layer, not the engine — so this choice costs nothing long-term.

**Build order: three layers, correctness gated.** Data → headless rules engine → UI. The engine is validated against the rulebook's worked example before any UI is built, so the interface is never layered on unproven rules.

---

## 2. Architecture

Three cleanly separated layers so each can be verified on its own:

**Data layer** — JSON files, one per card type (Maquis, Missions, Enemies, Civilians, Spies). The single source of truth for all card names, stats, keywords, and effect text. No logic.

**Rules engine** — pure TypeScript, no UI dependency. Holds all game state and the four-phase round loop, loss/win evaluation, and effect timing (DEFEND / DEFEAT / SURVIVE). Exposes a small API (e.g. `newGame()`, `playMaquis()`, `chooseMission()`, `resolveAttack()`, `endRound()`) and is fully unit-testable headless. This is the correctness backbone.

**UI layer** — React components rendering the tableau from the handoff's Section 3: two side rails (Hidden / Recruit decks + discards), a center strip of Mission + Enemy clusters, and a bottom hand tray. The UI only reads engine state and sends player intents back to it; it contains no game rules of its own.

**Tooling:** TypeScript, React, Vite (dev/build), Vitest (tests). Later: Tauri for desktop packaging.

---

## 3. Phased plan

### Phase 0 — Project scaffold *(half day)*
Stand up the Vite + React + TypeScript project, folder structure for the three layers, and a passing placeholder test so the toolchain is proven end to end.

*Deliverable:* running dev server, empty but wired-up repo.

### Phase 1 — Card data transcription *(the groundwork)*
Transcribe all cards from the 7 sheet photos into structured JSON: 24 Maquis (hidden + revealed sides), 20 Missions (title, era, keyword + effect, Defense / Garrison / Victory-Point values), 32 Enemies (Defense + keyword effect), 8 Civilians, 6 Spies. Resolve the two open data questions from the handoff in this phase:
- The 32-vs-33 enemy count discrepancy (photo shows 33, rulebook says 32).
- Exact win-table thresholds, re-read from the PDF table directly rather than the flattened text extraction.

*Deliverable:* complete, reviewed JSON data set. *Gate:* card counts reconciled against the rulebook component list.

### Phase 2 — Rules engine *(the core)*
Implement setup (including the draft variant), the four phases (Plan, Attack, Aftermath, Recover), Attack-Strength pooling and target-by-target spending, all three loss conditions, and scoring. Model DEFEND / DEFEAT / SURVIVE timing and the individual card effects.

*Deliverable:* headless engine playable via a script/console. *Gate:* an automated test reproduces the rulebook's worked example (pages ~11–13) turn-by-turn. If it matches, the rules are right.

### Phase 3 — Playable prototype UI *(the milestone you hold)*
Build the tableau, text-rendered cards, and interaction for a full game: fan the hand, commit cards hidden/left or revealed/right, pick a mission, run the attack, see outcomes and score. Rough but complete — clickable start to finish.

*Deliverable:* a full game of Resist! playable in the browser.

### Phase 4 — Polish & packaging *(after the prototype earns it)*
Iteration pass: animations/transitions, undo model, save/resume, edge-case handling, and a rules/help overlay. Then wrap in Tauri for a distributable desktop build if desired. Optional: swap text-rendered cards for the photographed faces.

*Deliverable:* shippable build.

---

## 4. Milestones & checkpoints

| Milestone | What proves it's done |
|---|---|
| M0 — Scaffold | Dev server runs, placeholder test passes |
| M1 — Data complete | All cards in JSON, counts reconciled to rulebook |
| M2 — Engine correct | Worked-example test passes headless |
| M3 — Playable prototype | A full game is completable in-browser |
| M4 — Shippable | Polished, packaged desktop/web build |

M2 is the most important gate. Everything visual rests on it.

---

## 5. Risks & open items

- **Card-effect complexity.** Individual Maquis/Enemy/Mission effects (e.g. Jailor releasing Recruits, Antonio/Ramona revealed actions) are where rules engines get fiddly. Mitigation: model effects as small data-driven handlers keyed off the transcribed text, and expand the worked-example test suite as effects are added.
- **Data-count discrepancy** (enemies 32 vs 33) — must be resolved in Phase 1 before the engine assumes a deck size.
- **Win-table exactness** — re-verify against the PDF table image, not extracted text, before coding scoring.
- **Scope creep on polish** — Phase 4 is deliberately fenced off so it can't delay a playable build.

---

## 6. Immediate next step

Begin **Phase 1**: transcribe the card data from the 7 photos into JSON and resolve the two open data questions. This is mechanical, low-risk, and unblocks everything else. Phase 0 scaffold can run in parallel or immediately after.
