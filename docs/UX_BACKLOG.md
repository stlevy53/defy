# UX Backlog

Playtest-surfaced UI issues to pick up in a later session. Newest at the top. Each entry: what's
wrong, where it lives, and a suggested fix so the next session can move fast. Fixed entries stay
here under **Resolved**, so the screenshot and the reasoning remain findable.

---

## Open

### Board renders small and text is hard to read — needs a UI scale setting, not fullscreen

**Deferred to the card-art pass**, since art is rendered at whatever size the tile is, so scale and
art should be judged together. Found in the packaged `.exe` at v0.1.4.

**Fullscreen / a bigger window is NOT the fix — measured, not assumed.** The board is capped
independently of the window by `#root { max-width: 1260px }` (`src/index.css`). The Electron window
opens at 1440×900 (`electron/main.cjs`), so ~180px is already wasted; maximized on a 1920 monitor the
board still renders 1260px with the surplus spent on empty tabletop, and the text is no larger.
See [`ux-backlog/board-scale-as-shipped.jpg`](./ux-backlog/board-scale-as-shipped.jpg).

**Removing the cap alone makes it slightly worse.** The mission row and hand use
`repeat(auto-fill, minmax(210px, 1fr))`, and `auto-fill` spends surplus width on *more columns*
rather than wider cards. Measured at a 1920 window: mission tile went from 249px (capped) to **230px**
(uncapped), with the cards bunched at the left and a large empty gap.
See [`ux-backlog/board-scale-cap-removed.jpg`](./ux-backlog/board-scale-cap-removed.jpg).

**What works is UI zoom**, which scales text, cards, padding and the rail together and keeps the
layout proportions identical. At 1.4× on the same 1920 window the mission tile measured 305px and
everything was comfortably readable: [`ux-backlog/board-scale-zoom-140.jpg`](./ux-backlog/board-scale-zoom-140.jpg).
Zoom (rather than bumping font sizes) is the right mechanism because every font size is already in
`rem` while the layout widths are in `px` (the 1260px cap, the 178px rail, the 210px grid minimum) —
scaling text alone would overflow containers that stayed put.

**Suggested implementation, in order of payoff.**
1. **UI scale setting** — a row in `ui/SettingsMenu.tsx` (already the intended home for options like
   this) applying `document.documentElement.style.zoom` and persisting to `localStorage` alongside
   the save data, plus Ctrl+= / Ctrl+− accelerators. Renderer-only: no preload or IPC, and it behaves
   identically in the browser and the packaged `.exe`. Verify the fixed-position overlays (decision
   modal, zoom overlay, toasts, flying cards) still position correctly under a non-1 zoom.
2. **Let a big window pay off** — raise the `#root` cap and change those grids so extra width makes
   cards bigger instead of adding empty columns. Compounds with zoom on a 2560-wide monitor.
3. **Window behaviour** — `electron/main.cjs` has no maximize, no fullscreen, and doesn't remember
   size or position, so every launch is 1440×900. Open maximized + persist window state; fullscreen
   is then a nice-to-have rather than the fix.

**Tradeoff to expect.** Higher zoom means more vertical scrolling (at 1.4× on 1920 the hand row
starts to clip), which is why this should be a user-chosen scale rather than a fixed bump.

---

### Mission Eras are invisible in the UI — evaluate after real card art lands

**Deferred on purpose.** Blocked on the card-art reshoot: how (or whether) to surface the Era
depends on how the real card reads on screen at board size, which we can't judge from the themed
frames. Do not implement before art is in.

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
