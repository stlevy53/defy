// In-app patch notes — the source the "What's New" launch modal reads. Keep this in sync with the
// repo changelog `PATCH_NOTES.md` on every release: prepend the new version to the top of the
// array (newest first) and bump nothing else — `LATEST`/`APP_VERSION` derive from index 0.

export interface PatchNote {
  version: string
  date: string // ISO yyyy-mm-dd
  title?: string
  changes: string[]
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.2.1',
    date: '2026-08-25',
    title: 'Your profile, your stats, and a table that fits',
    changes: [
      'Player profile & stats — a new Profile tab under ⚙ Settings. Set a display name and track your games over time: best score, average, win rate, a score-per-game chart, personal records, and full history. Export, import, or clear your data any time. (Stored locally for now.)',
      'Committed lanes no longer scroll — played Maquis lay out up to four across each Hidden / Revealed row; a fifth card wraps to a second row whose top edge peeks so you know there’s more, and you scroll only that lane to see it.',
      'Board size — added 75% and 90% for laptop screens and dropped 160%. The steps are now 75 / 90 / 100 / 110 / 125 / 140%, still adjustable with Ctrl + / − / 0.',
      'More table space — trimmed the empty band under the phase guidance so the play area gets the room.',
      'Round counter in the status bar, and during ATTACK the Attack Strength token shows a “To clear” total (the Mission’s remaining Defense plus standing Enemies) that drops as targets fall.',
      'Bunker always discards a Maquis, never a Spy — and says so if your hand has none left.',
      'Emilio only offers Copy when another hidden Maquis can actually complete its action; after any Use, a locked card’s dimmed half explains that sides are locked until you Undo that Use.',
      'Use — the gold action bar under a played Maquis is a bigger click target, and clicking the card itself fires its action when it’s legal.',
      'Sound cues start loading when the app opens, so the first flip or gunshot isn’t waiting on decode.',
      'Fix — “Done attacking” / “Continue” stay clickable after you scroll (they were sliding under the sticky status bar).',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08-25',
    title: 'A board that fits the window',
    changes: [
      'The board is rebuilt around fixed-height bands — status bar, phase guidance, Missions, committed lanes, hand — instead of one tall scrolling column, so a maximized window shows the whole table with far less scrolling.',
      'Missions sit in a fixed four-across row at a readable 452px, with the era, keyword, Defense, VP, and Garrison overlaid on the art. Attacking one dims and outlines the other three so it’s unmistakable which Mission is live.',
      'A Mission’s garrison is a fixed five-slot strip — enemies keep a constant tile height regardless of count, empty slots read as empty, and a Mission reinforced past five (Radio Operator, the Barracks) shows a “+N” instead of silently growing or hiding an Enemy.',
      'Strike order is taught before you click: a legal target gets an accent ring and “Strike 1st/2nd/…” badge; an Enemy still gated by Grunts shows the same ordinal, quieter.',
      'A face-down Enemy now shows its real printed card back instead of a placeholder.',
      'One Attack Strength number — was a top-bar pill and a turn-tile meter showing the same figure twice. It now lives once, at the seam between your committed lanes and the board, and floats the exact cost on both itself and the struck target when you spend it.',
      'One event line — the latest thing that happened shows as a single pill under the status bar. It no longer repeats what already animates on the board (a struck target, a reinforced Mission, a defeated Mission’s stamp), and the old bottom-left toast stack is gone.',
      'Hover a hand or committed card to read both its Hidden and Revealed action text without right-clicking to zoom.',
      'A decision that asks you to click cards on the board (discard one, flip one, etc.) now keeps its prompt and Confirm button pinned to the bottom of the window, so scrolling to see the board never loses track of what you’re choosing.',
      'The phase/turn area is calmer: guidance sits in its own line under the status bar again, the “Done attacking” / “Continue” button pulses so it’s clear what to click next, and a card’s foot bar always names the actual action (no more a PLAN action reading “ATTACK”, or a card that was never used claiming “USED IN PLAN”).',
      'Fix — the “?” phase-help popover works again (an earlier layout change was silently clipping it).',
    ],
  },
  {
    version: '0.1.9',
    date: '2026-08-18',
    title: 'The table makes a sound',
    changes: [
      'Sound — a card flip when something moves on the table; a gunshot when you defeat an Enemy; a knife when a Spy leaves; an explosion when you destroy a Mission. Win and loss have their own stingers. Mute and volume live under ⚙ Settings. The How to play tour uses the card flip on Next and Skip.',
      'Fix — Undo after discarding the wrong Enemy (Anastasio, and the same kind of pick) takes back the whole action, so you can use the card again.',
      'Fix — right-click zoom works on cards in the Revealed-pile picker.',
      'Fix — the last How to play tip stays on the table, so Skip / Start playing stay clickable.',
      'Missions show an Era 1 / 2 / 3 chip so the printed era is readable at board size.',
    ],
  },
  {
    version: '0.1.8',
    date: '2026-08-18',
    title: 'You can’t un-see Enemies',
    changes: [
      'Undo — revealing Enemies cannot be undone: a scout during PLAN, or choosing a Mission, once those Enemies are face-up. You can still undo plays after that.',
      'The “Click to attack” cue sits at the top of the Mission, so it no longer covers the Enemies underneath.',
      'Fix — Recon the Mountain Pass now asks which Mission to flip after you defeat it. It no longer auto-picks that Mission after its garrison is already revealed.',
    ],
  },
  {
    version: '0.1.7',
    date: '2026-08-14',
    title: 'Draft your Maquis, and a clearer table',
    changes: [
      'Draft setup — a new game asks whether to draft your Maquis (the rulebook’s recommended start) or skip into a random deal. Click the one you want in Hidden; the other flies to Recruit. Twelve picks, then you play. Turn the prompt off under ⚙ Settings → Draft setup.',
      'Played Maquis no longer wear Hidden / Revealed pills on the face, and the Use control sits under the card so the printed name and action text stay readable.',
      'Fix — a first-time launch now shows What’s New, then the draft prompt, then the table tour. (v0.1.6 dropped you on the board after What’s New.)',
      'Fix — after you defeat a Mission, you can still click the Enemies left on it. The Defeated stamp no longer sits on top of those clicks.',
      'Fix — Domingo and Pilar’s PLAN scout now flips the Enemies face-up before asking which one to discard.',
      'PLAN rearrange — drag a played Maquis onto Hidden or Revealed, or click the dimmed half, without undoing later plays. It locks as soon as anyone uses a card action.',
      'Drag to play — grab a card from your hand and slide it onto Hidden or Revealed. Clicking a half still works.',
      'Undo — hover the Undo button in the top bar for a reminder. (It was always there; returning players who skipped the table tour often missed it.)',
    ],
  },
  {
    version: '0.1.6',
    date: '2026-08-13',
    title: 'How the table works',
    changes: [
      'A short first-run tour of the table — Hidden/Revealed halves on your hand, right-click zoom, clicking Missions, the phase tile, how a game ends, and Undo / Settings. Six tips, skippable, then you play. If you already played v0.1.5 you will not be walked through it; replay it any time from ⚙ Settings → How to play this table.',
      'Fix — while the tour is up, scrolling no longer slides the highlighted region out of the spotlight.',
    ],
  },
  {
    version: '0.1.5',
    date: '2026-08-12',
    title: 'The real cards, at a size you can read',
    changes: [
      'Real card art is in — every card now shows its actual printed face: all 24 Maquis, 20 Missions, 8 Enemy types, 8 Civilians and the Spy, on the board, in your hand, in the choice window and in right-click zoom. (A face-down Enemy is still a plain token; there’s no photo of a card back yet.)',
      'Board size — under ⚙ Settings, scale the whole table to 100%, 110%, 125%, 140% or 160%. At the larger sizes the printed card text reads without right-click zoom. Ctrl + and Ctrl − adjust it any time, Ctrl 0 returns to 100%, and your choice is remembered.',
      'Right-click zoom is much bigger — the enlarged card now grows to fit your window (up to the full resolution of the card photo) instead of a fixed size, so the printed text is far easier to read: roughly double the area on a 1080p screen.',
      'The window now opens maximized and remembers its size and position, so a bigger board doesn’t mean more scrolling than it has to.',
      'Fix — the Spy card is no longer sideways: it sits in your hand in landscape, matching the Maquis.',
      'Fix — the board no longer scrolls sideways (a hidden tooltip was stretching the page).',
      'Fix — in the choice window, the order badges (“1”, “2”, …) on the top row of cards are no longer clipped at the corner.',
    ],
  },
  {
    version: '0.1.4',
    date: '2026-07-30',
    title: 'A card window for choices, and UI polish',
    changes: [
      'Choices that pull cards from a pile now open in a window — pick from the Revealed pile, peek at the top of a deck, or reorder cards with them shown full-size, Hidden and Revealed side by side, instead of a list of names. Choices you make on the board (Missions, Enemies, your played cards) are unchanged.',
      'Reordering keeps the current order by default — if you’re happy with it, one click on “Keep this order”; only re-sequence if you actually want to.',
      'This “What’s New” now shows once per build instead of every time you launch (reopen it any time from the version button up top).',
      'Log pop-ups moved to the bottom-left so they no longer cover the deck and pile counts on the right.',
      'The failed-Missions indicator now shows how close you are to defeat — e.g. “✗ 1 / 2 failed”.',
    ],
  },
  {
    version: '0.1.3',
    date: '2026-07-27',
    title: 'Save & load, settings, and clearer choices',
    changes: [
      'Settings menu — open it with the ⚙ cog (top-right) or the Esc key. It holds New game, Save game, and Load game (and is where sound options will live later).',
      'Save & load your game — stop mid-round and pick up exactly where you left off, decisions and all. Saves persist between sessions.',
      'Pick multiple Enemies right on the Mission — actions like Paquita’s “discard two Enemies” and Juana’s “flip one or two” are now done by clicking the Enemies on the Mission card; the tile just shows the count and a Confirm.',
      'Cards you can click are now clearly highlighted — whenever a choice asks you to pick a card, the valid targets (Missions, Enemies, played and hand cards) glow so you can see exactly what to click.',
      'Attack gained from an action now shows on the card — e.g. Consuelo’s “gain the Enemy’s Defense” bumps her Attack value with a “+N”, matching the total up top.',
      'Log pop-ups — the latest game-log lines briefly appear on screen so you can see what just happened without opening the Log.',
      'Reproduce a specific deal — enter a seed under New game in Settings to start that exact game (great for sharing a tricky board).',
      'Tidier top bar — dropped the redundant phase tag and the extra New game button (both live elsewhere now), leaving a single click-to-copy seed indicator.',
      'Fix — tooltips near the top of the screen are no longer hidden behind the top bar.',
    ],
  },
  {
    version: '0.1.2',
    date: '2026-07-26',
    changes: [
      'What’s New: this window now greets you on launch, so each build tells you what changed since the last one.',
      'End-of-game moments: win (with your scored tier) and loss now play as a full overlay, with Play Again.',
      'Right-click a card to see it up close.',
      'The top bar is sticky — your status and the Undo / New game controls stay in reach as you scroll.',
      'A new right-side rail summarizes the decks and piles at a glance.',
      'Card moves now animate — when you discard or draw, the card flies between your hand and the matching pile, so effects like Antonio’s spy swap are easy to follow.',
      'Discarding an Enemy “from another Mission” (e.g. Railroad Bridge) is now done by clicking the Enemy right on its Mission — and face-down Enemies keep their identity hidden, so you no longer accidentally see what they are.',
      'Draw actions now log what happened — including when the Hidden deck (and its discard) run dry and you draw fewer cards than the action asked for (e.g. Sagrario’s “draw 2” yields only 1).',
      'Fix: the reinforcement animation no longer misfires when you start a new game.',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-07-25',
    title: 'Visual identity, packaging, and readability',
    changes: [
      'A themed wooden tabletop background.',
      'Attack Strength changes are surfaced as you play, including count-based bonuses (e.g. “+1 per revealed Maquis”).',
      'Enemies added to a Mission animate in; Missions show a live Garrison count; the Recover phase notes how many cards you’ll draw.',
      'Real card-art can now drop in over the text cards.',
      'Packaged as a standalone portable Windows build — no dev server needed.',
      'Fixes: Juana’s reshuffle, and Sagrario / Ramona’s ATTACK “draw” actions (which were doing nothing) now fire.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07-24',
    title: 'First playable prototype',
    changes: [
      'Play a full game start to finish — PLAN → ATTACK → AFTERMATH → RECOVER — with win tiers and all loss conditions.',
      'Direct card interaction: play, use, and choose by clicking the card; strike targets by clicking them on the board.',
      'A round-phase breadcrumb with new-player guidance, plus hover tooltips on card icons, stats, and action text.',
      'Undo, New game, and seeded (reproducible) games.',
      'Runs on the complete, rulebook-verified rules engine.',
    ],
  },
]

export const LATEST: PatchNote = PATCH_NOTES[0]
export const APP_VERSION: string = LATEST.version
