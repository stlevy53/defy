# Resist! PC Port — Working Handoff

Bootstrap file for continuing this project in a fresh chat. Read this first, then `docs/ENGINE_DESIGN.md` and `data/README.md`. This supersedes the original research handoff (`RESIST_PC_PORT_HANDOFF.md`, kept for its full rules writeup).

**Repo state.** Last *committed*: `main` @ `2f48f0a` (Phase 2 ATTACK sub-slice 3 chunk 1). **Uncommitted in the working tree** (verify with `git status`): all of Phase 2 since that commit (every card effect, Guard/Grunt/Train-Depot constraints, AFTERMATH + RECOVER round loop, the M2 acceptance gate) **and Phase 3 — a playable React UI** over the engine, plus this handoff. All verified green (**100/100 tests**, `tsc` + `build` clean). **Phase 2 (engine) is complete and rulebook-verified; Phase 3 (UI) has a working first prototype.** Commit, then re-pin this hash:

```
del .git\index.lock            REM only if a stale lock exists
git add -A
git commit -m "Phase 2 complete (all effects + round loop + M2 gate) and Phase 3 playable UI prototype"
git push
```

Run the app: `npm install` then `npm run dev`.

---

## 1. What this is

A single-player digital port of the physical solitaire card game **Resist!** (Salt & Pepper Games, 2022) — Spanish Maquis vs. Franco, deck-destruction, ~30 min, no AI opponent. Built as a **web app** so it runs in a browser now and can wrap in Tauri for a desktop build later with no rewrite.

## 2. Repo & environment

- **Local folder** (connected in Cowork): `C:\Users\stephen.levy\GHRepos\DEFY!`
- **GitHub**: `https://github.com/stlevy53/defy`, branch `main`.
- **Sandbox path** for `mcp__workspace__bash`: `/sessions/<session>/mnt/DEFY!` (differs per session; check the Shell access note).

### Critical workflow quirks (read before touching git)
- **The sandbox cannot complete git commits.** The network mount blocks unlinking `.git/*.lock`, leaving stale `index.lock`/`HEAD.lock` that break later git ops. **Do NOT run git from the agent.** The agent writes & verifies files; **the user runs `git add/commit/push`** from their machine (Claude Code / terminal). If a stale lock exists, delete `.git\index.lock` (and `HEAD.lock`) first.
- **Develop-and-verify pattern.** Build/test in the sandbox, then copy into the repo. The established flow: keep a working copy at `/tmp/scaffold` with deps installed (`npm install` once), then each iteration `cp -r <repo>/src/. /tmp/scaffold/src/` and run `npx tsc --noEmit` + `npx vitest run` + `npx vite build`. This avoids `npm install` against the mount. Because the agent edits the repo directly (Write/Edit) and only *copies into* the scaffold to test, the repo is always the source of truth.
- **Card image transcription** (complete): `Card Assets/*.jpg` are phone photos, some rotated. ImageMagick (`convert -crop … -rotate … -resize`) was used to slice cards. CCW (`-rotate -90`) for the Maquis sheet; `-rotate 180` for the landscape mission/civilian sheets.

## 3. Tech stack (decided)

TypeScript + **React 18** + **Vite 5** + **Vitest**, **Immer** for immutable state updates. Text-rendered cards (render from JSON; photos remain a possible later swap). Rules engine is plain TypeScript, no React. Tauri for desktop packaging is a Phase 4 option.

Commands: `npm install`, `npm run dev`, `npm test`, `npm run build` (= `tsc --noEmit && vite build`).

## 4. Status & roadmap

