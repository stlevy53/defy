# Resist! (DEFY!) — Patch Notes

Player-facing changelog for the *Resist!* prototype. **Newest at the top.** Every time we update the portable prototype, add an entry here.

Versions use `v0.MINOR.PATCH`. The prototype ships as a portable Windows build (no install, no dev server) on top of the headless rules engine. For engineering detail and the session bootstrap, see `HANDOFF.md`.

---

## Unreleased

---

## v0.2.1 — 2026-08-25

Your profile, your stats, and a table that fits.

- **Player profile & stats** — a new Profile tab under ⚙ Settings. Set a display name and track your games over time: best score, average, win rate, a score-per-game chart, personal records, and full history. Export, import, or clear your data any time. Stored locally for now (Steam profiles come later).
- **Committed lanes no longer scroll** — played Maquis lay out up to four across each Hidden / Revealed row; a fifth card wraps to a second row whose top edge peeks so you know there's more, and you scroll only that lane to see it. No more scrubbing a tiny strip.
- **Board size** — added 75% and 90% for laptop screens and dropped 160%. The steps are now 75 / 90 / 100 / 110 / 125 / 140%, still adjustable with **Ctrl + / − / 0**.
- **More table space** — trimmed the empty band under the phase guidance so the play area gets the room.
- **Round** — the status bar now shows which round you're on.
- **To clear** — during ATTACK, the Attack Strength token also shows the remaining Defense of the Mission plus standing Enemies, as one total. It drops as targets fall. (You still spend per target — this is a planning number.)
- **Bunker** — the discard is always a Maquis, never a Spy. If your hand has no Maquis left, the event line says so instead of doing nothing. The last Maquis in hand waits for a click rather than vanishing on its own.
- **Emilio** — Hidden Emilio only offers Copy when another hidden Maquis can actually complete its hidden action (so copying Antonio with no Spy in hand no longer spends the card for nothing). After any Use, the dimmed half of a committed card explains that sides are locked — Undo that Use to rearrange.
- **Use** — the gold action bar under a played Maquis is a larger click target. Clicking the card itself also fires the action when it is legal (drag still rearranges during PLAN).
- **Sound** — cue files now start loading when the app opens, so the first card flip or gunshot isn't waiting on decode. (A click is still required before anything actually plays — that's the browser, not a stall.) The Settings sound section drops its long description.
- **Fix** — “Done attacking” / “Continue” stay clickable after you scroll. They were sliding under the sticky status bar.

---

## v0.2.0 — 2026-08-25

A board that fits the window.

