# Decision Modal — Spec

**Status:** approved for build · **Build target:** v0.1.4 · **Owner:** DEFY! · **Area:** UI (`src/ui`)

## Problem

When a card effect asks the player to choose from cards that aren't on the table — pick a card from
the Revealed pile, look at the top three of a deck and keep/reorder them, discard N from a pile —
the current `DecisionPanel` renders those candidates as a row of **name-only text buttons**
(`Emilio`, `Benigno`, `Roberto`…). To choose well the player must already know each card's attack
and effect. A hover tooltip was added as a stopgap, but hover is undiscoverable, slow, and useless
when the player needs to *compare* several candidates or *sequence* them. Reorder decisions suffer
most: "look at the top 3, put them back in any order" needs room the inline tile doesn't have.

Board-anchored decisions do **not** have this problem: choosing a Mission, an Enemy on a Mission, or
one of your played/hand Maquis is already answered by clicking the glowing card in place, with full
board context. That interaction is good and stays.

## Goal

Any decision whose candidates are **not already visible on the table** is presented in a modal that
shows the real cards at readable size, forces the player to see the action they must take, and lets
them select/confirm (or sequence) directly. Replace the name-only chip list for these cases; keep
the tooltip only as an extra nicety.

## Non-goals

- No change to board-anchored picks (Missions, on-board Enemies, played/hand Maquis). Those keep the
  in-place glow-and-click idiom; moving them into a modal would hide the board context the choice
  depends on.
- No engine or rules changes. The engine already emits `pendingDecision` and consumes
  `resolveDecision(selection)`; this is a pure presentation-layer change.
- Not adding new card art. The modal renders the same text-first card faces (with the existing art
  seam) and improves automatically when art lands.

## Design principle — the routing rule

> If the candidate cards are already on the table, pick them there. If they come from a hidden or
> off-board pile, a window shows them to you.

One rule a player learns in a single game. Implemented against the existing `boardPickable(state,
uid)` helper (true for a Mission slot, an on-board Enemy, a played Maquis, or a hand card).

## Scope — routing by decision kind

Let `offBoard = candidates.filter(uid => !boardPickable(state, uid))` and
`allOffBoard = candidates.length > 0 && offBoard.length === candidates.length`.

| Decision kind | Condition | Presentation |
|---|---|---|
| `selectTarget` | all candidates on board | **unchanged** — click the glowing card on the board |
| `selectTarget` | `allOffBoard` (deck peek, Revealed pile, etc.) | **modal** — full cards, pick one |
| `selectCards` (min=max=1) | all on board | **unchanged** — board click |
| `selectCards` (min=max=1) | `allOffBoard` | **modal** — pick one |
| `selectCards` (max>1) | all on board (`boardMulti`) | **unchanged** — toggle on the board + confirm bar |
| `selectCards` (max>1) | `allOffBoard` | **modal** — toggle N, confirm |
| `orderCards` | (always off-board deck peeks) | **modal** — click to sequence, confirm |
| `chooseOption` | (abstract options, not cards) | **modal** — large option buttons |
| any of the above | mixed on/off-board candidates (rare) | **fallback** — current inline panel (unchanged) |

Forced decisions with no real choice are already auto-resolved by `settle`/`forcedSelection` in
`useGame`, so the modal only ever appears for genuine choices — no modal spam.

## Modal behavior

**Forcing.** The modal is not dismissable (a pending decision is mandatory). No close/X, Escape is
ignored. This is intentional — it makes the required action unmissable.

**Card faces.** Each candidate renders as a full, readable card via a new read-only `DecisionCard`,
classified from state:
- **Maquis** — name + both sides shown **side by side** (Hidden left, Revealed right), each with its
  attack value and action text. A pile card can be played either side later, so both are shown; the
  side-by-side layout matches the physical card and the eventual landscape art. Columns use
  `min-width: 0` so text wraps instead of clipping, and the Maquis card is wider than the others to
  hold two columns.
- **Spy** — "Spy — cannot be played; clogs your hand until Recover."
- **Enemy** — name, Defense, keyword (Grunt/Guard/…), effect text (single-faced).
- **Mission** — name, Defense / VP / Garrison, effect text (single-faced).
- Art vs. text is **either/or**, exactly as the board's card renderer: when a `cardArt` image exists
  it IS the face (a Maquis image already carries the name + both halves side by side), and the text
  face is only the fallback until art lands. Both are never shown together.

**Reorder default.** An `orderCards` decision opens with the cards already in the order shown (the
deck's current order), so a player who is happy with it confirms in one click ("Keep this order")
and is never forced to re-sequence. Clicking a placed card pulls it out; clicking cards in sequence
sets a custom order; "Reset to shown order" reverts.

**Selection + confirm.**
- Single-pick (`selectTarget`, `selectCards` 1/1): click a card to select it (highlight); **Confirm**
  commits. Enter confirms when a selection exists.
- Multi-pick (`selectCards` max>1): click to toggle up to `max`; a live `n/max` count; **Confirm**
  enabled once `min ≤ n ≤ max`; **Select all** (when `max ≥ candidates`) and **Clear** helpers.
- Reorder (`orderCards`): click cards in sequence; each shows its 1-based position badge; click a
  placed card to remove it; **Confirm order** enabled when all placed; **Reset**.
- Options (`chooseOption`): each option is a large button; clicking commits.

**Prompt.** The decision's `prompt` is the modal title, with a `(choose N)` / `(first = top)` hint
where relevant — same copy the inline panel uses today.

**Layout.** Centered overlay over a dimmed board (same overlay language as What's New / Settings).
Candidate cards in a responsive wrap-grid; scrolls if a pile peek is large (up to ~12 cards). Min
1024×700 window (the app's floor) must fit a 12-card grid without clipping the Confirm row.

## Unchanged

Board picks, `SelectCardsOnBoard`, the `boardMulti` toggle flow, the forced-decision auto-resolve,
and every engine behavior. The inline `DecisionPanel` remains for the board and mixed-candidate
fallback cases.

## Engine impact

None. New/changed files are UI only: `src/ui/DecisionModal.tsx` (new), `src/ui/DecisionPanel.tsx`
(route off-board kinds out), `src/ui/App.tsx` (render the modal, suppress the inline panel when the
modal owns the decision), `src/ui/format.ts` (export a `classifyCandidate` helper), `src/index.css`
(modal styles).

## Verification

1. `tsc --noEmit` + `npm run build` clean.
2. `npm test` green — proves engine + hook untouched.
3. `npm run fuzz` and `npm run regress` — the regression baseline must show **no behavioral change**
   (the modal changes presentation, not decisions), which confirms the engine path is identical.
4. Tier-2 live pass on the seeds that raise these decisions (Juana Revealed-pile pick, Roberto/Juana
   top-3 peeks, reorder effects): screenshot the modal, confirm full cards render and the same
   selections resolve. The DOM-vs-state check confirms the chosen selection matches engine state.

## Risks & edge cases

- **Mixed on/off-board candidates** — routed to the existing inline panel (no regression); revisit
  only if such a decision actually exists in the card set.
- **Multi-stage decisions** — the modal is keyed on `decision.prompt` (as the panel is today), so
  each stage re-mounts with a fresh selection.
- **Empty candidate set with min 0** — auto-resolved by `settle`; never reaches the modal.
- **Large peeks** — grid scrolls; Confirm row stays pinned.
