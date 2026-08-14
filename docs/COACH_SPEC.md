# First-run coach — Spec (v0.1.6)

**Status:** approved · shipping in v0.1.6; first-launch sequence updated for next build (What’s New, then coach) · **Build target:** v0.1.6+ · **Owner:** DEFY! · **Area:** UI (`src/ui`)

A short, skippable spotlight tour of the *table*, for people who have never played this port. It
teaches how to click the board. It does not teach Resist! as a board game.

## Problem

v0.1.5 is a complete, arted table that friends are already playing. A new player landing on that
table still has to discover several interactions that the UI does not advertise:

- Hand Maquis are a photograph. The Hidden / Revealed play halves are invisible until hover
  (`Play Hidden` / `Play Revealed` labels are `opacity: 0` until the cursor is over a half).
- Right-click zoom is the way to read printed effect text at board size, and nothing on the table
  says so.
- Turn buttons and decisions live in the right half of the phase tile, not in a menu.
- Spies look like broken cards (no play halves).
- How you lose is split across a VP pill, a failed-Missions pill that only appears after the first
  failure, and a Graveyard count on the pile rail that uses a native `title` tooltip.

The game already has a lot of help that we should **not** duplicate: the phase tile's "what to do
now" line, pulsing pick-targets, CSS hover tips on icons / keywords / stats, log toasts, and
What's New for returning testers. A tooltip overlay on top of that would be noise.

## Goal

On a player's **first launch of a build**, show What's New, then walk the live table in about six
short beats when that modal closes (if the coach has never been finished). Each beat points at one
region and says one thing. Skip is always available. After that, the phase tile is the teacher.
Returning players who already finished the coach keep What's New as it works today; they can replay
the tour from Settings.

## Non-goals

- **Not a rulebook.** No era track, no win-table lecture, no DEFEND / DEFEAT / SURVIVE primer
  (those already have hover tips), no "fire count-based Attack last" coaching (the live `⚔ +N`
  badge already says that).
- **Not more hover tooltips.** The existing `Tip` component stays as-is. The coach is a spotlight,
  not a bubble on every icon.
- **Not a scripted first game.** The engine is not paused, rewound, or given a special deal. The
  board underneath is the real opening hand. The overlay blocks clicks on the table so the player
  cannot play *through* the tour; they are looking, not taking a turn.
- **Not sound.** Mute / volume / stingers stay a later build. Settings can keep its "coming later"
  footnote.
- **Not the leftover UX backlog.** Big-window board cap, era chips, the face-down Enemy back, and
  draft setup are out of this version.

## Design principle

> Point at the control. Say how to use it. Get out of the way.

One rule a player should take from the tour: **click the thing on the table.** The phase tile will
keep telling them *which* thing, every round.

## Who sees it, and when

Four launch states. Persistence is `localStorage`, same family as What's New and Board size.

| Player | How we know | First thing they see |
|---|---|---|
| **First ever** | no `defy.coachSeen` **and** no `defy.whatsNewSeen` | What's New, then the coach when it closes |
| **Returning, coach never finished** | `defy.whatsNewSeen` set, no `defy.coachSeen` | What's New if this build is new, then the coach; or the coach immediately if notes were already dismissed |
| **Returning, coach finished, new build** | `defy.coachSeen` set, `defy.whatsNewSeen` ≠ this version | What's New only |
| **Returning, same build** | both keys match this session | the board |