- **Board rebuild** — the layout is now fixed-height bands (status bar, phase guidance, Missions, committed lanes, hand) instead of one tall scrolling column, so a maximized window shows the whole table with far less scrolling. Missions sit in a fixed four-across row at a readable 452px, with era/keyword/Defense/VP/Garrison overlaid on the art; attacking one dims and outlines the other three.
- **Garrison strips** — a Mission's garrison is a fixed five-slot strip: constant tile height regardless of count, empty slots read as empty, and a Mission reinforced past five (Radio Operator, the Barracks) shows a "+N" instead of silently growing or hiding an Enemy. Strike order is taught before you click — a legal target gets an accent ring and "Strike 1st/2nd/…" badge; a target still gated by Grunts shows the same ordinal, quieter.
- **Enemy card back** — a face-down Enemy now shows its real printed card back instead of a placeholder.
- **One Attack Strength number** — was a top-bar pill and a turn-tile meter showing the same figure twice. It now lives once, at the seam between your committed lanes and the board, and floats the exact cost on both itself and the struck target when you spend it.
- **One event line** — the latest thing that happened shows as a single pill under the status bar, and no longer repeats what already animates on the board (a struck target, a reinforced Mission, a defeated Mission's stamp). Replaces the old bottom-left toast stack.
- **Hover-peek** — point at a hand or committed card to read both its Hidden and Revealed action text without right-clicking to zoom.
- **Floating decision bar** — a decision that asks you to click cards on the board (discard one, flip one, etc.) keeps its prompt and Confirm button pinned to the bottom of the window, so scrolling to see the board never loses track of what you're choosing.
- **Calmer turn area** — phase guidance sits in its own line under the status bar again; the "Done attacking" / "Continue" button pulses so it's clear what to click next; a card's foot bar always names the actual action (no more a PLAN action reading "ATTACK", or a never-used card claiming "USED IN PLAN").
- **Fix** — the "?" phase-help popover works again (an earlier layout change was silently clipping it).
- **Fix** — the event pill no longer repeats a Mission's success/failure, a 5-civilians-lost or all-Spy-hand loss, or an END-of-round line — each of those is already stated by the on-card stamp or the win/loss overlay that follows it.

---

## v0.1.9 — 2026-08-18

The table makes a sound.

- **Sound** — card flip when anything moves on the table; gunshot when you defeat an Enemy; knife when a Spy leaves; explosion when you destroy a Mission. End-game stingers: defeat, draw, victory, major victory, overwhelming (epic) victory. Mute and volume live under ⚙ Settings (Esc). The How to play tour uses the same card flip on Next, Skip, and Start playing.
- **Fix** — the gunshot on an Enemy now starts on the crack (trimmed the lead-in) so it lands with the click.
- **Fix** — right-click zoom works on cards in the Revealed-pile (and other off-board) picker, same as the table.
- **Fix** — the How to play tour stays on the table. The last tip no longer slides off the right edge, so Skip / Start playing stay clickable.
- **Fix** — Undo after a targeting action (Anastasio discarding an Enemy, and the same shape of pick) takes back the whole action, so the card can be used again and other Maquis actions stay available.
- **Missions** — each Mission shows its printed era (Era 1 / 2 / 3) on the tile, so the starting row is readable as Era 1 at board size.

---

## v0.1.8 — 2026-08-18

You can’t un-see Enemies.

- **Undo** — revealing Enemies cannot be undone: a scout during PLAN, or choosing a Mission, once those Enemies are face-up. You can still undo plays after that.
- **Missions** — the “Click to attack” cue sits at the top of the card, so it no longer covers the Enemies underneath.
- **Fix** — Recon the Mountain Pass now asks which Mission to flip after you defeat it. It no longer auto-picks, and it will not silently flip this Mission after its garrison is already revealed.

---

## v0.1.7 — 2026-08-14

Draft your Maquis, and a clearer table.

- **Draft setup** — a new game asks whether to draft your Maquis (the rulebook’s recommended start) or skip into a random deal. Draft shows two cards at a time: click the one for Hidden; the other flies to Recruit. Twelve picks, then you play. The prompt stays on later games; turn it off under ⚙ Settings → Draft setup. A first-time player still gets What’s New, then this prompt, then the table tour if they skip (or after the draft if they don’t).
- **Played Maquis** — Hidden / Revealed pills on the card face are gone (the section titles already say that). The Use control sits under the card as a small button, so it no longer covers the printed name or action text.
- **Fix** — a first-time launch now shows What’s New, then starts the table tour automatically when that window closes. (v0.1.6 showed What’s New and then dropped you on the board.)
- **Fix** — after you defeat a Mission, you can still click the Enemies left on it (Anastasio’s discard, leftover Attack Strength, and the rest). The Defeated stamp no longer sits on top of those clicks.
- **Fix** — Domingo and Pilar’s PLAN scout now flips the Enemies face-up *before* asking which one to discard, so you can see what you’re choosing.
- **PLAN rearrange** — drag a played Maquis onto Hidden or Revealed to move it, or click the dimmed half. You can do this to any card you’ve already played, without undoing later plays. It locks as soon as anyone uses a card action.
- **Drag to play** — grab a card from your hand and slide it onto Hidden or Revealed. Clicking a half still works if you prefer.
- **Undo** — the Undo button in the top bar takes back the last play. Hover it for a reminder. (It was always there; returning players who skipped the table tour often missed it.)

---

## v0.1.6 — 2026-08-13

How the table works — a short tour for new players.

- **First-run coach** — six short tips that point at the table: Hidden/Revealed halves on your hand, right-click zoom, clicking Missions, the phase tile, how a game ends, and Undo / Settings. Shown once the first time you ever launch; skip any time. If you already played v0.1.5 you will not be walked through it — replay it any time from ⚙ Settings → **How to play this table**.
- **Fix** — while the tour is up, scrolling no longer slides the highlighted region out of the spotlight.

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