- ✅ **Phase 1 — card data** → `/data` (see §5). Validated against rulebook.
- ✅ **Phase 0 — scaffold** → Vite+React+TS, data loader, placeholder UI, test suite.
- 🔜 **Phase 2 — rules engine** (in progress):
  - ✅ Slice 1 — state model, seeded RNG, `createGame` setup.
  - ✅ Slice 2 — PLAN core: action/decision system, play-Maquis, choose-mission.
  - ✅ Slice 3 — PLAN card-action effects (all 21 PLAN-usable Maquis actions).
  - ✅ ATTACK slice: entry + mandatory play-out · attack resolution · all Maquis/enemy/mission effects (**every effect real — no stubs**, including Emilio's copy) · Guard/Grunt + Train-Depot constraints.
  - ✅ **AFTERMATH + RECOVER** — civilian-loss + mission outcome (success refill / failure) + `EndResistance` scoring + `Continue` → RECOVER cleanup/draw/reset. **A full round loops**, all three loss conditions + win tiers work, Era-2/3 missions enter via refill.
  - ✅ **M2 acceptance gate** — `worked_example.test.ts` replays the rulebook's illustrated first turn (pp. 11–13) end-to-end.
  - ⬜ **Phase 2 remainder (small, see §8):** a known defense-reset-on-reshuffle bug and the optional draft-variant setup. Otherwise the ruleset is complete and correct.
- 🔜 **Phase 3 — playable prototype UI** (in progress). First working build shipped (`src/ui/` + `src/App.tsx`): renders the board, offers `legalActions` as buttons, answers `pendingDecision`, shows win/loss, with undo + new-game. `src/ui/playthrough.test.ts` plays full games to an ending across 40 seeds. **Next: playtest polish** (see §8).
- ⬜ Phase 4 — polish + desktop packaging.

## 5. Card data (`/data`, all validated — see `data/README.md`)

`maquis.json` (24, hidden+revealed sides), `missions.json` (20: Era1×8, Era2×6, Era3×6), `enemies.json` (32 across 8 types, per-copy defense values), `civilians.json` (8), `spies.json` (6), `rules.json` (setup constants, loss conditions, win table).

Locked facts: mission icons — card-stack = **Garrison**, numbered shield = **Defense**, laurel = **Victory Points**. Enemy count **32** (11+11+10). Win table: **Epic** = defeat all 10 missions; **22+** Major; **19–21** Victory; **15–18** Minor; **1–14** Draw. Engineers are Defense 2 and 3.

## 6. Engine design & approved decisions

Full spec: `docs/ENGINE_DESIGN.md`. Core architecture:
- **Pure, deterministic, headless.** Engine = pure functions over a plain-JSON `GameState`. Seeded RNG lives *in* the state (reproducible games, deterministic tests, easy undo/save later).
- **Interaction model (the crux).** Effects needing player input push onto an internal `effectQueue` and **suspend by setting `pendingDecision`**; the caller responds via `resolveDecision`. The engine never calls back into the UI.
- **Data-driven effects.** Behavior lives in a registry keyed by card id/type: `maquis:{id}:{side}`, `mission:{id}`, `enemy:{typeId}`.
- **Phase state machine**: `PLAN → ATTACK → AFTERMATH → RECOVER → (loop)`; `legalActions(state)` is derived so the UI holds no rules.
- **Acceptance gate (M2, not yet built):** encode the rulebook's worked first turn (PDF pp. ~11–13) as a scripted Action/Decision sequence and assert the engine reproduces it. A **card-conservation invariant** is already asserted after every action in tests.

**Approved decisions:** (1) **Immer** for handler updates — *done, in package.json*. (2) **Implement all** 24 Maquis + 20 mission + 8 enemy effects (no permanent stubs) — *Maquis + enemy done; missions are chunk 3b*. (3) **State-history undo stack** — *not built yet*. (4) **Cover the rulebook FAQ edge cases** (reshuffle-on-empty; "discard" ≠ "defeat"; mid-round-drawn cards must be played that round) — *in progress; honored so far*. (5) **Expose the RNG seed** in `createGame` — *done*. Decisions 2 and 4 are the ones affecting gameplay fidelity.

## 7. Engine built so far (`src/engine/`)

**State & core**
- `types.ts` — `GameState` + `CardInstance`, `EnemyInstance`, `MissionSlot`, `MaquisInPlay`, `Action`, `Decision`, `EffectTask`. Notable `GameState` fields: `attackStrength` (banked base attack + ATTACK-action bonuses, spent by `SpendAttackOn`), `missionDefenseOverride` (Ricardo's halving), `attackRevealLimit` + `revealedInAttack` (Train Depot's ATTACK reveal cap), `ignoreMissionEffect` (Pilar·revealed), `removedFromGame`, `recoverDrawModifier` (Border/Valley), `spiesAvailable`, `chosenMissionUid`, `pendingDecision`, `effectQueue`, `log`. **Per-round scratch reset at ChooseMission:** `missionDefenseOverride`, `attackRevealLimit`, `revealedInAttack`. **Still owed to RECOVER (not built):** reset `attackStrength`, `ignoreMissionEffect`, `recoverDrawModifier`. `MissionSlot` has `faceDown` + `defeated`; `MaquisInPlay` has `side` + `actionUsed`.
- `rng.ts` — `rngNext(state)` (mulberry32) and `shuffle(arr, state)` → `{result, state}`; RNG state is a serializable integer.
- `setup.ts` — `createGame({ seed })`: 24 Maquis split 12/12; 3 Spies shuffled into the Hidden deck (3 aside → `spiesAvailable`); missions culled 4/3/3 (4 Era-1 available + a 6-card Era-2-over-Era-3 deck); 32 Enemies dealt by Garrison; Civilians shuffled; hand of 5.
- `zones.ts` — `countCards` + `assertConservation` (24 Maquis / 6 Spies / 32 Enemies / 8 Civilians / 10 Missions + uid uniqueness, counting the `removedFromGame` zone). Asserted after every action in tests.
- `actions.ts` — `applyAction` (all 7 actions: PlayMaquis / UseAction / ChooseMission / SpendAttackOn / AdvancePhase / **EndResistance / Continue**; Immer-based; throws on illegal). `legalActions` (PLAN + ATTACK as before; **AFTERMATH offers End + Continue**, End forced when no face-up missions remain). `resolveDecision`; the **effect-queue driver**; `settleAutomaticPhases` (runs the AFTERMATH auto-steps once the queue drains). AFTERMATH/RECOVER: `resolveAftermath` (civilian-loss check + mission SUCCESS→`defeatedMissions`+refill / FAILURE→faceDown+`failedMissions`, 2nd = loss), `applyEndResistance` (VP sum → `scoreTier` → win), `applyContinue` (RECOVER cleanup → draw 5 with `recoverDrawModifier` → reset scratch → PLAN/round+1, all-Spy hand = loss). Helpers `playoutComplete` / `chosenSlot` / `effectiveDefense` / `isTargetLegal` / `civilianTotal` / `refillEnemyDeckIfEmpty`.

**Effects** (`src/engine/effects/`) — registration is **explicit, not on import**, so the driver's `[stub]` path stays testable; the app bootstrap calls `registerPlanEffects()` + `registerAttackEffects()` + `registerEnemyEffects()` + `registerMissionEffects()`.
- `registry.ts` — `EffectHandler` shape + `registerEffect`/`unregisterEffect` + id helpers `maquisEffectId`/`missionEffectId`/`enemyEffectId`. The `[stub]` path (unregistered → logged + skipped) still exists but **no effect uses it** — every card effect is implemented.
- `plan.ts` — all 23 PLAN-usable Maquis actions (draw, look-top-3-discard-reorder on Hidden & Enemy decks, spy discard/remove, discard-Maquis-draw-2, Revealed-pile pick, scout, Recruit manipulation, **Pilar·revealed** → sets `ignoreMissionEffect`, **Emilio·hidden** → copies another hidden Maquis's action by delegating to its registered handler with `responses.slice(1)`). Exports `PLAN_EFFECTS`, `registerPlanEffects()`, `PLAN_PRECONDITIONS`, and the shared `drawHidden`/`firesInPhase`.
- `attack.ts` — ATTACK-side Maquis effects (chunks 1–2): attack/defense modifiers (Soledad·h, Abel·h/·r, Marcelino·r, Benigno·r, Ricardo·r), enemy discard/move/sweep (Anastasio, Emilio·r, Adolfo·h, Paquita·r, Consuelo·r, Adela·h/·r, Soledad·r), ATTACK draws (Nicolás·h, Ricardo·h). Exports `ATTACK_EFFECTS`, `registerAttackEffects()`, `ATTACK_PRECONDITIONS`.
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
- `ui/useGame.ts` — hook holding a state-history stack: `state`, `actions` (= `legalActions`), `dispatch` (applyAction), `respond` (resolveDecision), `undo`, `newGame`, `error`.
- `ui/format.ts` — id→label helpers (`nameOfMaquis`, `describeUid`, `actionLabel`, …); cards render from `/data`, text-first.
- `ui/DecisionPanel.tsx` — renders all four `pendingDecision` kinds and collects the response.
- `App.tsx` — board (mission row + enemies, hidden/revealed play areas, hand, pile counts), grouped legal-action buttons, decision panel, result banner, log, undo/new-game. Styling in `index.css` (thematic dark).

**Tests (100/100 pass; `tsc --noEmit` + `npm run build` clean).** `setup.test.ts` (9) · `plan.test.ts` (8, includes the `[stub]`-path test) · `effects/plan.test.ts` (16) · `attack.test.ts` (5) · `attack_resolution.test.ts` (7) · `effects/attack.test.ts` (5) · `effects/attack_actions.test.ts` (7) · `effects/enemies.test.ts` (8) · `effects/missions.test.ts` (20) · `effects/emilio.test.ts` (3) · `aftermath.test.ts` (6) · `worked_example.test.ts` (1 — the M2 gate) · `ui/playthrough.test.ts` (1 — full games to an ending, 40 seeds, via the UI path) · `data/data.test.ts` (4). Conservation asserted wherever cards move.

## 8. Immediate next task — Phase 3 polish (the UI prototype exists)

A working UI is in `src/ui/` + `src/App.tsx` (`npm run dev`). It's functional but plain — the next slices are playtest-driven polish. Suggested order:
1. **Playtest it.** Run a few games; watch for confusing moments (e.g. count-based bonuses — see the note below — or mandatory play-out not being obvious). Fix the sharpest rough edges first.
2. **Clarity passes:** show each card's *action text* on hover/inline (currently only names + attack show for Maquis in hand/play); label the chosen mission and the "you must play out your hand" state more loudly; surface `state.log` events as transient toasts.
3. **Decision UX:** the `DecisionPanel` works but is utilitarian — improve `selectCards`/`orderCards` affordances; auto-confirm single-candidate `selectTarget`s if desired.
4. **Optional niceties:** seed entry for reproducible games; a compact "what happened" summary after AFTERMATH.

**Two small engine leftovers (fix anytime; independent of the UI):**
1. **Known bug — enemy Defense isn't reset on reshuffle.** Benigno/Engineer/Mayor mutate `enemy.defense` in place; if an enemy later cycles through `enemyDiscard` and `refillEnemyDeckIfEmpty` reshuffles it back, it keeps the modified value. Fix: store a printed `baseDefense` on `EnemyInstance` (in `setup.ts`) and reset `defense = baseDefense` when an enemy is discarded/reshuffled.
2. **Optional — draft-variant setup** (`createGame` has no `draft` option). Interactive; a self-contained slice.

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
