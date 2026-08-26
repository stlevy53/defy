# Handoff: DEFY! board layout & card readability

## Overview

This package turns the design review in `DEFY Design Review.dc.html` into an implementation plan for the
Resist!/DEFY! PC port. It addresses two linked problems in the Phase 3 UI:

1. **Card art is unreadable at board scale.** A Mission tile renders 248px wide, so its 1050px photo lands at
   24% — Defense, VP, Garrison, the era subtitle and the effect text all render around 5px tall. Right-click
   zoom is currently the only way to read a card.
2. **The board scrolls.** Everything squeezed out of the width went into height. At a maximized 1920×1080
   window the page measures 1028px at 100% board size, 1285px at 125%, and 1439px at 140% — so the Board
   size setting that makes text readable is the setting that forces scrolling.

They are the same problem. The play column is capped at 1260px on a 1920px screen and spends 178px of that on
a pile rail, while ~240px of vertical space goes to a guidance tile that never changes. Reclaiming the width
makes cards readable; reclaiming the height removes the scroll.

Result of the plan: **Mission cards go from 248px to 452px wide with no zoom, no redraw and no new art**, and
the whole board fits 1080px with no scrolling.

## About the design files

`DEFY Design Review.dc.html` in this bundle is a **design reference created in HTML** — a prototype showing
intended layout, sizing and behaviour. It is not production code to copy. The task is to implement these
layouts in the existing React + TypeScript app (`src/App.tsx`, `src/ui/*`, `src/index.css`) using its
established patterns: the `Card.tsx` rendering seam, the `format.ts` guidance helpers, the existing CSS custom
properties, and the `useUiScale` zoom mechanism.

The file contains three 1920×1080 frames on a pannable canvas:

| Frame | What it is |
|---|---|
| `1a` | The **current** PLAN screen (round 1, seed 1) recreated from `App.tsx` / `Card.tsx` / `index.css`, with 9 findings annotated on it. Use it as the before-state reference. |
| `1b` | The **proposed** board, same game state, fitting 1080px with no scroll. |
| `1c` | The **proposed** board in ATTACK, mid-strike — where the feedback changes live. |

Below the frames: 12 written findings, each with a fix, and the build order repeated here as phases.

## Fidelity

**High-fidelity.** Colors, type sizes, spacing and component sizes in `1b`/`1c` are final and measured; every
frame was verified to fit 1080px with zero overflow. Values below are exact. Card art is the project's own
`src/assets/cards/**` at native aspect (Missions and Maquis 1050×750 landscape, Enemies 750×1050 portrait).

`1a` is a recreation for comparison, not a target — do not port anything from it.

---

# The plan

Six phases. Each is independently shippable, and each one frees the space the next one needs. Run
`npm test && npm run build` after each; run `npm run regress` to confirm you changed presentation only, and
`npm run tier2` to re-screenshot the board.

---

## Phase 1 — Drop the 1260px cap and the pile rail

**The single highest-value change.** This is what makes cards readable; everything after it is refinement.

### Files
`src/index.css`, `src/App.tsx` (`Piles`)

### Changes

1. **Remove the width cap.** `#root { max-width: 1260px; padding: 1.25rem }` becomes a full-width flex column:
   `padding: 12px 20px 16px`. The board is now 1880px of usable width at a 1920 window.

2. **Delete the `.board-grid` two-column layout** (`grid-template-columns: minmax(0, 1fr) 178px`) and the
   `.board-main` wrapper. Bands are now full-width siblings.

3. **Retire the `.piles` rail.** Four counts move inline into the status bar; the other seven go behind an
   **All piles** disclosure (a popover or a small modal — reuse the `SettingsMenu` overlay pattern).
   - Inline: **Hidden deck**, **Enemy deck**, **Mission deck**, **Graveyard**.
   - Behind the disclosure: Hidden discard, Recruit deck, Revealed pile, Enemy discard, Defeated, Spy supply,
     Removed.
   - Keep the existing `PileInfo` array and `tone-*` colors; only the presentation and the split are new.
   - Inline chip spec: `20×27px` deck icon, `border-radius: 3px`, `box-shadow: 1.2px 1.2px 0 var(--d2),
     2.4px 2.4px 0 var(--d3)`, count at `11px/800`, label at `11px` in `--muted`, `white-space: nowrap`.
   - Keep `data-pile-key` on the inline chips so `useCardFlights` still has flight targets (see Phase 6).

