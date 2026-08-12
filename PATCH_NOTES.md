# Resist! (DEFY!) — Patch Notes

Player-facing changelog for the *Resist!* prototype. **Newest at the top.** Every time we update the portable prototype, add an entry here.

Versions use `v0.MINOR.PATCH`. The prototype ships as a portable Windows build (no install, no dev server) on top of the headless rules engine. For engineering detail and the session bootstrap, see `HANDOFF.md`.

---

## Unreleased

_Work in progress toward the next version — add changes here as we make them, then stamp a version + date when we cut a release._

---

## v0.1.5 — 2026-08-12

The real cards, at a size you can read.

- **Real card art is in.** Every card now shows its actual printed face — all 24 Maquis, 20 Missions, 8 Enemy types, 8 Civilians and the Spy — on the board, in your hand, in the choice window and in right-click zoom. The themed text frames it replaces remain as the fallback for any card without an image. The one thing still drawn as a plain chip is a face-down Enemy, since there's no photo of a card back yet.
- **Board size** — a new setting under ⚙ Settings scales the whole table: 100%, 110%, 125%, 140% or 160%. At the larger sizes the printed card text — mission titles, era lines, effect text — reads without right-click zoom. **Ctrl +** and **Ctrl −** adjust it any time, **Ctrl 0** returns to 100%, and your choice is remembered between sessions. Bigger cards mean more scrolling, so pick what suits your screen.
- **Right-click zoom is much bigger** — the enlarged card now grows to fit your window (up to the full resolution of the card photo) instead of a fixed size, so the printed text is far easier to read: roughly double the area on a 1080p screen, and still noticeably larger on a small laptop.
- **The window remembers itself** — the app now opens maximized on first run and reopens at whatever size and position you left it, instead of a fixed 1440×900 every launch. Pairs with Board size: a larger board needs the extra room.
- **Fix** — the Spy card is no longer sideways: it sits in your hand in landscape, matching the Maquis cards.
- **Fix** — the board no longer scrolls sideways (a hidden tooltip was stretching the page).
- **Fix** — in the decision window, the order-position badges ("1", "2", …) on the top row of cards are no longer clipped at their corner.

---

## v0.1.4 — 2026-07-30

A card window for choices, plus UI polish.

- **Decision window** — a choice that pulls cards from a pile (pick from the Revealed pile, peek at the top of a deck, reorder cards) now opens a modal that shows the real cards full-size, with a Maquis's Hidden and Revealed sides side by side (matching the physical card and the eventual art), instead of a list of names. The card grid is a responsive 2–3-per-row layout with a pinned prompt and Confirm bar, so a large pile scrolls the cards without burying the button. Board-anchored picks (Missions, on-board Enemies, played/hand Maquis) are unchanged — still clicked in place. See `docs/DECISION_MODAL_SPEC.md`. UI only; the engine is unchanged (regression corpus shows no behavioral change).
- **Reorder keeps the current order by default** — the cards open already in the deck's current order, so "Keep this order" confirms in one click; you only re-sequence if you want to.
- **"What's New" shows once per build**, not on every launch — the last-seen version is remembered in `localStorage`; reopen it any time from the version button.
- **Log toasts moved to the bottom-left** and made fully non-blocking, so they no longer cover the deck/pile rail on the right or sit over a clickable card.
- **Failed-Missions indicator** now shows the threshold — e.g. `✗ 1 / 2 failed` — so you can see how close the resistance is to collapse.

---

## v0.1.3 — 2026-07-27

Save & load, settings, and clearer choices.

