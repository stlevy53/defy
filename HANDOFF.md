# Resist! PC Port — Working Handoff

Bootstrap file for continuing this project in a fresh chat. Read this first, then `docs/ENGINE_DESIGN.md` and `data/README.md`. This supersedes the original research handoff (`RESIST_PC_PORT_HANDOFF.md`, kept for its full rules writeup).

Last updated at repo state: `main` @ `2f48f0a` (Phase 2 ATTACK sub-slice 3 chunk 1: attack/defense modifier effects shipped). Re-pin this hash after each user-side commit.

---

## 1. What this is

A single-player digital port of the physical solitaire card game **Resist!** (Salt & Pepper Games, 2022) — Spanish Maquis vs. Franco, deck-destruction, ~30 min, no AI opponent. Built as a **web app** so it runs in a browser now and can wrap in Tauri for a desktop build later with no rewrite.

## 2. Repo & environment

- **Local folder** (connected in Cowork): `C:\Users\stephen.levy\GHRepos\DEFY!`
- **GitHub**: `https://github.com/stlevy53/defy`, branch `main`.
- **Sandbox path** for `mcp__workspace__bash`: `/sessions/<session>/mnt/DEFY!` (differs per session; check the Shell access note).

### Critical workflow quirks (read before touching git)
- **The sandbox cannot complete git commits.** The network mount blocks unlinking `.git/*.lock`, which leaves stale `index.lock`/`HEAD.lock` and breaks subsequent git ops. **Do NOT commit from the agent.** Instead: the agent writes & verifies files, and **the user runs `git add/commit/push` from their machine** (they use Claude Code / terminal). If a stale lock exists, the user deletes `.git\index.lock` (and `HEAD.lock`) first.
- **Develop-and-verify pattern**: build/test in the sandbox first, then copy into the repo. Node/npm are available in the sandbox. The established approach: keep a working copy at `/tmp/scaffold` with deps installed, write engine files there, run `npx tsc --noEmit` + `npm test` + `npm run build`, then `cp` the verified files into the mounted repo. This avoids running `npm install` against the mount.
- **Card image transcription** (already complete): `Card Assets/*.jpg` are phone photos, some rotated/upside-down. Use ImageMagick in bash (`convert -crop … -rotate … -resize`) to slice individual cards, write crops to the outputs dir, then `Read` them. CCW (`-rotate -90`) for the Maquis sheet; `-rotate 180` for the landscape mission/civilian sheets.

## 3. Tech stack (decided)

TypeScript + **React 18** + **Vite 5** + **Vitest**. Text-rendered cards (render from JSON, not photo crops — photos remain a possible later swap). Rules engine is plain TypeScript, no React. Tauri for desktop packaging is a Phase 4 option.

Commands: `npm install`, `npm run dev`, `npm test`, `npm run build` (build = `tsc --noEmit && vite build`).

## 4. Status & roadmap

- ✅ **Phase 1 — card data** → `/data` (see §5). Validated against rulebook.
- ✅ **Phase 0 — scaffold** → Vite+React+TS, data loader, placeholder UI, test suite.
- 🔜 **Phase 2 — rules engine** (in progress). Slice 1 (state + RNG + setup) done. Slice 2 (PLAN core: action/decision system, play-Maquis, choose-mission) done. Slice 3 (PLAN card-action effects) done. ATTACK slice underway: sub-slice 1 (ATTACK entry + mandatory play-out) done; **sub-slice 2 (attack resolution) done; sub-slice 3 chunks 1–2 (ATTACK Maquis effects: modifiers + enemy manipulation + draws) done**. **Next: sub-slice 3 chunk 3 — mission/enemy effect handlers (retires the `[stub]` path).**
- ⬜ Phase 3 — playable prototype UI.
- ⬜ Phase 4 — polish + desktop packaging.

## 5. Card data (`/data`, all validated — see `data/README.md`)

