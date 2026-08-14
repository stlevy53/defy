// First-run coach: launch-state helpers and beat copy. Persistence lives in localStorage
// alongside What's New (`defy.whatsNewSeen`). First launch of a build: What's New, then the
// draft offer (if enabled), then the coach if it has never been finished. See docs/COACH_SPEC.md.
//
// Named coachLaunch (not coach.ts) so it does not collide with Coach.tsx on Windows.

export const COACH_SEEN_KEY = 'defy.coachSeen'
export const WHATS_NEW_SEEN_KEY = 'defy.whatsNewSeen'

/** Minimal storage surface so unit tests can inject a map instead of `localStorage`. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function liveStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function read(store: StorageLike | null, key: string): string | null {
  if (!store) return null
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

function write(store: StorageLike | null, key: string, value: string): void {
  if (!store) return
  try {
    store.setItem(key, value)
  } catch {
    /* quota / private mode — skip; this session just won't remember */
  }
}

/** True once the player has finished or skipped the coach. */
export function hasCompletedCoach(storage?: StorageLike): boolean {
  const store = storage ?? liveStorage()
  return read(store, COACH_SEEN_KEY) !== null
}

/** What's New whenever this build's notes have not been dismissed yet — including a first-ever launch. */
export function shouldAutoShowWhatsNew(appVersion: string, storage?: StorageLike): boolean {
  const store = storage ?? liveStorage()
  if (!store) return true
  return read(store, WHATS_NEW_SEEN_KEY) !== appVersion
}

/** Coach on launch only when it has never been finished *and* What's New is not about to show.
 *  If What's New is showing, App starts the coach when that modal closes (`hasCompletedCoach` is false). */
export function shouldAutoShowCoach(appVersion: string, storage?: StorageLike): boolean {
  if (hasCompletedCoach(storage)) return false
  if (shouldAutoShowWhatsNew(appVersion, storage)) return false
  return true
}

/** Completing or skipping the coach: never auto-show it again. */
export function markCoachFinished(appVersion: string, storage?: StorageLike): void {
  const store = storage ?? liveStorage()
  write(store, COACH_SEEN_KEY, '1')
  write(store, WHATS_NEW_SEEN_KEY, appVersion)
}

export interface CoachBeat {
  id: 'hand' | 'zoom' | 'missions' | 'guide' | 'status' | 'controls'
  /** `data-coach` marker to spotlight. Beat `zoom` falls back to `hand` if no Mission is marked. */
  marker: string
  title: string
  kicker?: string
  body: string[]
}

export const COACH_BEATS: CoachBeat[] = [
  {
    id: 'hand',
    marker: 'hand',
    kicker: 'Welcome to Resist. Six short tips, then you play.',
    title: 'Your hand — Hidden and Revealed',
    body: [
      'Each Maquis is two sides of one card. Left half is Hidden, right half is Revealed. Hover a half to see Play Hidden / Play Revealed, then click to play that side — or drag the card onto Hidden or Revealed on the table.',
      'Hidden cards can come back through the deck. Revealed cards leave the Hidden deck for good — they sit in the Revealed pile.',
      'A Spy has no halves to click. It stays in your hand until Recover. An all-Spy hand is a loss.',
    ],
  },
  {
    id: 'zoom',
    marker: 'zoom',
    title: 'Right-click to read a card',
    body: [
      'Right-click any face-up card to see it full-size. Click or press Esc to close it.',
      'The table shows the photograph; zoom is how you read the printed text — effects, the era line, the other side of a Maquis.',
      'Face-down Enemies stay hidden. They have no zoom, on purpose.',
    ],
  },
  {
    id: 'missions',
    marker: 'missions',
    title: 'Click the card, not a menu',
    body: [
      'These four Missions are what you can attack. In PLAN, click a Mission to choose it — that ends PLAN and reveals its Enemies.',
      'In ATTACK, click a glowing Enemy or the Mission to strike it. The glow means this is a legal click.',
      'After a Maquis is on the table, a small Use button appears under it when its action can fire. Click that, not a list of buttons.',
      'During PLAN, drag a played Maquis onto the other section to move it Hidden ↔ Revealed — or click the dimmed half. That locks as soon as anyone uses an action.',
    ],
  },
  {
    id: 'guide',
    marker: 'guide',
    title: 'This tile is “what to do now”',
    body: [
      'The breadcrumb is the round: PLAN → ATTACK → AFTERMATH → RECOVER.',
      'The line under it is always what to do right now. Trust it.',
      'When the game needs a decision, or when it is time to Continue, End, or Done attacking, the button appears on the right of this tile. You never have to hunt the rest of the page for it.',
    ],
  },
  {
    id: 'status',
    marker: 'status',
    title: 'How a game ends',
    body: [
      '★ VP is your score from defeated Missions. You choose when to End the resistance and take that score.',
      'You lose if you fail two Missions, if five civilians reach the Graveyard (right-hand rail), or if Recover deals an all-Spy hand.',
      'The “✗ n / 2 failed” pill only appears after the first failed Mission — it is not missing at the start of the game.',
    ],
  },
  {
    id: 'controls',
    marker: 'controls',
    title: 'Undo and Settings',
    body: [
      'Undo takes back the last move. During PLAN you can also drag a played Maquis to the other section (or click its dimmed half) — until anyone uses an action.',
      'The ⚙ cog (or Esc) is Settings: New game, Save, Load, and Board size if the table is hard to read. Ctrl + and Ctrl − scale it any time; Ctrl 0 returns to 100%.',
      'This tour lives under Settings as How to play this table if you want it again.',
    ],
  },
]
