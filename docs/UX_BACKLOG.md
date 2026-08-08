# UX Backlog

Playtest-surfaced UI issues to pick up in a later session. Newest at the top. Each entry: what's
wrong, where it lives, and a suggested fix so the next session can move fast. Fixed entries stay
here under **Resolved**, so the screenshot and the reasoning remain findable.

---

## Open

_Nothing open._

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
