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
