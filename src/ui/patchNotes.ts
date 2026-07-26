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
    version: '0.1.2',
    date: '2026-07-26',
    changes: [
      'What’s New: this window now greets you on launch, so each build tells you what changed since the last one.',
      'End-of-game moments: win (with your scored tier) and loss now play as a full overlay, with Play Again.',
      'Right-click a card to see it up close.',
      'The top bar is sticky — your status and the Undo / New game controls stay in reach as you scroll.',
      'A new right-side rail summarizes the decks and piles at a glance.',
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