- **Settings menu** — a new ⚙ cog in the top bar (or the **Esc** key) opens a settings modal holding **New game**, **Save game**, and **Load game**. It's the future home for sound/volume options.
- **Save & load** — the whole game (including a half-answered decision and the full undo history) serializes to `localStorage`, so you can stop mid-round and resume later; persists across sessions in both the browser and the packaged `.exe`. Saves are version-stamped, and a very long game that would exceed the storage quota falls back to saving just the current position (undo history trimmed) rather than failing.
- **Board multi-select** — decisions that pick several on-board cards (Paquita's "discard 2 Enemies", Juana's "flip 1–2 face-down Enemies") are now answered by clicking the Enemies on the Mission; the turn tile shows a live count + Confirm / Select all / Clear instead of listing chips.
- **Persistent pick highlight** — any card that's a valid decision target (Missions, Enemies, played and hand Maquis) now shows a persistent pulsing highlight (not just on hover), so "click a highlighted card" is literally true.
- **Action-granted Attack shows on the card** — attack an action adds (Consuelo's "gain the Enemy's Defense", plus Marcelino/Soledad/Abel's count bonuses) is attributed to the acting Maquis and displayed on its card with a "+N", matching the Attack Strength total. The count-based preview badge now shows only before the action is used.
- **Log toasts** — freshly-appended log lines surface as transient, self-dismissing toasts (bottom-right), so you can see what an action did without opening the Log.
- **Seed-from-Settings** — the "start a game from a specific seed" entry moved into the Settings menu (under New game); the top bar keeps a single click-to-copy seed indicator.
- **Top-bar cleanup** — removed the redundant PLAN/ATTACK phase tag (the phase breadcrumb already shows it) and the standalone New game button (now in Settings).
- **Fix** — tooltips are no longer hidden behind the sticky top bar (raised above it in the stacking order).

## v0.1.2 — 2026-07-26

End-game moments and table clarity.

- **What's New on launch** — a dismissible modal now greets you when the prototype opens, summarizing what changed since the previous build. (Standard on every prototype build going forward; reopen it any time from the version button in the top bar.)
- **End-of-game overlays** — win (with the scored tier) and loss now show a modal moment with **Play Again**, instead of a quiet banner.
- **Card zoom** — right-click a card to see it up close.
- **Sticky top bar** — round/phase/score status and the Undo / New game controls stay in reach while you scroll the board.
- **Card-pile rail** — a right-side rail summarizing the decks and piles.
- **Card-flight animations** — when a card leaves your hand to a pile (a discard) or is drawn from a pile into your hand, a card token flies between the two. Discard-then-draw effects (Antonio's spy swap, etc.) now read visually instead of looking like nothing happened; also fires on the Recover reshuffle/redraw. Skips new-game and undo so cards never fly spuriously.
- **Pick hidden Enemies on the board** — effects that discard "an Enemy from another Mission" (e.g. Railroad Bridge) are now resolved by clicking the Enemy on its Mission, so you always know which Mission you're hitting. Face-down Enemies keep their identity concealed — the old choice panel used to list every candidate's name + Defense, which let you peek at hidden garrisons; that leak is gone.
- **Log clarity** — the game log now spells out spy discard/draw swaps (e.g. "discarded a Spy — but drew another Spy from the Hidden deck"), and every Hidden-deck draw action (Sagrario, Carlos, Nicolás, Ricardo, Manuela) logs how many cards it drew — including a short draw when the Hidden deck **and** its discard are exhausted (e.g. "Sagrario drew only 1 card of 2 — the Hidden deck and discard ran out"). This explains the not-obvious rule that draws come up short only when both piles are empty, which happens sooner than expected because Maquis played *revealed* leave the Hidden pool for good.
- **Fix** — the reinforcement animation no longer misfires when you start a new game.
- Audio is noted as planned (not in yet).

## v0.1.1 — 2026-07-25

Visual identity, packaging, and readability.

- **Themed wooden tabletop** background.
- **Card-art seam + slicing pipeline** — real card artwork can now drop in over the text cards without touching the engine.
- **Attack Strength feedback** — changes to your Attack Strength are surfaced as you play, including count-based bonuses (e.g. "+1 per revealed Maquis").
- **Reinforcements** — enemies added to a Mission animate in; Missions show a live Garrison count; the Recover phase notes how many cards you'll draw.
- **Decision UX polish** across the choice prompts.
- **Portable Windows build** — packaged as a standalone `.exe` (Electron); the prototype now runs without a dev server.
- **Fixes** — Juana's deck-reshuffle behavior; Sagrario and Ramona's ATTACK "draw" actions were silently doing nothing and now fire correctly.

## v0.1.0 — 2026-07-24 — First playable prototype

The first end-to-end playable build: a React interface over the completed rules engine.

- **Play a full game** start to finish — PLAN → ATTACK → AFTERMATH → RECOVER — with the win tiers and all three loss conditions.
- **Direct card interaction** — play, use, and choose by clicking the card itself; strike targets by clicking them on the board.
- **New-player guidance** — a round-phase breadcrumb with per-phase coaching and sub-step-aware prompts.
- **Tooltips** explaining card icons, stats, and each Maquis's inline action text.
- **Undo** and **New game**, with seeded (reproducible) games.
- **Fix** — enemy Defense resets to its printed value when the Enemy deck reshuffles (Benigno/Engineer/Mayor modifiers no longer leak between rounds).
- **Foundation** — runs on the complete, rulebook-verified engine: all 24 Maquis + 20 Mission + 8 Enemy effects, the full round loop, and an acceptance test that replays the rulebook's worked first turn (pp. 11–13) exactly.

---

_Conventions: keep entries player-facing where possible; tag purely technical changes as **Fix** or **Under the hood**. When cutting a release, move the Unreleased items under a new `## vX.Y.Z — YYYY-MM-DD` heading._

_**In-app sync:** the launch "What's New" modal reads `src/ui/patchNotes.ts`. On every release, prepend the same version entry there (newest first) so testers see the current notes on open. That file drives `APP_VERSION` and the modal; this doc is the full human-readable history._
