# Resist! PC Port — Working Handoff

Bootstrap file for continuing this project in a fresh chat. Read this first, then `docs/ENGINE_DESIGN.md` and `data/README.md`. This supersedes the original research handoff (`RESIST_PC_PORT_HANDOFF.md`, kept for its full rules writeup).

**Repo state (v0.1.2).** `main` is synced with GitHub (`git status` clean; run `git log --oneline` for the latest hash). **v0.1.2 UX pass:** animated end-of-game modals (a defeat modal + tiered victory modals whose spectacle escalates Draw→Epic), right-click card zoom (read-only enlarge of any face-up Maquis/Mission/Enemy), a sticky top nav bar, and the card-pile counts moved into a labeled mini-deck rail down the right side. A `?preview=<loss|draw|minor|victory|major|epic>` dev harness previews the end-game overlays. Also fixed a phantom reinforcement animation on New game (card uids are only unique within a game, so `useReinforcements` now resets on a per-game `gameId`). **Card-flight animations** (`useCardFlights` in `ui/useGame.ts` + `FlyingCard` in `App.tsx`): a card token flies between the hand and the pile rail whenever a card is discarded or drawn, so discard-then-draw effects (Antonio's spy swap) read visually; it diffs consecutive states, measures live DOM rects (`data-flight-hand` on the hand, `data-pile-key` on pile tiles), and skips new-game/undo via a `step` counter. **Face-down Enemy board-picking:** effects that discard "an Enemy from another Mission" (Railroad Bridge) are now clicked on the Enemy's Mission with its identity still concealed — `boardPickable` (`ui/format.ts`) now returns true for face-down Enemies (previously the decision panel leaked every candidate's name + Defense), and `EnemyChip`'s face-down branch renders a pick button. Also **log-clarity** work in `effects/plan.ts`: `spyDiscardDraw` records exactly what was discarded/drawn, and a shared `drawHiddenAndLog` helper (used by the PLAN `drawN` and the ATTACK `drawFromHiddenAttack`) names the acting Maquis and flags a short draw when the Hidden deck + discard are exhausted (`drawHidden` now returns the count actually drawn) — so a "draw 2" that yields 1 is explained. **Phase 2 (engine) is complete and rulebook-verified. Phase 3 (UI) has a playable, substantially-polished prototype with a themed visual layer. Phase 4 has begun: a Windows portable `.exe` ships for playtesting (§10).** All verified green: **146/146 tests, `tsc --noEmit` + `npm run build` clean.** The known enemy-Defense-reset-on-reshuffle bug is fixed. **A playtest surfaced two ATTACK actions that had shipped unregistered (Sagrario·revealed draw-2, Ramona·revealed recruit-draw) and silently hit the `[stub]` path — both are now implemented, and a new `effects/coverage.test.ts` asserts every Maquis action has a handler so this class of gap can't recur.** Recent playtest-driven UX also shipped: a **reinforcement animation** + live **Garrison `+N`** (when Enemies exceed the printed garrison), and a **Recover-draw note** (on the hand tile and the Continue button) when a defeated Mission changes next round's hand size. The decision-UX polish pass, a themed wooden **tabletop** background, and a **real card-art rendering seam** are in (art renders per-card when its image exists, else a themed frame). Remaining before "done": drop in the real card art (reshoot + slice — see §8 + `tools/card-art.md`), minor remaining polish, and the optional draft-variant setup.

Run the app: `npm install` then `npm run dev`.

---

## 1. What this is

A single-player digital port of the physical solitaire card game **Resist!** (Salt & Pepper Games, 2022) — Spanish Maquis vs. Franco, deck-destruction, ~30 min, no AI opponent. Built as a **web app** so it runs in a browser now and can wrap in Tauri for a desktop build later with no rewrite.

## 2. Repo & environment

- **Local folder**: `C:\Users\stephen.levy\GHRepos\DEFY!` (developed locally in Cursor on Windows/PowerShell).
- **GitHub**: `https://github.com/stlevy53/defy`, branch `main`.

### Workflow notes
- **Develop locally, commit directly.** Work happens in the local repo; the agent runs `npx tsc --noEmit`, `npx vitest run`, and `npx vite build` in place, then commits and pushes. (The old sandbox/no-git caveat from earlier sessions no longer applies.)
- **PowerShell gotchas.** `&&` isn't a statement separator — chain with `;`. Multi-line commit messages via heredoc don't work; write the message to a temp file and `git commit -F <file>`. Git will warn `LF will be replaced by CRLF` on commit — harmless.
- **Card data transcription** (complete): `Card Assets/*.jpg` are phone photos of the physical cards, laid out on a blanket; the game data in `/data` was transcribed from them.
- **Real card art** (pipeline built; art not yet added): the UI renders a real per-card image when one exists, else a themed frame — see the "Card art" note in §8 and `tools/card-art.md`. This is a **personal, non-commercial port the owner intends to show the game's creators, using their own artwork.** The original blanket photos don't auto-slice reliably (busy background, angled/close cards), so the plan is to **reshoot the cards flat on a plain background** and run `tools/slice_cards.py`.

## 3. Tech stack (decided)

TypeScript + **React 18** + **Vite 5** + **Vitest**, **Immer** for immutable state updates. Cards render from `/data` as **themed frames**, upgrading to **real card-art images** per card when present (`src/ui/cardArt.ts` + `src/assets/cards/**`, bundled via `import.meta.glob`). Rules engine is plain TypeScript, no React. Tauri for desktop packaging is a Phase 4 option.

Commands: `npm install`, `npm run dev`, `npm test`, `npm run build` (= `tsc --noEmit && vite build`).

## 4. Status & roadmap

- ✅ **Phase 1 — card data** → `/data` (see §5). Validated against rulebook.
- ✅ **Phase 0 — scaffold** → Vite+React+TS, data loader, placeholder UI, test suite.
- ✅ **Phase 2 — rules engine (COMPLETE, rulebook-verified):**
  - ✅ Slice 1 — state model, seeded RNG, `createGame` setup.
  - ✅ Slice 2 — PLAN core: action/decision system, play-Maquis, choose-mission.
  - ✅ Slice 3 — PLAN card-action effects (all 23 PLAN-usable Maquis actions).
  - ✅ ATTACK slice: entry + mandatory play-out · attack resolution · all Maquis/enemy/mission effects (**every effect implemented, including Emilio's copy**; Sagrario·r + Ramona·r were fixed post-playtest — see §7) · Guard/Grunt + Train-Depot constraints.
  - ✅ **AFTERMATH + RECOVER** — civilian-loss + mission outcome (success refill / failure) + `EndResistance` scoring + `Continue` → RECOVER cleanup/draw/reset. **A full round loops**, all three loss conditions + win tiers work, Era-2/3 missions enter via refill.
  - ✅ **M2 acceptance gate** — `worked_example.test.ts` replays the rulebook's illustrated first turn (pp. 11–13) end-to-end.
  - ✅ **Enemy Defense reset on reshuffle** — fixed: `EnemyInstance.baseDefense` stores the printed value; `refillEnemyDeckIfEmpty` restores it when an enemy reshuffles back into the deck (regression test in `aftermath.test.ts`).
  - ⬜ Only leftover: the **optional draft-variant setup** (`createGame` has no `draft` option). The ruleset itself is complete and correct.
- 🔨 **Phase 3 — playable prototype UI (in progress; substantially polished + themed).** `src/ui/` + `src/App.tsx`: renders the board, drives play through `legalActions`, answers `pendingDecision`, shows win/loss, with undo + new-game. `src/ui/playthrough.test.ts` plays full games to an ending across 40 seeds. Shipped so far:
  - **Single `Card` rendering seam** (`ui/Card.tsx`) — every card face draws here. It now renders **real card art (`<img>`) when the image exists, with the themed frame as a per-card fallback**, so art lands one card at a time with no code change.
  - **Themed visuals** — a fixed wooden **tabletop** background (`public/tabletop.jpg`) with frosted-glass surfaces; cards lift off the table with shadow. Un-arted cards use a themed frame (ochre title banner, red/purple Hidden/Revealed duotone portrait, sunburst attack badge).
  - **Round-phase breadcrumb + new-player guidance** (`PhaseGuide`): PLAN→ATTACK→AFTERMATH→RECOVER lit, a "what to do now" line, and sub-step steps from `legalActions`. **All player choices — decisions AND the "Turn" controls (End / Continue) — live in the right half of this tile**, so nothing pushes the page taller.
  - **Direct card interaction ("click the thing")** — play a Maquis by clicking its Hidden/Revealed side; use a played card's action by clicking it; choose/strike a Mission or Enemy by clicking it; answer single-target decisions by clicking the candidate on the board.
  - **Decision-UX polish (done)** — trivial decisions auto-resolve (`settle` in `ui/useGame.ts`: single-candidate `selectTarget`, forced `selectCards`, ≤1-card `orderCards`, single `chooseOption`); `DecisionPanel` has live count/select-all/clear for `selectCards`, click-to-unplace `orderCards`, and rich card tooltips.
  - **Feedback aids** — animated **"Defeated · +N VP" stamp** on a struck Mission; **Attack-Strength pill** that pulses `+N` when it rises (e.g. Consuelo); live **"⚔ +N now"** badge on count-based ATTACK actions (Abel/Soledad/Marcelino); CSS hover tooltips (`ui/Tip.tsx`, `describeUidTip`, `keywordTip`) on cards/icons/keywords.
  - **Reinforcement feedback (playtest-driven)** — when an Enemy is added to a Mission mid-round (Radio Operator's SURVIVE, Barracks, or a moved Enemy), the new chip drops in with a glow, the tile pulses a red ring, and a **"+N REINFORCED"** badge rises (`useReinforcements` in `ui/useGame.ts` diffs consecutive states; CSS in `index.css`). The **Garrison stat also shows a persistent `+N`** (`slot.enemies.length − printed garrison`) so the number always matches the chips.
  - **Recover-draw note (playtest-driven)** — when a defeated Mission changes next round's hand size (Cross the Border −1 / Attack Francoists in the Valley +1), a note shows on the **"Your hand"** tile (`HandDrawNote` in `App.tsx`) **and** on the **Continue button** label (`actionLabel` in `ui/format.ts`), driven by the live `recoverDrawModifier`.
  - **Next:** add the real card art (reshoot + slice), then minor polish (see §8).
- 🔨 Phase 4 — polish + desktop packaging. **A Windows portable `.exe` build is now wired up (Electron + electron-builder) for playtesting** — see §10. Tauri (smaller build) remains a later option.

## 5. Card data (`/data`, all validated — see `data/README.md`)

`maquis.json` (24, hidden+revealed sides), `missions.json` (20: Era1×8, Era2×6, Era3×6), `enemies.json` (32 across 8 types, per-copy defense values), `civilians.json` (8), `spies.json` (6), `rules.json` (setup constants, loss conditions, win table).

Locked facts: mission icons — card-stack = **Garrison**, numbered shield = **Defense**, laurel = **Victory Points**. Enemy count **32** (11+11+10). Win table: **Epic** = defeat all 10 missions; **22+** Major; **19–21** Victory; **15–18** Minor; **1–14** Draw. Engineers are Defense 2 and 3.

## 6. Engine design & approved decisions

Full spec: `docs/ENGINE_DESIGN.md`. Core architecture:
- **Pure, deterministic, headless.** Engine = pure functions over a plain-JSON `GameState`. Seeded RNG lives *in* the state (reproducible games, deterministic tests, easy undo/save later).
- **Interaction model (the crux).** Effects needing player input push onto an internal `effectQueue` and **suspend by setting `pendingDecision`**; the caller responds via `resolveDecision`. The engine never calls back into the UI.
- **Data-driven effects.** Behavior lives in a registry keyed by card id/type: `maquis:{id}:{side}`, `mission:{id}`, `enemy:{typeId}`.
- **Phase state machine**: `PLAN → ATTACK → AFTERMATH → RECOVER → (loop)`; `legalActions(state)` is derived so the UI holds no rules.
- **Acceptance gate (M2):** the rulebook's worked first turn (PDF pp. ~11–13) is encoded as a scripted Action/Decision sequence in `worked_example.test.ts` and the engine reproduces it — *done*. A **card-conservation invariant** is also asserted after every action in tests.

**Approved decisions:** (1) **Immer** for handler updates — *done*. (2) **Implement all** 24 Maquis + 20 mission + 8 enemy effects (no permanent stubs) — *done; Sagrario·r and Ramona·r were found unregistered in playtest and fixed, now guarded by `effects/coverage.test.ts`*. (3) **State-history undo stack** — *done (`ui/useGame.ts`)*. (4) **Cover the rulebook FAQ edge cases** (reshuffle-on-empty; "discard" ≠ "defeat"; mid-round-drawn cards must be played that round) — *done*. (5) **Expose the RNG seed** in `createGame` — *done*. Decisions 2 and 4 are the ones affecting gameplay fidelity.

## 7. Engine built so far (`src/engine/`)

**State & core**
- `types.ts` — `GameState` + `CardInstance`, `EnemyInstance`, `MissionSlot`, `MaquisInPlay`, `Action`, `Decision`, `EffectTask`. Notable `GameState` fields: `attackStrength` (banked base attack + ATTACK-action bonuses, spent by `SpendAttackOn`), `missionDefenseOverride` (Ricardo's halving), `attackRevealLimit` + `revealedInAttack` (Train Depot's ATTACK reveal cap), `ignoreMissionEffect` (Pilar·revealed), `removedFromGame`, `recoverDrawModifier` (Border/Valley), `spiesAvailable`, `chosenMissionUid`, `pendingDecision`, `effectQueue`, `log`. **Per-round scratch reset at ChooseMission:** `missionDefenseOverride`, `attackRevealLimit`, `revealedInAttack`. **Still owed to RECOVER (not built):** reset `attackStrength`, `ignoreMissionEffect`, `recoverDrawModifier`. `MissionSlot` has `faceDown` + `defeated`; `MaquisInPlay` has `side` + `actionUsed`.
- `rng.ts` — `rngNext(state)` (mulberry32) and `shuffle(arr, state)` → `{result, state}`; RNG state is a serializable integer.
- `setup.ts` — `createGame({ seed })`: 24 Maquis split 12/12; 3 Spies shuffled into the Hidden deck (3 aside → `spiesAvailable`); missions culled 4/3/3 (4 Era-1 available + a 6-card Era-2-over-Era-3 deck); 32 Enemies dealt by Garrison; Civilians shuffled; hand of 5.
- `zones.ts` — `countCards` + `assertConservation` (24 Maquis / 6 Spies / 32 Enemies / 8 Civilians / 10 Missions + uid uniqueness, counting the `removedFromGame` zone). Asserted after every action in tests.
- `actions.ts` — `applyAction` (all 7 actions: PlayMaquis / UseAction / ChooseMission / SpendAttackOn / AdvancePhase / **EndResistance / Continue**; Immer-based; throws on illegal). `legalActions` (PLAN + ATTACK as before; **AFTERMATH offers End + Continue**, End forced when no face-up missions remain). `resolveDecision`; the **effect-queue driver**; `settleAutomaticPhases` (runs the AFTERMATH auto-steps once the queue drains). AFTERMATH/RECOVER: `resolveAftermath` (civilian-loss check + mission SUCCESS→`defeatedMissions`+refill / FAILURE→faceDown+`failedMissions`, 2nd = loss), `applyEndResistance` (VP sum → `scoreTier` → win), `applyContinue` (RECOVER cleanup → draw 5 with `recoverDrawModifier` → reset scratch → PLAN/round+1, all-Spy hand = loss). Helpers `playoutComplete` / `chosenSlot` / `effectiveDefense` / `isTargetLegal` / `civilianTotal` / `refillEnemyDeckIfEmpty`.

**Effects** (`src/engine/effects/`) — registration is **explicit, not on import**, so the driver's `[stub]` path stays testable; the app bootstrap calls `registerPlanEffects()` + `registerAttackEffects()` + `registerEnemyEffects()` + `registerMissionEffects()`.
- `registry.ts` — `EffectHandler` shape + `registerEffect`/`unregisterEffect` + id helpers `maquisEffectId`/`missionEffectId`/`enemyEffectId`. The `[stub]` path (unregistered → logged + skipped) still exists as a safety net; **all Maquis actions are now registered** (guarded by `effects/coverage.test.ts` after Sagrario·r/Ramona·r were found missing in playtest).
- `plan.ts` — all 23 PLAN-usable Maquis actions (draw, look-top-3-discard-reorder on Hidden & Enemy decks, spy discard/remove, discard-Maquis-draw-2, Revealed-pile pick, scout, Recruit manipulation, **Pilar·revealed** → sets `ignoreMissionEffect`, **Emilio·hidden** → copies another hidden Maquis's action by delegating to its registered handler with `responses.slice(1)`). Exports `PLAN_EFFECTS`, `registerPlanEffects()`, `PLAN_PRECONDITIONS`, and the shared `drawHidden`/`firesInPhase`.
- `attack.ts` — ATTACK-side Maquis effects (chunks 1–2): attack/defense modifiers (Soledad·h, Abel·h/·r, Marcelino·r, Benigno·r, Ricardo·r), enemy discard/move/sweep (Anastasio, Emilio·r, Adolfo·h, Paquita·r, Consuelo·r, Adela·h/·r, Soledad·r), ATTACK draws (Nicolás·h, Ricardo·h, **Sagrario·r → draw 2 from Hidden**, **Ramona·r → draw 1 from the Recruit deck to hand**, the last gated on a non-empty Recruit deck). Exports `ATTACK_EFFECTS`, `registerAttackEffects()`, `ATTACK_PRECONDITIONS`.
- `enemies.ts` — all 8 enemy types keyed by `enemy:{typeId}`, self-filtered on `ctx.args.trigger`: SURVIVE (Counter-Guerrilla, Military, Spy Master, Radio Operator), DEFEAT (Jailor), DEFEND (Engineer). Guard/Grunt are no-ops here — enforced structurally by `isTargetLegal` in `actions.ts`. Exports `ENEMY_EFFECTS`, `registerEnemyEffects()`.
- `missions.ts` — all 20 mission effects keyed by `mission:{id}`, each wrapped with its keyword (DEFEND fires at ChooseMission, DEFEAT on defeat — no mission has SURVIVE) and skipped when `ignoreMissionEffect` is set. Includes ongoing DEFEND constraints via state (Train Depot → `attackRevealLimit`; Bunker/Crossroads discard at choose; Mayor's House / Engineer-style +Defense). Exports `MISSION_EFFECTS`, `registerMissionEffects()`. **Reachability note:** only Era-1 missions are in the starting row; Era-2/3 effects can't fire via `ChooseMission` until AFTERMATH mission-refill exists, so 12 of them are currently covered by direct handler-unit tests.
- `preconditions.ts` — `canFireEffect` (unions `PLAN_PRECONDITIONS` + `ATTACK_PRECONDITIONS`); consulted by `legalActions` so an action is only offered when it can be performed in full.
- `index.ts` — public API surface (createGame, applyAction/legalActions/resolveDecision, zones, all registries + `canFireEffect`, types).

**Key handler contracts (a new session MUST follow these):**
1. **Stage-style, idempotent.** A handler is re-invoked from the top on every resume, reads prior answers from `ctx.responses` (one entry per resolved decision), and uses `responses.length` as its stage counter. It **mutates state only in the terminal invocation** — pre-terminal stages only *return* a `Decision`. State is unchanged across a suspension, so re-runs are safe.
2. **Trigger dispatch.** Mission/enemy effects receive `ctx.args.trigger` = `'DEFEND'` | `'DEFEAT'` | `'SURVIVE'`. The framework queues DEFEND at `ChooseMission`, DEFEAT on `SpendAttackOn` defeat, SURVIVE at `AdvancePhase` — for *every* mission/enemy, so each handler must act only on its own keyword's trigger (enemies use the `onTrigger` wrapper).
3. **Defense ordering is implicit.** `effectiveDefense` just reads current values. DEFEND effects (e.g. Engineer +1) resolve at ATTACK start and ATTACK-action effects (e.g. Benigno −1) later, so the FAQ ordering (Engineer before Benigno) falls out of execution order — don't add explicit ordering logic.
4. **SURVIVE-before-discard caveat.** `applyAdvancePhase` queues each undefeated enemy's SURVIVE task **and** moves it to `enemyDiscard` in the same tick, so a SURVIVE handler sees the enemy already in `enemyDiscard` (found via `sourceUid`). None of the current SURVIVE effects need the enemy in place; if a future one does, reorder so the queue drains before the discard.

**UI** (`src/ui/`, `src/App.tsx`) — thin React view, no rules:
- `ui/bootstrap.ts` — `ensureEffectsRegistered()` (registers all four effect sets once).
- `ui/useGame.ts` — hook holding a state-history stack: `state`, `actions` (= `legalActions`), `dispatch` (applyAction), `respond` (resolveDecision), `undo`, `newGame`, `error`, plus `gameId` (bumps on New game) and `step` (= history depth; up on a move, down on undo). **`settle`** auto-resolves trivial decisions after every state change (single-candidate `selectTarget`, forced `selectCards`, ≤1-card `orderCards`, single `chooseOption`) so the UI never shows a pointless prompt. Also exports two diff-based animation hooks: **`useReinforcements`** (enemies newly added to a Mission → reinforcement badge) and **`useCardFlights`** (cards moving in/out of the hand → flying-card tokens between the hand and the pile rail; guards on `gameId`/`step` so new-game and undo don't animate).
- `ui/format.ts` — id→label helpers (`nameOfMaquis`, `describeUid`, `actionLabel`, `maquisSideAction`, `keywordTip`, …), the guidance selector `guidanceFor(state, actions)` + `ROUND_PHASES`, plus `boardPickable` (is a UID a clickable board card? — **now true for face-down Enemies too, so a "discard an Enemy from another Mission" pick happens on the board with the Enemy's identity still hidden, rather than the panel leaking its name/Defense**), `describeUidTip` (multi-line card tooltip), and `countActionBonus` (live value of count-based ATTACK actions).
- `ui/cardArt.ts` — **card-art manifest.** Maps a card id → bundled image URL via `import.meta.glob` over `src/assets/cards/<category>/<id>.(jpg|png|webp)`: `maquisArt`, `enemyArt`, `enemyBackArt`, `missionArt`, `civilianArt`, `spyArt`. Empty today (no art committed); drop a file in and it's picked up automatically.
- `ui/Card.tsx` — **the single card-rendering seam.** `Card(face: CardFace)` over `maquisHand` / `maquisPlayed` / `mission` (+ internal `EnemyChip`). Each face **renders the real card image when `cardArt` has one, with the themed frame as a per-card fallback.** Art faces overlay the interactive controls (hand: play-side hotspots; played: dim the off-side + Use ribbon + live bonus; mission: image + Enemies row + Defeated stamp + modified-Defense pill; enemy: portrait token + Defense pill + face-down back). Themed frame = ochre banner + duotone portrait + sunburst attack. `EnemyChip`'s face-down branch renders a **pickable button** (identity concealed, no zoom) when the Enemy is a current decision candidate, so hidden garrisons can be targeted on the board without revealing them.
- `ui/Tip.tsx` — `Tip` CSS-only hover tooltip (no JS state); `below` variant opens downward for header pills.
- `ui/DecisionPanel.tsx` — renders all four `pendingDecision` kinds; single-target picks offload to clicking the board, `selectCards` has a live count + select-all/clear, `orderCards` items are click-to-unplace, chips carry `describeUidTip` tooltips.
- `App.tsx` — board (phase guide, mission row + enemies, hidden/revealed play areas, hand, pile counts), themed **tabletop** background, result banner, log, undo/new-game, the end-game overlays (`WinOverlay`/`LossOverlay`), and the **`FlyingCard`** flight overlay (renders the tokens from `useCardFlights`). **All player choices — the `DecisionPanel` and the "Turn" controls (AdvancePhase / EndResistance / Continue) — render in the right half of the `PhaseGuide` tile**; everything else is clicked on the cards. Styling in `index.css`.

**Tests (147/147 pass; `tsc --noEmit` + `npm run build` clean).** `setup.test.ts` (9) · `plan.test.ts` (8, includes the `[stub]`-path test) · `effects/plan.test.ts` (17 — includes the Juana look-top-3 reshuffle regression) · `effects/coverage.test.ts` (42 — asserts every Maquis action is registered; guards against the Sagrario/Ramona stub class) · `attack.test.ts` (5) · `attack_resolution.test.ts` (7) · `effects/attack.test.ts` (5) · `effects/attack_actions.test.ts` (10 — includes Sagrario·r draw-2, the Sagrario short-draw log, and Ramona·r recruit-draw regressions) · `effects/enemies.test.ts` (8) · `effects/missions.test.ts` (20) · `effects/emilio.test.ts` (3) · `aftermath.test.ts` (7 — includes the enemy-Defense-reset regression) · `worked_example.test.ts` (1 — the M2 gate) · `ui/playthrough.test.ts` (1 — full games to an ending, 40 seeds, via the UI path) · `data/data.test.ts` (4). Conservation asserted wherever cards move.

## 8. Immediate next task — real card art, then remaining polish

**Playtesting is now active** (v0.1.1 portable `.exe`, §10). The last session was driven by playtester feedback: fixed the Sagrario/Ramona stub bug (+ coverage test), added the reinforcement animation, the live Garrison `+N`, and the Recover-draw notes. **Next session: fold in any new playtester feedback first, then continue below.** The clarity, direct-interaction, and decision-UX passes are done (see §4), and the visual theme + real-art rendering seam are in. Suggested order:

1. **Add the real card art (the big one).** The rendering seam is ready; only the images are missing.
   - **Reshoot** the physical cards flat on a plain, contrasting background with gaps (originals are angled on a fur blanket and don't auto-slice). Full shooting guide + tuning tips + the exact id→filename checklist are in **`tools/card-art.md`**.
   - **Slice**: `python tools/slice_cards.py <photo> <landscape|portrait> <out_dir>` (uses OpenCV; already installed). It deskews + crops each card and writes a `_debug.jpg` to eyeball detection.
   - **Place**: rename crops to their card id and drop into `src/assets/cards/{maquis,enemy,mission,civilian,spy}/`. `npm run build` to confirm they bundle; they appear in-game per card automatically (themed frame remains the fallback for any not yet done).
   - Naming: maquis/mission/civilian by data id; enemy by **type** id (8 types; per-copy Defense is overlaid by the app); optional `enemy/back` for the face-down back; `spy/spy`.
2. **Playtest + minor polish.** Run a few full games; fix any sharp edges. Optional niceties: surface `state.log` as transient toasts; a compact "what happened" summary after AFTERMATH; a seed-entry box for reproducible games. If you'd rather not keep the themed frames long-term, an "art coming soon" placeholder could replace them.
3. **Audio / sound effects (none yet — future work).** The game currently ships with **no audio layer at all**. Add music + SFX in a future pass. Natural first hooks: **win/loss stingers on the end-game modals** (`WinOverlay` / `LossOverlay` in `App.tsx`) — ideally escalating with the win tier to match the visual spectacle — plus **card-play / attack-strike / reinforcement / button-click** cues. Suggested approach: a tiny headless audio module (e.g. a `playSfx(name)` helper) triggered from the UI layer only (keep the engine pure/silent); bundle small audio files under `src/assets/audio/**` via `import.meta.glob` like the card-art seam. Gotchas: browsers/Electron **block autoplay until a user gesture**, so prime/unlock audio on the first click; include a **mute/volume toggle** (persist in `localStorage`) and honor it everywhere; keep files small for the portable `.exe`. All sound is **personal, non-commercial** use for this port, same as the card art.

**One engine leftover (optional; independent of the UI):**
- **Draft-variant setup** (`createGame` has no `draft` option). Interactive, so it needs the decision system; a self-contained slice.

**Design note — count-based ATTACK bonuses snapshot at use-time.** Soledad/Abel/Marcelino add "+1 per revealed/other Maquis" *when their action fires*, not at a final tally. The rulebook totals Attack Strength at the spend step, so to match it the player must fire these actions after the relevant Maquis are in play (the M2 gate fires Abel's last for this reason). The UI could nudge the player to fire count-actions last, or a stricter engine model would defer count bonuses to the spend step.

**Later — Phase 4:** polish + optional Tauri desktop packaging.

### Reference: round structure (rulebook)
- **PLAN**: play Maquis (hidden/revealed) + optional PLAN actions; choose one Mission; reveal its enemies.
- **ATTACK**: DEFEND effects; play all remaining Maquis (mandatory), firing ATTACK actions; sum Attack Strength, spend target-by-target (cost = target Defense); DEFEAT on defeat; undefeated enemies resolve SURVIVE then discard.
- **AFTERMATH**: civilian loss if Graveyard ≥ 5; mission SUCCESS (refill) / FAILURE (flip + count; 2nd = loss); End Resistance or Continue.
- **RECOVER**: cleanup; draw 5 (draw modifiers; reshuffle if needed); all-Spy hand = loss.
- **Loss**: fail 2 missions, 5+ civilians dead, or all-Spy hand. **Win/score**: end the resistance undefeated → sum VP → tier table.

### Rules-fidelity traps (verified; full list in `RESIST_PC_PORT_PLAN.md` §5)
- **Engineer +1 before Benigno −1** — handled implicitly by trigger order (see contract 3).
- DEFEND effects: **one-shot** (Bunker) vs **round-long constraints** (Train Depot → `attackRevealLimit`; Guard/Grunt → `isTargetLegal`). All done.
- Win table starts at 1 VP; **0 VP is unmapped** — engine maps it to **Draw** (`scoreTier`); consider recording that in `rules.json`.
- "Add a new Spy" effects **no-op when `spiesAvailable` is 0** (done); `recoverDrawModifier` (Valley/Border) applies to that round's Recover then resets (done in `applyContinue`).
- Spies are never playable; excluded from the mandatory play-out.
- **Draft-variant setup** designed but not implemented (`createGame` has no `draft` option) — a later Phase 2 slice.

## 9. Working style notes

The user is not a developer but is technically fluent and learning — explain choices in plain terms, no unexplained jargon. Prefers tight, concrete output; iterate in reviewable slices; confirm before starting a new slice. All commits/pushes happen on the user's side. Keep rules fidelity high (decisions 2 & 4).

## 10. Desktop packaging — Windows portable `.exe` (for playtesting)

The app is wrapped with **Electron** so it can be sent to playtesters as a single double-click `.exe` — no install, no dev tools on their end. Chosen over Tauri for now because it needs no extra toolchain (no Rust/C++ build tools); the trade-off is a larger file (~86 MB). A smaller Tauri build stays a later option.

**Build it:**
```
npm run package
```
This runs `npm run build` then `electron-builder`, producing **`DEFY-Playtest-<version>.exe`** (a portable executable — the tester just runs it; it self-extracts to temp and launches).

**Key facts / gotchas:**
- **Output lands outside the repo:** `directories.output` is `../defy_release` → `C:\Users\stephen.levy\GHRepos\defy_release`. This is deliberate — electron-builder's file operations **fail with `EPERM` when the output path contains the `!`** in the `DEFY!` folder name. Don't move the output back inside the repo.
- Files/config live in `package.json` (`main`, `build` field) + `electron/main.cjs` (main process: loads `dist/index.html`, opens external links in the real browser, hides the menu bar). `main` = `electron/main.cjs` (CommonJS, because `package.json` is `"type": "module"`).
- **`vite.config.ts` sets `base: './'`** so built assets load over `file://` inside Electron. Do not remove this or the packaged app renders blank.
- The packaged build uses the **default Electron icon** (no custom icon yet) and the current **themed card frames** (real card art not added yet) — both fine for playtest. Add `build.win.icon` (a `.ico`) later for a branded icon.
- Distribute the `.exe` via Drive/Dropbox/etc. It's unsigned, so Windows SmartScreen may show a "more info → run anyway" prompt to testers — normal for unsigned apps.
- `npm run electron:dev` runs the current `dist/` in Electron without packaging (build first).
