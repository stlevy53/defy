# UX Backlog

Playtest-surfaced UI issues to pick up in a later session. Newest at the top. Each entry: what's
wrong, where it lives, and a suggested fix so the next session can move fast. Fixed entries stay
here under **Resolved**, so the screenshot and the reasoning remain findable.

---

## Open

_(none currently — playtest of the v0.2.0 bands on 2026-08-25 found one click-blocker, now Resolved.)_

---

## Resolved

### “Done attacking” sat under the sticky status bar

**Found:** 2026-08-25 playtest, seed 2117291164, ATTACK. After striking a Grunt the page had scrolled
~135px (the click helper brought the chip toward the top). “Done attacking” was at y=28, inside the
48px sticky `.topbar` (z-index 50). The click landed on the header: *Click target intercepted by
`<header class="topbar">`*. Same shape for Continue at AFTERMATH.

**Where.** `.topbar` was `position: sticky` alone. `.turn-row` (the pulsing chip) and `.phase-guide`
scrolled in normal flow, so they tucked under the header.

**Fixed:** wrap status + guidance + event line + turn-row in `.board-chrome` and stick *that*. The
status bar is just a row inside the chrome. Coach stage clamp also moved from the deleted
`.board-main` to `#root`.

### Mission Eras are invisible in the UI

**Found:** after real card art landed, Mission tiles drew name/keyword/Defense/VP/Garrison but never
era. The printed subtitle ("Era 1: Re-invasion of Spain") was a few pixels tall at the old ~250px
tile size. Eras are not a mechanic — they only order the Mission deck — but they matter for scoring:
four Era-1 missions cap around 9 VP, and a Minor Victory needs 15.

**Fixed (v0.1.9 / v0.2.0):** v0.1.9 put an Era chip on the tile. v0.2.0's 452px Mission row makes the
printed era line on the photo readable at board size, so the arted branch dropped a separate era
plate (it's already under the name banner on the card). The themed-frame fallback still prints
`eraLabel`. Failed (face-down) Missions show the printed back, no era.

The evaluation write-up (stat ramp, Era-3 rarity under greedy self-play, overlay vs nothing) lived
here while art was landing; the decision was **nothing extra on the photo**, plus the overlay stats
rail for Defense/VP/Garrison/keyword.

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

**Fixed:** a **Board size** row in Settings — 75 / 90 / 100 / 110 / 125 / 140% (75% and 90% added for
laptop screens and 160% removed in v0.2.1) — applying CSS `zoom` to
the root element, persisted in `localStorage` under `defy.uiScale`, with Ctrl +, Ctrl − and Ctrl 0
accelerators that work whether or not Settings is open (`src/ui/useUiScale.ts`). At 140% the printed
mission title, era line and effect text all read at board size; at 75–90% the whole table fits a smaller screen.

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
  from a measured rect at 100/125/140%: zero offset at every scale. Do not "correct" flight
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
