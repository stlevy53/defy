# Resist! PC Port — Working Handoff

Bootstrap file for continuing this project in a fresh chat. Read this first, then `docs/ENGINE_DESIGN.md` and `data/README.md`. This supersedes the original research handoff (`RESIST_PC_PORT_HANDOFF.md`, kept for its full rules writeup).

Last updated at repo state: `main` @ `7af508c` (Phase 2 slice 1 shipped + docs). Re-pin this hash after each user-side commit.

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
- 🔜 **Phase 2 — rules engine** (in progress). Slice 1 (state + RNG + setup) done. **Next: PLAN phase.**
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

- `types.ts` — full `GameState` model + `CardInstance`, `EnemyInstance`, `MissionSlot`, `MaquisInPlay`, and the `Action`/`Decision`/`EffectTask` scaffolding (latter three not yet exercised).
- `rng.ts` — `rngNext(state)` (mulberry32) and `shuffle(arr, state)` → `{result, state}`. RNG state is a serializable integer.
- `setup.ts` — `createGame({ seed })`: 24 Maquis split 12/12; 3 Spies shuffled into Hidden deck (3 aside → `spiesAvailable`); missions culled 4/3/3 with 4 Era-1 available and a 6-card Era-2-over-Era-3 deck; 32 Enemies dealt by Garrison; Civilians shuffled; starting hand of 5.
- `index.ts` — public API (currently `createGame`, `shuffle`, `rngNext`, types).
- `setup.test.ts` — 9 tests: legal initial zone sizes, garrison dealing, **card conservation** (24/6/32/8/10), determinism. **13/13 tests pass** overall (with the 4 data tests).

## 8. Immediate next task — PLAN phase slice

Implement the first real player interactivity:
- `applyAction` / `legalActions` / `resolveDecision` entry points + the **effect-queue driver loop**.
- Play Maquis from hand as **hidden** (left zone, recycles) or **revealed** (right zone, discarded end of round), moving them to `inPlay`.
- Fire **PLAN** / **PLAN-ATTACK** actions when played; this introduces the **first `pendingDecision`-driven effects** (e.g. "draw a card", "look at the top three of the Hidden deck, discard any, reorder").
- **Choose the mission** to attack (`ChooseMission`), flipping its face-down enemies face-up.
- Add Immer here. Write a scripted PLAN-phase test.

**Open question posed to the user (unanswered):** do the full PLAN slice including card-action effects, or a tighter first pass (play-Maquis + mission-choice mechanics only, card-action effects in a follow-up slice)? Decide/confirm at the start of the next chat.

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