4. **Fix the Mission grid.** `.missions` currently uses `repeat(auto-fill, minmax(210px, 1fr))`, which spends
   surplus width on more columns — this is the still-open item in `docs/UX_BACKLOG.md`, and it is why removing
   the cap alone previously made tiles *smaller*. Replace with a **fixed four-across flex row**:
   ```
   display: flex; gap: 16px; justify-content: space-between;
   ```
   and set `.card.mission.has-art { width: 452px }` (was 260px). Four tiles + three 16px gaps = 1856px, which
   fits the 1880px content box.

### Acceptance
- At a maximized 1920 window, a Mission tile measures **452px** wide and its art **323px** tall.
- No horizontal scrollbar at board size 100–160% (the tooltip overflow fix in `.tip::after` must stay).
- `npm run regress` reports no behavioral change.

---

## Phase 2 — Overlay the stats the photo cannot show

The art branch of `MissionFace` renders name, era, Defense, VP, Garrison and effect **as pixels**. The
themed-frame branch renders all of them as real text. Bring that text back on top of the photo.

### Files
`src/ui/Card.tsx` (`MissionFace` art branch), `src/index.css`, `src/data/index.ts`

### Changes

1. **Export `eraNames`** from `src/data/index.ts`. It exists in `data/missions.json` ("Re-invasion of Spain",
   "Splintering of the Maquis", "Hunting the Maquis") and is currently never exported. `format.ts` already has
   `eraLabel`.

2. **Era plate** — absolute, `top: 8px; left: 8px`, `background: rgba(16,13,10,.85)`, `color: #cbbfa6`,
   `11px/700`, `letter-spacing: .08em`, `padding: 3px 8px`, `border-radius: 5px`, `white-space: nowrap`.
   Content: `ERA 1 · RE-INVASION OF SPAIN`. This replaces the current `.era-chip` in the top-right and closes
   the open era-legibility item in the backlog.

3. **Stat rail** — absolute across the foot of the art, `left/right/bottom: 0`, `padding: 26px 12px 9px`,
   `background: linear-gradient(rgba(16,13,10,0), rgba(14,11,9,.94) 62%)`, `display: flex; align-items: center;
   gap: 12px`.
   - Keyword badge on the left: `11px/800`, `letter-spacing: .1em`, `padding: 3px 8px`, `border-radius: 4px`,
     `white-space: nowrap`, reusing the existing `.kw-DEFEAT` / `.kw-DEFEND` / `.kw-SURVIVE` colors.
   - Stats on the right (`margin-left: auto`, `gap: 14px`, `17px/800`, `white-space: nowrap`):
     `🛡 {defense}` in `--ink`, `★ {vp}` in `--accent-2`, `☗ {garrison}` in `#e0a58f`.
   - `defense` must keep honouring `state.missionDefenseOverride`, and the Garrison figure keeps the existing
     `+N` reinforcement suffix logic (`garrisonExtra`). The separate `.def-override` pill can be retired — the
     rail now shows the live number.

4. **Name + effect as real text below the art.** `padding: 9px 12px 8px`. Name `16px/700` in `--ink`; effect
   `12.5px`, `line-height: 1.35`, `color: #b6ab97`, `height: 30px; overflow: hidden`, `text-wrap: pretty`.
   The fixed height keeps tile heights identical across the row; full text stays in right-click zoom.

5. **Hand card side plates.** In `MaquisHandFace`'s art branch, the invisible `.play-hotspots` gain a visible
   readable strip along the bottom of the card — two halves matching the printed Hidden/Revealed split:
   - Hidden half: `background: rgba(122,43,32,.92)`, label `HIDDEN` at `9.5px/800` in `#ffcfc4`, value
     `⚔ {attack}` at `12.5px/800` in white, plus the action's **phase tag** (`PLAN`, `ATTACK`,
     `PLAN/ATTACK`, or `—`) at `9.5px/700`.
   - Revealed half: same, `background: rgba(79,47,116,.92)`, accents `#dcc9ff`.
   - The phase tag is the key scannable fact — it tells you which side is useful *this phase* without reading
     the fine print. Source it from `maquisSideAction(dataId, side)?.type`.