`maquis.json` (24, hidden+revealed sides), `missions.json` (20: Era1×8, Era2×6, Era3×6), `enemies.json` (32 across 8 types, per-copy defense values), `civilians.json` (8), `spies.json` (6), `rules.json` (setup constants, loss conditions, win table).

Key facts locked during transcription:
- Mission icons: card-stack = **Garrison** (enemies dealt), numbered shield = **Defense** (attack strength to defeat), laurel = **Victory Points**.
- Enemy count is **32** (rows 11+11+10); the original handoff's "33" was a miscount.
- Win table: **Epic** = defeat all 10 missions; **22+** Major; **19–21** Victory; **15–18** Minor; **1–14** Draw.
- One Engineer's defense was obscured in the photo; inferred as 3 and **confirmed by the user**. Engineers are defense 2 and 3.

## 6. Engine design & approved decisions

Full spec: `docs/ENGINE_DESIGN.md`. Core architecture:
- **Pure, deterministic, headless.** Engine = pure functions over a plain-JSON `GameState`. Seeded RNG lives in state (reproducible games, easy undo/save, deterministic tests).
- **Interaction model (the crux).** Effects that need player input push onto an internal `effectQueue` and **suspend by setting `pendingDecision`**; the caller responds via `resolveDecision`. Engine never calls back into the UI.
- **Data-driven effects.** Behavior lives in a registry keyed by card id/type (`maquisActions[id][side]`, `missionEffects[id]`, `enemyEffects[typeId]`).
- **Phase state machine**: `PLAN → ATTACK → AFTERMATH → RECOVER → (loop)`; `legalActions(state)` is derived so the UI holds no rules.
- **Acceptance gate (M2):** encode the rulebook's worked first turn (PDF pp. ~11–13) as a scripted Action/Decision sequence; the engine is "correct" when it reproduces it. Also enforce a card-conservation invariant after every action.

**§9 decisions — ALL APPROVED by the user:**
1. Use **Immer** for immutable updates in handlers. *(Not yet added to package.json — add when the effect system lands.)*
2. **Implement all** 24 Maquis + 20 mission + 8 enemy-type effects up front (no stubs).
3. **State-history stack** for undo (v1).
4. **Cover the rulebook FAQ edge cases** in v1 (reshuffle-on-empty; "discard" ≠ "defeat"; mid-round-drawn cards must be played that round).
5. **Expose the RNG seed** in `createGame`.

Confirmed with the user that decisions 2 and 4 are the ones affecting gameplay fidelity; the rest are invisible to the player.

## 7. Engine built so far (`src/engine/`)