Completing or skipping the coach writes `defy.coachSeen = 1`. What's New writes `defy.whatsNewSeen =
APP_VERSION` when dismissed. Closing What's New **starts the coach** when `defy.coachSeen` is not
set — including a first-ever player, and a v0.1.5 tester who has never taken the tour.

Reopening What's New from the version button does **not** restart the coach once it has been
finished or skipped.

**Replay.** Settings gains a "How to play this table" item that runs the same tour. Replay does not
clear What's New. A first-ever player who skipped can replay later the same way.

**Don't start the coach when** an end-game overlay, Settings, What's New, the decision modal, or
card zoom is already up. Replay from Settings closes Settings first, then starts the tour.

## The beats

Six beats, in play order. Copy is a target, not final — keep each body to two or three short
sentences. A persistent footer on every beat: **Next** (last beat: **Start playing**) and **Skip**.

A one-line kicker on beat 1 only: *Welcome to Resist. Six short tips, then you play.*

### 1. Your hand — Hidden and Revealed

**Spotlight:** the hand strip (`section.hand`).

**Teach:**

- Each Maquis is two sides of one card. **Left half = Hidden. Right half = Revealed.** Hover a half
  to see `Play Hidden` / `Play Revealed`, then click to play that side.
- Hidden cards can come back through the deck. Revealed cards leave the Hidden deck for good (they
  sit in the Revealed pile).
- A **Spy** has no halves to click. It stays in your hand until Recover. An all-Spy hand is a loss.

**Don't teach here:** PLAN vs ATTACK action types, individual Maquis effects, the Recruit deck.

**Why this is beat 1.** With real art, this is the least discoverable control on the table, and it
is the first thing the phase tile asks them to do.

### 2. Right-click to read a card

**Spotlight:** one face-up card — prefer a Mission in the row (printed effect text is the reason
zoom exists). If the row is somehow empty, fall back to a hand Maquis.

**Teach:**

- **Right-click any face-up card** to see it full-size. Click or Esc closes it.
- The table shows the photograph; zoom is how you read the printed text (effects, era line, the
  other side of a Maquis).
- Face-down Enemies stay hidden — they have no zoom, on purpose.

**Don't teach here:** Board size / Ctrl +/− (that's beat 6). Don't invite them to actually
right-click during the tour unless it is cheap; telling them is enough for v0.1.6.

### 3. Missions — click the card, not a menu

**Spotlight:** the mission row (`section.missions`).

**Teach:**

- These four Missions are what you can attack. In PLAN, **click a Mission** to choose it (that
  ends PLAN and reveals its Enemies).
- In ATTACK, **click a glowing Enemy or the Mission** to strike it. The glow means "this is a
  legal click."
- After a Maquis is on the table, a **Use** ribbon appears on it when its action can fire — click
  the ribbon, not a list of buttons.

**Don't teach here:** Guard / Grunt targeting order (the phase tile covers it when it matters),
garrison vs defense vs VP iconography (hover tips already exist).

### 4. The phase tile — what to do now

**Spotlight:** the phase guide (`section.phase-guide`).

**Teach:**

- The breadcrumb is the round: PLAN → ATTACK → AFTERMATH → RECOVER.
- The line under it is always **what to do right now.** Trust it.
- When the game needs a decision, or when it is time to Continue / End / Done attacking, **the
  button appears on the right of this tile.** You never have to hunt the rest of the page for it.

**Don't teach here:** the content of each phase (the tile already does that every round).

### 5. How a game ends

**Spotlight:** the top-bar status pills, with a secondary nod to the Graveyard tile on the pile
rail (one overlay can cover both if they don't sit in one rect — prefer the status pills as the
hole, and mention the rail in copy).

**Teach:**

- **★ VP** is your score from defeated Missions. You choose when to End the resistance and take
  that score.
- You **lose** if you fail two Missions, if five civilians reach the **Graveyard** (right-hand
  rail), or if Recover deals an all-Spy hand.
- The "✗ n / 2 failed" pill only appears after the first failed Mission — it is not missing at
  the start of the game.

**Don't teach here:** the win tiers (Draw / Minor / Victory / Major / Epic), era VP ramps, or
when it is "correct" to End vs Continue. AFTERMATH's own prompt handles that moment.

### 6. Undo and Settings

**Spotlight:** the top-bar controls (Undo, version, cog).

**Teach:**

- **Undo** takes back the last move, including a bad play or a mis-click.
- The **⚙ cog** (or **Esc**) is Settings: New game, Save, Load, and **Board size** if the table is
  hard to read. Ctrl + and Ctrl − scale it any time; Ctrl 0 returns to 100%.
- This tour lives under Settings as **How to play this table** if you want it again.

**Don't teach here:** seeds, What's New, the Log.

## Overlay behavior

**Shape.** A dimmed full-window overlay (`position: fixed`) with a rounded hole around the
spotlight target, a small copy card anchored near the hole (not covering it), and Next / Skip.
Same overlay family as What's New / Settings (dimmed board, one panel).

**Measuring the hole.** Read `getBoundingClientRect()` on a `data-coach="…"` marker on each
region. **Do not multiply by the Board size zoom.** Under CSS `zoom` on the root, that rect is
already in the same unzoomed space a `position: fixed` overlay is placed in (same rule as card
flights — see `docs/UX_BACKLOG.md`). Replay at 140% must still land the hole on the hand.

**Targets to mark** (stable selectors, not brittle text):

| Beat | Marker |
|---|---|
| 1 | `data-coach="hand"` on `section.hand` |
| 2 | `data-coach="zoom"` on the first Mission card (fallback: first hand card) |
| 3 | `data-coach="missions"` on `section.missions` |
| 4 | `data-coach="guide"` on `section.phase-guide` |
| 5 | `data-coach="status"` on `.topbar .status` |
| 6 | `data-coach="controls"` on `.topbar .controls` |

**Keyboard.** Next on Enter. Skip / dismiss on Escape (Escape does **not** open Settings while
the coach is up — same yield rule What's New already has).

**Clicks.** The dimmer and the hole ignore the board: no playing, no zoom, no Settings, while the
tour is running. Next / Skip are the only actions. (Replay-from-Settings already closed Settings.)

**Resize / Board size / scroll.** Re-measure the target on window resize and on scroll (capture),
without multiplying by the Board size zoom. Wheel / touch / PageUp-Down must not scroll the table
under a fixed hole — `scrollIntoView` on a beat change is the only scroll allowed, and that path
re-measures afterwards. Replay at 140% must still land the hole on the hand.

**Reduced motion.** Honor `prefers-reduced-motion`: no pulse on the hole, instant dim.

## Settings and What's New copy

**Settings.** New item, above Board size:

- Title: `How to play this table`
- Sub: `A short tour of the controls. You can skip it any time.`

**What's New (v0.1.6), for returning testers:** one bullet that the first-run tour exists and
lives under Settings — they will not be auto-shown it.

## Unchanged

- Engine, `legalActions`, decisions, save/load, Board size, What's New-once-per-build for
  returning players, hover `Tip`s, phase-guide copy, pick-target glow, decision modal.
- Default Board size stays 100%. The coach tells them zoom and Board size exist; it does not
  change their scale.

## Engine impact

None. UI only. Suggested files:

- `src/ui/Coach.tsx` — overlay, beat copy, Next / Skip
- `src/ui/coachLaunch.ts` — `shouldAutoShowCoach()`, storage helpers (easy to unit-test; named so it does not collide with `Coach.tsx` on Windows)
- `src/App.tsx` — own the open/close flag; yield Escape; close Settings before a replay
- `src/ui/SettingsMenu.tsx` — the replay item
- `src/index.css` — dimmer, hole, copy card
- `src/ui/patchNotes.ts` + `PATCH_NOTES.md` — when we cut the release

Markers (`data-coach`) are additive attributes on existing sections.

## Verification

1. `tsc --noEmit` + `npm run build` clean.
2. `npm test` green — engine untouched. Launch-state tests cover first-ever (What’s New, then coach), post-notes coach, and finished-coach returning players.
3. `npm run regress` — no behavioral change (presentation only).
4. Manual / Tier-2 if cheap:
   - Empty storage → What’s New, then the coach on dismiss; Skip writes `defy.coachSeen`; relaunch goes to the board.
   - Storage with `defy.whatsNewSeen = 0.1.5` and no coach key → What’s New, then the coach on dismiss.
   - Settings → How to play → tour runs; hole still tracks the hand at 140% Board size.
   - Escape on the coach dismisses the coach, does not open Settings.

## Risks

- **Hole misaligned at non-100% scale.** Same class of bug as "correcting" card-flight coordinates
  by the zoom factor. Measure, don't compensate.
- **Opening hand is all-Spy (rare).** Beat 1's Spy sentence covers it; the Hidden/Revealed halves
  still exist as copy even if that particular hand has nothing to click. Don't special-case the
  deal.
- **First-ever vs "I deleted What's New but kept a save."** Auto-show uses the two keys above, not
  the save slot. A 1.5 tester who wiped `localStorage` will see the coach — acceptable.
- **Two overlays at once.** What's New and the coach must not mount together. Coach waits until What's New closes (`closeWhatsNew` starts it when `defy.coachSeen` is unset). Reopening What's New from the version button does not restart a finished tour.