### Acceptance
- Every number a player scans on a Mission is legible at board size 100% without zoom.
- Tile heights are identical across the Mission row and do not change when Defense is modified.

---

## Phase 3 — Shrink guidance to one line

Frees ~180px of height.

### Files
`src/App.tsx` (`PhaseGuide`), `src/index.css`, `src/ui/format.ts`

### Changes

1. **Fold the breadcrumb into a phase chip** in the status bar: `border-radius: 999px`, `padding: 4px 12px 4px
   6px`, a 22px white numeral disc, phase name at `13px/800`, `letter-spacing: .1em`. Background is the phase
   color — `--accent` (#c8452f) for PLAN, `#7a2b20` for ATTACK. The full four-step breadcrumb moves behind the
   `?`. Losing the always-on breadcrumb is deliberate: the phase chip plus the guidance sentence carries it,
   and the round is stated in the status bar.

2. **One guidance line.** Render `guidanceFor(state, actions).now` only — `15px/600` in `--ink`, with an
   optional muted trailing clause. It must be `white-space: nowrap` with `overflow: hidden; text-overflow:
   ellipsis`, **and the copy must actually fit** — measured budget is ~690px at 1920. Verified copy:
   - PLAN: `Play Maquis onto Hidden or Revealed, then choose the Mission you attack.`
   - ATTACK: `Spend Attack Strength on the guards, then the Mission.` + muted `Grunts fall first.`
   If you add phases or lengthen copy, re-measure `scrollWidth` vs `clientWidth`; a clipped guidance line is
   worse than the tile it replaced.

3. **`?` button** — 24×24px, `border-radius: 999px`, `1px solid var(--line)`, muted. Opens the full
   `guidance.steps` list with the active step lit, plus the phase breadcrumb. Same overlay pattern as Coach.

4. **Situational prompts move to the board.** Anything that is about a specific card belongs on that card, not
   in a tile: the row label carries `▸ Choose one to attack this round` in `--accent-2` at `12.5px/600`, and
   during ATTACK `▸ Attacking {mission} — the other three are out of reach this round` in `#e0a58f`.
   `DecisionPanel` / `DecisionModal` routing is unchanged.

### Acceptance
- Guidance occupies one 56px status bar row; no `.phase-message` block on the board.
- The guidance line never ellipsises in any phase, at any board size.

---

## Phase 4 — Rebuild the vertical rhythm as fixed bands

With Phases 1–3 done the height fits. Lock it in so it cannot regress.

### Layout (1920×1080, board size 100%)

Root: `display: flex; flex-direction: column; padding: 12px 20px 16px; gap: 12px`. Requires a
`box-sizing: border-box` reset (the app has one; keep it).

| Band | Height | `flex` | Contents |
|---|---|---|---|
| Status bar | 56px | `none` | Title, phase chip, guidance line, `?`, meters, pile chips, Undo, ⚙ |
| Event line | 29px | `none` | One transient message, centred (Phase 6) |
| Mission row | ~540px | `none` | Label row + four 452px tiles |
| Committed lanes | flexes | `1 1 auto` | Hidden \| Revealed, divided; Attack Strength token at the right |
| Your hand | ~208px | `none` | Label row + one row of 230px cards |

The hand band is `flex: none` so it sizes to its content; the **committed lanes** take the surplus, because
that is the band that genuinely grows during a round. Do not give the hand `flex: 1` — it produces an empty
rectangle, which is the flaw this plan is removing.

### Status bar meters

Always visible, empty at the start. `App.tsx` currently renders these only when the count is above zero, so
the two loss conditions are invisible until you are already losing. Make them unconditional:

- **SCORE** — label `10px/700`, `letter-spacing: .12em`, `--muted`; value `★ {n} VP` at `17px/800` in
  `--accent-2`.
- **MISSIONS FAILED** — two segments, `26×7px`, `border-radius: 2px`, empty `#2f2820` with `1px solid
  #4a3d2c`, filled `--loss`.
- **CIVILIANS LOST** — five segments, `14×7px`, same treatment, filled `--win` → `--warn` → `--loss` as it
  climbs.

All meter labels need `white-space: nowrap`; the cluster sits between `1px solid var(--line)` dividers.

### Undo

Promote it out of the ghost-button row: `background: rgba(217,154,36,.14)`, `color: var(--accent-2)`,
`1px solid rgba(217,154,36,.55)`, `border-radius: 8px`, `padding: 7px 16px`, `14px/700`, label `↺ Undo`,
`opacity: .4` when disabled. **Move the `v{APP_VERSION}` button into Settings** — What's New is still
reachable from there, and the build stamp should not compete with the most-used control in a solitaire game.

### Committed lanes

One panel, `border-radius: 10px`, `background: rgba(20,16,12,.55)`, `1px solid rgba(122,98,62,.32)`, split by
a `1px` divider in the same color. Each half: an 8×8px side swatch (`#7a2b20` hidden, `#4f2f74` revealed), the
side name at `11px/800` `letter-spacing: .16em` in `--muted`, and a hint at `11.5px` in `#6f6558`. Empty state
is a `1px dashed rgba(122,98,62,.4)` well, not an em dash.

Cards are **230px** wide (was 192px). Keep the existing half-dim (`.side-dim`, `rgba(10,8,6,.66)`) and the
`MoveMaquis` click-through. Replace the `.use-under` button with a bar across the foot of the card:
`padding: 4px 8px`, `⚔ {attack}` at `14px/800` white on the left, state at `10.5px/800` right —
`ATTACK · USE` on `rgba(217,154,36,.92)` when firable, `SPENT` / `USED IN PLAN` on `rgba(20,16,12,.9)` in
`#6f6558` otherwise.

The drop targets keep `.zone.drop-ok` and the whole `useCardSlide` grab-to-slide mechanism unchanged.

### Hand

`flex: none`, `border-radius: 10px`, `background: rgba(20,16,12,.62)`, `1px solid rgba(122,98,62,.38)`,
`padding: 9px 14px 12px`. Cards **230px** wide (was 250px) in a single non-wrapping row — eight fit. Hint copy:
`click a half to commit that side · hover to read the card`.

### Acceptance
- Total column height ≤ 1080px at board size 100%, with **zero** vertical scroll.
- No band contains more than ~20px of empty space below its last child.
- Re-measure at 125% and 140%: scrolling at high board sizes should now be a much smaller overflow, and the
  "big window doesn't pay off" backlog item can be closed.

---

## Phase 5 — Fixed five-slot garrison strips

### Files
`src/ui/Card.tsx` (`MissionFace`, `EnemyChip`), `src/index.css`

Enemy tokens are wrapping flex items today, so four guards break onto two lines and tile height jumps —
worse when a Radio Operator or the Barracks reinforces mid-round.

### Changes

1. **Fixed strip.** `display: flex; gap: 6px; padding: 0 12px 12px`, exactly **five slots** of `78×109px`
   (Enemy art is 750×1050, so 78px wide is 109px tall — no cropping). Five is the observed maximum garrison
   plus reinforcement headroom; confirm against `data/missions.json` and the reinforcement effects before
   committing to the number.

2. **Empty slots are visible.** `1px dashed rgba(122,98,62,.3)`, no fill. The last empty slot on the chosen
   Mission reads `room for 1 more` at `11px` in `#5c5348` — reinforcements now have somewhere legible to land,
   and the player can see how much worse it can get.

3. **Face-down slots** show `background: rgba(30,24,19,.9)`, `1px solid #4a3d2c`, and a `?` at `22px` in
   `#6f6558`. **The Enemy card back art is still missing** from `src/assets/cards/enemy/` (noted in the
   README's remaining work) — when it lands, drop it in here; `enemyBackArt()` already looks for it.

4. **Face-up Enemies** keep their art, with `🛡 {defense}` on a full-width footer strip
   (`rgba(14,11,9,.88)`, `12px/800`, centred) rather than the current corner pill — legible at a glance
   without hover.

5. **Strike order is taught before the click, not after it.** Today an illegal click pulses the gating Grunts
   for 1.5s (`mustStrike` / `.must-strike-ring`). Instead, rank the strip up front:
   - Legal targets: `2px solid var(--accent)` + `box-shadow: 0 0 0 3px rgba(200,69,47,.35)`, badge
     `STRIKE 1st` on `--accent` at the slot's top-left corner (`9.5px/800`, `border-bottom-right-radius: 5px`).
   - Gated targets: `opacity: .5`, `1px solid var(--line)`, quiet `2nd` / `3rd` badge on `rgba(14,11,9,.85)`
     in `--muted`. Derive the ordering from the existing `gatingStrikeUids`.
   - Keep the pulse as a fallback for a click on a gated target, but it should now be rare.
   - **Reserve pulsing for one thing at a time.** The ochre `pick-pulse` / `pick-outline` animations and this
     red ring must never run simultaneously.

6. **Unchosen Missions during ATTACK** drop to `opacity: .42` with a `1px solid var(--line)` border, so the
   one you are attacking is unmistakable. The chosen one gets `2px solid var(--accent)` plus
   `box-shadow: 0 0 0 4px rgba(200,69,47,.22)` and an `UNDER ATTACK` plate replacing the era plate.

### Acceptance
- Mission tile height is constant through a whole game, including reinforcement and defeat.
- Every legal strike target is identifiable without clicking anything.

---

## Phase 6 — Consolidate feedback

### Files
`src/App.tsx` (`AttackMeter`, `AttackStrengthPill`, `Toast`), `src/ui/useGame.ts` (`useLogToasts`,
`useCardFlights`), `src/index.css`

### Changes

1. **One Attack Strength object.** Today the topbar pill and the tile meter show the same number ~400px apart,
   each with its own animation. Delete both; put a single token at the **right end of the committed lanes** —
   190px wide, `border-radius: 10px`, `background: rgba(200,69,47,.16)`, `2px solid var(--accent)`, label
   `ATTACK STRENGTH` at `10px/800` `letter-spacing: .14em` in `#e0a58f`, value at `52px/800` white, sublabel
   `left to spend` at `11px`. Dormant state (PLAN, value 0): `opacity: .5`, no accent border, sublabel
   `builds as you commit Maquis`.
   - Gains keep the existing bump; spends count **down** on the token and float a red `−{cost}` at its top
     right, mirrored by a `−{cost}` on the struck Enemy's slot (`--accent`, `15px/800`, `border-radius: 6px`).
   - This puts the number at the seam between where it is generated and where it is spent.

2. **One event line.** Replace the bottom-left toast stack with a single centred pill under the status bar:
   `border-radius: 999px`, `background: rgba(20,16,12,.92)`, `1px solid rgba(217,154,36,.45)`,
   `padding: 5px 16px`, a 7px `--accent-2` dot, message at `13px` in `--ink`. **One message at a time**, and
   only for events not already visible on the board — filter `useLogToasts` accordingly. Anything that
   happened to a card animates on that card instead (the struck Enemy takes the hit; the reinforced Mission
   flashes its garrison strip — `reinforce-badge` and `enemy-drop-in` already do this well and should stay).

3. **Shorten the card flights.** With the rail gone, `useCardFlights` should target the inline pile chips in
   the status bar — a ~200px travel instead of up to 1000px. Keep `data-pile-key` on the chips and the
   `FLIGHT_ZONES` mapping; only the destination geometry changes. Note the zoom caveat from the backlog:
   under CSS `zoom`, `getBoundingClientRect()` returns unzoomed layout pixels, which is the same space a
   `position: fixed` child is placed in — **do not** correct flight coordinates by the zoom factor.

4. **Hover-peek instead of mandatory zoom.** Pointing at a hand or committed card lifts a 404px copy above it:
   `2px solid var(--accent-2)`, `box-shadow: 0 20px 50px rgba(0,0,0,.8)`, the art on top and both sides'
   printed text as real HTML below — per side, a `10px/800` header (`HIDDEN · ⚔ 2`) in `#e0a58f` / `#cdb0ff`
   and the action at `12px`, `line-height: 1.35`, with the phase tag bolded in `--accent-2`. Source it from
   `maquisSideAction` — the same data `ZoomMaquisCard` uses in its no-art branch.
   Right-click zoom stays for the full photo; the peek answers the common question without a modal.

### Acceptance
- Attack Strength appears exactly once on screen.
- At most one transient message visible at any time.
- Reading any card's rules text requires no click.

---

# Reference

## Design tokens

Existing `:root` values in `src/index.css` are unchanged and used throughout:

```
--bg #14110e    --panel #201a15   --panel-2 #2a221b   --ink #efe6d6
--muted #9a8f7d --line #3a3025    --accent #c8452f    --accent-2 #d99a24
--win #6ea84f   --warn #d0873a    --loss #b23b2c
```

New values introduced by this plan:

| Purpose | Value |
|---|---|
| Body text on cards | `#b6ab97` |
| Dim / placeholder text | `#6f6558`, `#5c5348` |
| Era plate text | `#cbbfa6` |
| Hidden side accent | `rgba(122,43,32,.92)` bg, `#ffcfc4` text |
| Revealed side accent | `rgba(79,47,116,.92)` bg, `#dcc9ff` / `#cdb0ff` text |
| Garrison / warning figures | `#e0a58f`, `#ff9a86` |
| Meter track | `#2f2820` fill, `#4a3d2c` border |
| Band surface | `rgba(20,16,12,.55)` lanes, `rgba(20,16,12,.62)` hand |
| Band border | `rgba(122,98,62,.32)` lanes, `rgba(122,98,62,.38)` hand |
| Status bar surface | `rgba(18,15,12,.9)`, border `rgba(122,98,62,.45)` |

Type scale in use: `9.5 / 10 / 11 / 11.5 / 12.5 / 13 / 14 / 15 / 16 / 17 / 22 / 44 / 52px`.
Radii: `2 / 3 / 4 / 5 / 6 / 8 / 9 / 10 / 12 / 999px`. Font stack unchanged
(`'Segoe UI', system-ui, Helvetica, Arial, sans-serif`).

## Component sizes

| Element | Before | After |
|---|---|---|
| Play column | 1260px capped | full width, 20px side padding |
| Pile rail | 178px | removed (4 inline chips + disclosure) |
| Mission tile | 260px declared / 248px rendered | **452px** |
| Mission art | ~177px tall | **323px** tall |
| Hand card | 250px | **230px** |
| Committed card | 192px | **230px** |
| Enemy token | 58px wide, wrapping | **78×109px**, five fixed slots |
| Guidance | ~240px tall block | one 56px status bar row |

## Behaviour that must not change

The engine is rulebook-verified and this is a presentation change. Preserve:

- `useCardSlide` grab-to-slide, `MoveMaquis` click-through on the dimmed half, and the side lock after any
  action is used.
- `DecisionPanel` / `DecisionModal` routing exactly as specified in `docs/DECISION_MODAL_SPEC.md`, including
  the board-multi select path and `boardPickable`.
- `useUiScale` and the Ctrl +/−/0 accelerators; the zoom coordinate-space caveats in `docs/UX_BACKLOG.md`.
- `.defeated-stamp { pointer-events: none }` and `.enemies { z-index: 4 }` — the fix for Anastasio clicking
  through a defeated Mission. The new garrison strip must keep that stacking.
- All `prefers-reduced-motion` fallbacks.
- The Coach beats in `docs/COACH_SPEC.md` target `[data-coach]` attributes on `status`, `controls`,
  `missions`, `hand`, `guide` and the first Mission's `zoom` mark. **Moving these elements will break the
  coach spotlight** — re-point every `data-coach` attribute and re-run `src/ui/coach.test.ts`.

## Assets

No new art required. Existing assets used: `public/tabletop.jpg`, `src/assets/cards/mission/*.jpg`,
`src/assets/cards/maquis/*.jpg`, `src/assets/cards/enemy/*.jpg`, `src/assets/cards/spy/spy.jpg`.
Still outstanding from the project's own list: **the face-down Enemy card back** (Phase 5.3).

## Files in this bundle

| File | Contents |
|---|---|
| `DEFY Design Review.dc.html` | The three frames + 12 findings. Open in a browser; pan and zoom the canvas. |
| `assets/` | The card art and tabletop the mockups reference, copied from the repo. |