- `types.ts` — full `GameState` model + `CardInstance`, `EnemyInstance`, `MissionSlot`, `MaquisInPlay` (now has `actionUsed`), `Action`/`Decision`/`EffectTask`.
- `rng.ts` — `rngNext(state)` (mulberry32) and `shuffle(arr, state)` → `{result, state}`. RNG state is a serializable integer.
- `setup.ts` — `createGame({ seed })`: 24 Maquis split 12/12; 3 Spies shuffled into Hidden deck (3 aside → `spiesAvailable`); missions culled 4/3/3 with 4 Era-1 available and a 6-card Era-2-over-Era-3 deck; 32 Enemies dealt by Garrison; Civilians shuffled; starting hand of 5.
- `zones.ts` — `countCards` + `assertConservation` (24/6/32/8/10 + uid uniqueness), used after every action in tests.
- `effects/registry.ts` — effect registry shape: `EffectHandler` = re-invoked resumable function receiving `{state (Immer draft), sourceUid, args, responses}`; returns a `Decision` to suspend or nothing when done. Id conventions `maquis:{id}:{side}` / `mission:{id}` / `enemy:{typeId}`. Unregistered effects are skipped with a `[stub]` log line (still used for not-yet-implemented mission/enemy effects).
- `effects/plan.ts` — **all PLAN-usable Maquis card actions** (21 effect ids), replacing the `[stub]` path for those. Families: draw-from-Hidden; look-top-3-discard-reorder (Hidden and Enemy decks); spy-discard-draw / remove-spy-from-game; discard-a-Maquis-draw-2; Revealed-pile pick (→ hand or Hidden top); scout (flip all at a mission; flip-1-2-then-discard); Recruit-deck manipulation. Also exports `registerPlanEffects()`, `canFireEffect(effectId, state)` (precondition checks), and `PLAN_EFFECTS`. **Handler convention (critical):** stage-style — re-invoked from the top each resume, reads prior answers from `responses`, uses `responses.length` as the stage counter, and **mutates state only in the terminal invocation** (pre-terminal stages only return a Decision) so re-runs are idempotent. Registration is **explicit, not on import** — the app bootstrap and any test exercising real effects must call `registerPlanEffects()` (keeps the driver's `[stub]` path testable in isolation).
- `actions.ts` — `applyAction` (PlayMaquis / UseAction / ChooseMission / **SpendAttackOn / AdvancePhase**, Immer-based, throws on illegal; PlayMaquis/UseAction legal in PLAN or ATTACK), `legalActions` (PLAN and ATTACK; both sides per non-spy hand card; phase-matched unused actions gated by `canFireEffect`; ChooseMission only in PLAN; ATTACK enforces mandatory play-out, then offers `SpendAttackOn` on affordable targets + `AdvancePhase`), `resolveDecision`, the **effect-queue driver**, plus attack helpers `playoutComplete` / `chosenSlot` / `effectiveDefense`. `EndResistance`/`Continue` still unimplemented (AFTERMATH sub-slice).
- `types.ts` / `setup.ts` — also gained `GameState.attackStrength` (banked base attack, spent by SpendAttackOn; reset in RECOVER — not yet built), `GameState.missionDefenseOverride` (Ricardo's halving; cleared at ChooseMission), and `MissionSlot.defeated`.
- `effects/attack.ts` — ATTACK-side Maquis effects (chunks 1–2: modifiers, enemy discard/move/sweep, ATTACK draws). `registerAttackEffects()` / `ATTACK_EFFECTS` / `ATTACK_PRECONDITIONS`, explicit registration like the PLAN effects.
- `effects/preconditions.ts` — `canFireEffect` (unions PLAN + ATTACK precondition maps); consulted by `legalActions`. `drawHidden` is exported from `effects/plan.ts` and reused by the ATTACK draws.
- `zones.ts` — now also counts the `removedFromGame` zone so remove-Spy-from-game effects keep conservation balanced.
- `types.ts` / `setup.ts` — `GameState` gained `removedFromGame: CardInstance[]` (cards destroyed by effects, e.g. Manuela/Manuel removing a Spy); initialised `[]`.
- `index.ts` — public API: all of the above + `registerEffect`/`unregisterEffect` + `registerPlanEffects`/`canFireEffect`/`PLAN_EFFECTS`.
- Tests: `setup.test.ts` (9) + `plan.test.ts` (8, unchanged — still validates the driver's `[stub]` path) + `effects/plan.test.ts` (16: one per effect family + precondition gating) + `attack.test.ts` (5: ATTACK entry, play-out, Spy exclusion, gating, PLAN-played card firing its ATTACK action) + `attack_resolution.test.ts` (7: base-attack accrual, DEFEND queued at ChooseMission, SpendAttackOn enemy/mission + rejection, gating, AdvancePhase → AFTERMATH) + `effects/attack.test.ts` (5: attack-value modifiers, Benigno reduction, Ricardo halving) + `effects/attack_actions.test.ts` (7: enemy discard ×1/×2, Consuelo discard+gain, Adela move, counter-guerrilla sweep, ATTACK draw, gating) — conservation asserted after every action. **61/61 pass**; `tsc --noEmit` and `npm run build` clean.

## 8. Immediate next task — ATTACK slice

The ATTACK slice is being built in sub-slices.

**Sub-slice 1 — DONE (ATTACK entry + mandatory play-out).** `applyPlayMaquis`/`applyUseAction` now run in PLAN *or* ATTACK; `legalActions` offers PlayMaquis (both sides) and phase-matched UseAction in ATTACK (a card played in PLAN can fire its ATTACK-side action here), still excluding Spies. No phase-advancing action is offered while a playable Maquis remains, enforcing the mandatory play-out. Tests: `attack.test.ts` (5).

**Sub-slice 2 — DONE (attack resolution).** `GameState.attackStrength` banks each played Maquis's base Attack (added in `applyPlayMaquis`; ATTACK-action bonuses will `+=` it in sub-slice 3). `MissionSlot.defeated` flags a defeated mission (physical move to Defeated Missions deferred to AFTERMATH). `applyChooseMission` queues DEFEND tasks (`{trigger:'DEFEND'}`) for the mission + each enemy. `SpendAttackOn` (legal only once play-out is complete) spends `effectiveDefense(slot, targetUid)` — enemy → discard + DEFEAT task; mission → `defeated=true` + DEFEAT task; throws on unaffordable / already-defeated. `AdvancePhase` (ATTACK→AFTERMATH) queues SURVIVE for undefeated enemies then discards them. `effectiveDefense` just reads current enemy/mission Defense — DEFEND and ATTACK-action defense mutations happen in trigger order, so the FAQ ordering (Engineer +1 before Benigno −1) falls out of execution order. **Effect trigger is passed via `task.args.trigger` (`DEFEND`/`DEFEAT`/`SURVIVE`)**; mission/enemy handlers are still `[stub]`. Tests: `attack_resolution.test.ts` (7).

**Sub-slice 3 — in progress.**
- ✅ **Chunk 1 — attack/defense modifiers (`effects/attack.ts`).** Soledad·h/Abel·h (+1 per revealed), Marcelino·r (+1 per other), Abel·r (+1 per civilian in Graveyard) → `state.attackStrength += bonus`; Benigno·r (−1 to enemies Defense ≥2) mutates `enemy.defense`; Ricardo·r halves the mission via the new `GameState.missionDefenseOverride` (null = static; cleared at ChooseMission; `effectiveDefense` reads it). `registerAttackEffects()` / `ATTACK_EFFECTS` exported; explicit registration like the PLAN effects. Tests: `effects/attack.test.ts` (5).
- ✅ **Chunk 2 — enemy manipulation + ATTACK draws (`effects/attack.ts`).** Discard one enemy (Anastasio·h/·r, Emilio·r, Adolfo·h — `selectTarget`, discard ≠ defeat so no DEFEAT fires), Paquita·r (two), Consuelo·r (discard one + `attackStrength += its Defense`), Adela·h (move an enemy to another available Mission — two `selectTarget`s), Soledad·r/Adela·r (sweep all `counter_guerrilla`), and ATTACK draws Nicolás·h/Ricardo·h (`drawHidden`, now exported from `effects/plan.ts`). Preconditions moved to **`effects/preconditions.ts`** (`canFireEffect` now unions `PLAN_PRECONDITIONS` + `ATTACK_PRECONDITIONS`); ATTACK discard/move/sweep actions are gated on having a valid target. Tests: `effects/attack_actions.test.ts` (7).
- ⬜ **Chunk 3 — mission/enemy effect handlers** (`mission:{id}`, `enemy:{typeId}`), branching on `ctx.args.trigger` (`DEFEND`/`DEFEAT`/`SURVIVE`). This retires the `[stub]` path. Note the DEFEND *constraints* (Guard: defeat all Guards before the Mission; Grunt: before other Enemies; Engineer: +1 to other enemies here — already resolvable since it mutates `enemy.defense` at DEFEND time) must feed `legalActions`' `SpendAttackOn` ordering, not just mutate state. Counter-guerrilla/Spy Master/Military/Radio-Operator SURVIVE and Jailor DEFEAT effects touch civilians/spies/recruit/other-missions.
- **Mission/enemy effect handlers** (`mission:{id}`, `enemy:{typeId}`) branch on `ctx.args.trigger` (`'DEFEND'|'DEFEAT'|'SURVIVE'`). Note the ordering caveat: `applyAdvancePhase` currently queues each enemy's SURVIVE task **and** moves the enemy to `enemyDiscard` in the same tick, so a SURVIVE handler sees the enemy already in `enemyDiscard` (find it by `sourceUid`). If a SURVIVE effect must act on the enemy in place, reorder so the queue drains before the discard.
- Add a `registerAttackEffects()` (mirror of `registerPlanEffects`) and a combined bootstrap.
- **Now unblocked — implement the two deferred PLAN effects:** `maquis:emilio:hidden` (copy a hidden Maquis's action; phase must match — cleaner now that ATTACK actions exist) and `maquis:pilar:revealed` (ignore the chosen Mission's effect — needs the mission-effect system this slice introduces; add an `ignoreMissionEffect` flag consumed during ATTACK).
- Per-effect unit tests as in `effects/plan.test.ts`; assert conservation after every action.

Register real effects at bootstrap with `registerPlanEffects()` + `registerAttackEffects()` (chunk 3 will add mission/enemy registration); the engine does not auto-register on import.

### Reference: round structure (from rulebook)
- **PLAN**: play Maquis (choose hidden/revealed), optional PLAN actions; choose one available Mission; reveal its face-down enemies.
- **ATTACK**: resolve DEFEND effects; play all remaining Maquis (mandatory), firing ATTACK actions; sum Attack Strength and spend target-by-target (defeat cost = target Defense); DEFEAT effects fire on defeat; undefeated enemies resolve SURVIVE then discard.
- **AFTERMATH**: civilian loss if Graveyard ≥ 5; mission outcome (refill on success; flip face-down + failed-count on failure; 2nd failure = loss); choose End Resistance or Continue.
- **RECOVER**: cleanup (revealed→revealed pile; hidden+spies→hidden discard); draw new hand of 5 (apply draw modifiers; reshuffle discard if needed); all-Spy hand = loss.
- **Loss**: fail 2 missions, 5+ civilians dead, or all-Spy hand. **Win/score** (whenever you end the resistance undefeated — by choice, or forced when no Available Missions remain): sum VP → tier table.

### Rules-fidelity traps (verified against rulebook; full list in `RESIST_PC_PORT_PLAN.md` §5)
- FAQ ruling: **Engineer's +1 applies before Benigno's −1** — DEFEND modifiers before ATTACK-action modifiers in `effectiveDefense`.
- DEFEND effects split into **one-shot triggers** (Bunker) vs **round-long constraints** (Train Depot, Grunt/Guard order rules) — constraints feed `legalActions`.
- Win table starts at 1 VP; **0 VP is unmapped** — decide (proposed: Draw) and record in `rules.json`.
- "Add a new Spy" effects **no-op when `spiesAvailable` is 0**; `recoverDrawModifier` (Valley/Border) applies to that round's Recover only, then resets.
- Spies are never playable; `legalActions` must exclude them from the mandatory play-out.
- **Draft-variant setup is designed but not implemented** (`createGame` has no `draft` option yet) — scheduled as a Phase 2 slice after the decision system exists, since drafting is interactive.

## 9. Working style notes

The user is not a developer but is technically fluent and learning — explain choices in plain terms, no unexplained jargon. Prefers tight, concrete output; iterate in reviewable slices; confirm before starting a new slice. All commits/pushes happen on the user's side. Keep the card set's rules fidelity high (decisions 2 & 4).
