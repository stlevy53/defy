# UX Backlog

Playtest-surfaced UI issues to pick up in a later session. Newest at the top. Each entry: what's
wrong, where it lives, and a suggested fix so the next session can move fast. Fixed entries stay
here under **Resolved**, so the screenshot and the reasoning remain findable.

---

## Open

_(none currently — the next playtest round is what will surface the next entries here)_

---

### Mission Eras are invisible in the UI — evaluate now that real card art has landed

**Largely answered by the Board size setting** (see **Resolved**). The printed era subtitle ("Era 1:
Re-invasion of Spain") is on every Mission image, and at 125–140% it reads at board size — so
"**Nothing**" is now a real option and the cheapest one. What is left to decide is whether the era
should be legible at 100% too, which is the only case an overlay chip would serve; a badge in the
themed-frame branch is moot either way, since every Mission has art.

**The rules are correct — this is presentation only.** Eras are not a mechanic. The rulebook
mentions "Era" in exactly two places: the Mission card anatomy diagram, and setup step 3 ("Sort the
20 Mission cards by the Era… Stack the 3 Mission cards from the second era on top of the 3 from the
third era to form a face-down Mission deck"). There is no era track, no era phase, and no era
trigger — the escalation is delivered entirely by that deck ordering, per the overview's
"increasingly difficult missions". `setup.ts` implements it exactly, and `setup.test.ts` asserts the
row is all Era 1 and the deck is Era 2 over Era 3.

**Why it's worth surfacing.** The stat ramp is real (avg Defense 5.25 → 6.67 → 6.83; avg VP 1.6 →
3.0 → 4.2), and the win table is calibrated around reaching the later eras: four Era-1 missions cap
out around 9 VP even in the best case, while a Minor Victory needs 15 — so a player who never gets
past Era 1 cannot beat a Draw, and Epic Victory (all 10 missions) requires clearing Era 3. A deck
mission only enters the row on a SUCCESS, so era depth equals missions defeated: three successes to
exhaust Era 2, four before the first Era-3 card appears. Measured over 2000 self-played games with
the greedy policy, an Era-2 mission reached the row in 96.7% of games but Era 3 in only 1.1%.

**What's missing today.** Nothing renders a mission's era: `ui/Card.tsx` draws name, keyword,
Defense, VP, Garrison and effect but never era, and neither does `ZoomMissionCard`. The `era` field
is loaded and typed; `eraNames` in `data/missions.json` ("Re-invasion of Spain", "Splintering of the
Maquis", "Hunting the Maquis" — verbatim from the cards) is never exported by `src/data/index.ts`.
The only hint anywhere is the Mission-deck tooltip in the pile rail.

**What to evaluate once art is in.** The physical card prints the era as a small italic subtitle
under the title banner ("Era 1: Re-invasion of Spain"), and mission tiles render ~180px wide, so
that line will likely be a couple of pixels tall — legible in right-click zoom, probably not on the
board. So decide between:
- **Nothing** — if the art reads well enough and zoom is sufficient for fidelity.
- **An overlay chip in the art branch** of the mission face, alongside the modified-Defense pill and
  the Defeated stamp (the existing pattern for "must beat the photo"). This is the only option that
  survives art; a badge in the themed-frame branch would be dropped per card as art lands.
- **Non-card options, unaffected by art either way**: show the Mission deck's remaining era
  composition in the pile rail, and/or explain why pressing on matters (Era-1-only caps you at a
  Draw).

**Related, same evaluation moment.** Effect text is also frame-only, so at board scale art replaces
all readable mission text with pixels. Not era-specific, but the zoom view carries more weight after
art lands than it does now — worth a look at the same time.

---

## Resolved

### A big window didn't pay off — the board was capped at 1260px

**Found:** the packaged `.exe`, confirmed by measurement (see the zoom-140 entry below): removing the
`#root { max-width: 1260px }` cap alone *shrank* the mission tile (249px → 230px at a 1920 window)
because the mission/hand grids used `repeat(auto-fill, minmax(210px, 1fr))`, which spends surplus
width on more columns instead of wider cards.

**Fixed (v0.2.0):** the whole board layout was rebuilt around fixed-height bands — status bar, phase
guidance, a **fixed four-across Mission row** at a readable 452px, committed lanes, hand — instead of
one tall auto-flowing column, so a maximized window shows the whole table with far less scrolling and
extra width goes to genuinely bigger cards rather than more columns or empty tabletop. Each Mission's
garrison is now a **fixed five-slot strip** (constant tile height regardless of enemy count, a "+N"
badge past five) with strike order taught via an accent ring + "Strike 1st/2nd/…" badge. See
`HANDOFF.md`'s v0.2.0 summary and `src/ui/patchNotes.ts` for the full change list.

Whether players still reach for a bigger window, and any layout rough edges the new bands introduce,
is now a question for the next playtest round rather than an open design question.

### Draft setup is in — offer at new game, Settings can turn it off

**Found:** v0.1.6 tester. "Draft doesn't seem to work — it just jumps into the game."

**Fixed:** `createGame({ seed, draft: true })` raises twelve Hidden/Recruit pair picks
(`draftPool` + `pendingDecision` from `draft.pool`). The leftover card flies to the
Recruit pile. A new game asks draft vs skip (after What’s New on a first/new-build
launch); ⚙ Settings → Draft setup turns the prompt off. First-run coach waits until
skip, or until the draft finishes.

### Defeated-stamp overlay blocked clicks on remaining Enemies

**Found:** v0.1.6 playtest. Tester defeated a Mission while Enemies were still standing,
then fired Anastasio. The chips glowed; clicks did nothing.
**Screenshot:** [`ux-backlog/anastasio-defeated-mission-unclickable.png`](./ux-backlog/anastasio-defeated-mission-unclickable.png)
**Fixed:** `.defeated-stamp` is `pointer-events: none`; `.enemies` sits above it
(`z-index: 4`) so leftover Enemies stay clickable for Anastasio, leftover Attack, Paquita,
Consuelo, Adela, etc. Engine was already correct.

### Domingo/Pilar scout kept flipped Enemies face-down until the discard pick

**Found:** v0.1.6 playtest. Domingo's PLAN action highlighted two chips to discard among,
still showing generic backs.
**Screenshot:** [`ux-backlog/domingo-flipped-enemies-still-facedown.png`](./ux-backlog/domingo-flipped-enemies-still-facedown.png)
**Fixed:** `scoutFlipDiscard` (`src/engine/effects/plan.ts`) now sets `faceUp` when the
flip selection resolves, *then* raises the discard decision. Regression in
`effects/plan.test.ts` (Pilar hidden; Domingo shares the handler).

### Undo existed; testers still asked for it during PLAN

**Found:** v0.1.6 playtest. Wanted to rearrange Hidden vs Revealed before activating a
card. Undo already did that — returning v0.1.5 testers skip the coach beat that points
at the button.
**Fixed:** hover tip on the Undo button (`App.tsx`); coach beat 6 copy spells out Hidden
vs Revealed; next What's New mentions it (`PATCH_NOTES.md` Unreleased). PLAN rearrange is
now a first-class move (`MoveMaquis`): click the dimmed half of a played Maquis to switch
Hidden ↔ Revealed without undoing later plays; sides lock after any card action is used.

### Board renders small and text is hard to read — needs a UI scale setting, not fullscreen

**Found:** the packaged `.exe` at v0.1.4, and confirmed rather than relieved by the real card art that
followed — an arted Mission tile is a photograph of a card at ~250px, so its printed era subtitle and
effect text were a few pixels tall and unreadable without right-click zoom.

**Fixed:** a **Board size** row in Settings — 100 / 110 / 125 / 140 / 160% — applying CSS `zoom` to
the root element, persisted in `localStorage` under `defy.uiScale`, with Ctrl +, Ctrl − and Ctrl 0
accelerators that work whether or not Settings is open (`src/ui/useUiScale.ts`). At 140% the printed
mission title, era line and effect text all read at board size.

**Fullscreen / a bigger window was NOT the fix — measured, not assumed.** The board is capped
independently of the window by `#root { max-width: 1260px }` (`src/index.css`). The Electron window
opens at 1440×900 (`electron/main.cjs`), so ~180px was already wasted; maximized on a 1920 monitor the
board still rendered 1260px with the surplus spent on empty tabletop, and the text was no larger.
See [`ux-backlog/board-scale-as-shipped.jpg`](./ux-backlog/board-scale-as-shipped.jpg).

**Removing the cap alone made it slightly worse** — measured at a 1920 window, the mission tile went
from 249px (capped) to 230px (uncapped), because `auto-fill` spends surplus width on more columns.
See [`ux-backlog/board-scale-cap-removed.jpg`](./ux-backlog/board-scale-cap-removed.jpg), and the
still-open entry above for the follow-up.

**Why zoom rather than larger fonts.** Every font size is already in `rem` while the layout widths are
in `px` (the 1260px cap, the 178px rail, the 210px grid minimum), so scaling text alone would overflow
containers that stayed put. Zoom scales cards, type, padding and the rail together and keeps the
proportions identical: [`ux-backlog/board-scale-zoom-140.jpg`](./ux-backlog/board-scale-zoom-140.jpg).

**Three things worth knowing if you touch this.**
- **The overlays needed no changes.** Under CSS `zoom`, `getBoundingClientRect()` returns *unzoomed*
  layout pixels — the same coordinate space a `position: fixed` child is placed in — so the decision
  modal, zoom overlay, toasts and flying cards all land correctly. Verified by placing a fixed probe
  from a measured rect at 100/140/160%: zero offset at every scale. Do not "correct" flight
  coordinates by the zoom factor; that breaks them.
- **Hit-testing is the exception**, and uses *visual* coordinates (rect × zoom). Real mouse input is
  unaffected, but any automation that clicks at rect-derived coordinates will miss at a non-100%
  scale. The Tier-2 harness is safe because it clicks through the DOM (`el.click()`).
- **Electron's application menu is now removed** (`electron/main.cjs`). It was hidden but still live,
  and its default Ctrl +/−/0 accelerators would have driven Electron's own zoom on top of ours,
  scaling the board twice per keypress. In a *browser* the accelerators still double up with the
  browser's page zoom — dev-only, since the shipping target is the `.exe`.

**Tradeoff, as predicted.** Higher scale means more vertical scrolling: measured on a 1497-wide window,
the page grew 144px taller than the viewport at 100% and 897px at 140%. That is why this is a
user-chosen scale rather than a fixed bump.

**Right-click zoom was resized in the same pass**, since it is the fallback whenever a player wants the
exact printed text: `.zoom-art` was a fixed `max-width: 560px`, and is now `min(96vw, 1050px)` by
`min(90vh, 1050px)` — it grows with the window and stops at the 1050px source resolution, past which
there is no more detail to show. Measured: 882×630 at the 1024×700 minimum window, 968×691 at 1366×768,
and 1050×750 from ~1500px wide upward, against the old 560×400 everywhere. The dismiss hint is now
absolutely positioned so it doesn't compete for the height a portrait card needs.

**Also fixed here, because scale exposed it:** hover tooltips (`.tip::after/::before`) were laid out
while hidden, so a 260px bubble on a chip near the window edge stretched the page's scrollable width —
a horizontal scrollbar appeared at 125% and above. They are now `display: none` until hover (with
`transition-behavior: allow-discrete` and `@starting-style` preserving the fade), which removes the
horizontal overflow at every scale. The same latent bug would have appeared in any narrow window.

### Decision modal — order-number badge is clipped at the card corner

**Found:** v0.1.4, reorder decision ("Put the rest back on top in any order").
**Fixed:** padded `.dm-cards` (top/left `0.65rem`) so the badge's 8px corner overhang falls inside
the scroll box. The overhang is kept deliberately — it keeps the badge from reflowing the card's
text as numbers appear and disappear. Verified with `npm run tier2` (seeds 4 and 8 both raise a
reorder decision; badges render as full circles).
**Screenshot:** [`ux-backlog/decision-modal-order-badge-clipped.png`](./ux-backlog/decision-modal-order-badge-clipped.png) (the "1" and "2" badges circled — their top halves are cut off).

**What's wrong.** The order-position badge (`.dm-order`) sits at `top: -8px; left: -8px`, so it
deliberately hangs off the card's top-left corner. But the scrolling card area (`.dm-cards`) has
`overflow-y: auto`, which clips anything outside its box — including the part of the badge that
overhangs the top edge. So the badges on the top row of cards get their top/left cut off.

**Where.** `.dm-order` and `.dm-cards` in `src/index.css`; badge is rendered by `DecisionCard` in
`src/ui/DecisionModal.tsx`.

**Options considered.** Moving the badge inside the card (`top: 4px`) would overlap the card name;
rendering it inline in the `.dm-card-name` row would reflow the text as badges appear. Padding the
scroll container preserves the no-reflow property and touches one declaration.
