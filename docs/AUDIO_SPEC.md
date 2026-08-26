# Audio — selection guide and build plan

**Status:** shipped in v0.1.9 — pipe + real cue files · **Area:** UI only

The game has a small audio layer (`src/ui/audio.ts`). Settings holds mute/volume. This note is how we
*choose* sounds and how we *ship* them. Cue files live in `src/assets/audio/`; replacing a file is a
drop-in, same as card art. Credits: [`docs/audio-credits.md`](./audio-credits.md).

Same constraint as the card art: **personal, non-commercial** use, intended to show the game's
creators. Do not grab commercial tracks, YouTube rips, or another game's assets.

## Tone

Resist is a quiet card game on a wooden table about the Spanish Maquis. Sound should feel like
**paper, wood, and weight** — sparse, dry, analog. It speaks at a few moments, then gets out of
the way.

**Yes:** a card hitting the table, a gunshot on an Enemy, an explosion when a Mission falls, a short loss breath, a win that grows with the
tier the way the overlay already does.

**No:** arcade boings, modern UI whooshes, trailer music, radio chatter on a loop, a cue
on every click.

If a sound would still make sense with the speakers off because the animation already said it,
skip that sound. Combat is the exception — playtesters could not hear a second card-tap as an attack.

## How we select (before any code)

Do this in order. Do not shop for a music album first.

### 1. Lock the cue list

Every file we add must map to a named cue below. No extras "because we found a cool sample."
Filenames = cue names (`play.ogg`, `strike.ogg`, …). Replacing a file later is a drop-in, same as
card art.

### 2. Two sources, two jobs

| Job | Best source | Why |
|---|---|---|
| **Table SFX** (play, strike, reinforce, draw/discard) | **Record the physical Resist! cards** on the table with a phone, 6 inches off the wood, 3 takes each | Unique, free, on-theme, no license question. The art came from the same table. |
| **Stingers** (win / loss) | Short **CC0 / public-domain** hits (Freesound, Mixkit, Pixabay, Kenney) *or* a musician friend | Hard to record a "victory" with cards. Keep under ~4 seconds. |

If recording is a hassle, CC0 table sounds are fine — still prefer "card on wood" over "video-game
shuffle."

### 3. Pick by listening in the game, not in a file browser

For each cue, shortlist **three** candidates (or three takes). Drop them in a folder, play a
real game, keep one. The winner is the one that does not annoy on the tenth play.

Rules of thumb while listening:

- A PLAN turn will fire `play` several times. If it is cute once and grating by card four, throw it out.
- `strike` may fire 2–4 times in one Attack. Short and dry.
- Win/loss play **once per game**. They can be bigger.
- Default **on**, with mute one click away. Many people play at a desk.

### 4. Keep a credits ledger

One file, `docs/audio-credits.md`, filled in as we pick:

- cue name
- filename
- source URL or "recorded at the table, YYYY-MM-DD"
- license (CC0 / CC-BY + author / original recording)
- who picked it

A CC-BY track is allowed if we put the author in that ledger and, later, in Settings or the
What's New notes. Prefer CC0 so we do not owe on-screen credits.

### 5. Technical bar for a file we keep

- Format: **OGG Vorbis** (small, fine in Chromium/Electron). MP3 is the fallback.
- Length: table SFX **< 0.4 s**; stingers **< 4 s**. No music loop in this pass.
- Size: aim **< 40 KB** per table cue, **< 120 KB** per stinger. The `.exe` already carries ~12 MB of card art.
- Peak: similar loudness across cues so mute/volume is one control, not six.
- Trim silence at the start so the sound hits with the animation, not 200 ms later.

## Cue list (this pass)

Table movement shares one card-flip; combat is gunshot / knife / explosion; end-game is five titled stingers.

| Cue | When | Notes |
|---|---|---|
| `play` | A Maquis is played or rearranged; coach Next / Skip / Start playing | File: `Card Flip.wav`. |
| `choose` | A Mission is chosen ("Click to attack") | File: `Mission attack selection audio.wav`. |
| `draw` / `discard` | A card flies into or out of the hand | Same flip, unless a Spy is leaving — then `slash`. |
| `strike` | Spend Attack on an Enemy | File: `Gunshot.wav`. |
| `slash` | A Spy leaves the table (discarded from hand) | File: `Knife slash.mp3`. |
| `reinforce` | An Enemy is added to a Mission | Same card flip (a card sliding onto the board). |
| `civilian` | A Civilian is sent to the Graveyard (Villa, CG Headquarters, Franco HQ, Caves, …) | File: `Civilian Death.mp3`. Fires on Graveyard growth (`useCivilianDeaths`); an undo that shrinks the pile stays silent. |
| `defeat` | Spend Attack on the Mission (the killing blow) | File: `Explosion.mp3`. |
| `loss` | Loss overlay opens | File: `Defeat Audio.mp3`. All three loss reasons share it. |
| `winDraw` | Draw overlay | File: `Draw Audio.mp3`. |
| `winMinor` | Minor Victory overlay | File: `Minor Victory Audio.mp3`. |
| `winVictory` | Victory overlay | File: `Victory Audio.mp3`. |
| `winMajor` | Major Victory overlay | File: `Major Victory Audio.mp3`. |
| `winEpic` | Epic Victory overlay | File: `Overwhelming Victory Audio.mp3`. |

**Explicitly not this pass:** music loop, UI button clicks, hover, Undo, Settings open,
phase-change stingers, per-Enemy voicelines.

## Build plan (after files exist, or with placeholders)

Code does not block on having final art-quality audio. We can wire silence-safe `playSfx('play')`
calls and drop files in as they land — same seam as card art.

### Slice A — the pipe (no taste required)

A tiny UI-only module. Engine stays silent.

- `src/ui/audio.ts`: `playSfx(name)`, `setMuted`, `setVolume`, `unlock` on first user gesture
  (click anywhere — browsers/Electron block autoplay until then).
- Bundle `src/assets/audio/*.ogg` via `import.meta.glob`, identical idea to `cardArt.ts`.
- Missing file = no-op, no crash.
- Persist `defy.soundMuted` + `defy.soundVolume` in `localStorage`.
- Settings: Mute toggle + volume slider, replacing the "coming later" footnote.
- Honor mute everywhere, including a system that was unlocked then muted.

Verify: unit-test mute/volume persistence with an injected storage map (same pattern as the coach).
No engine tests should change. `npm run regress` stays flat.

### Slice B — table cues

Hook `play` / `draw` / `discard` / `strike` / `reinforce` / `defeat` from the **UI diffs we
already have** (`useCardFlights`, `useReinforcements`, play/strike click handlers, defeated stamp).
Do not sprinkle audio inside `applyAction`.

Skip audio on New game and Undo (same `gameId` / `step` guards the flight hook already uses).

### Slice C — end-game stingers

Fire `loss` when `LossOverlay` mounts and the matching stinger when `WinOverlay` mounts (`Draw Audio`,
`Minor Victory Audio`, `Victory Audio`, `Major Victory Audio`, `Overwhelming Victory Audio` for Epic).
The `?preview=` harness is how we audition tiers without playing a whole game.

### Slice D — later, optional

Music. Only if we have a track that survives a 30-minute game at desk volume. Separate mute from
SFX if we ever add it. Not in the first audio release.

## Suggested order of work this week

1. Agree this cue list (cut `defeat` or `discard` here if it feels like one too many).
2. Record the table cues in one sitting (~20 minutes with the physical game).
3. Shortlist three loss + three win stingers from a CC0 library; listen with `?preview=loss` and
   `?preview=epic`.
4. Write `docs/audio-credits.md` as we pick.
5. Then Slice A → B → C in the repo.

## Non-goals

- No Howler/Tone.js/audio engine library. `Audio()` / one `AudioContext` is enough for eight one-shots.
- No spatial audio, no per-card samples, no ducking, no compressor chain.
- No autoplay on launch. Unlock on first click; the coach and What's New are already a gesture.

## Risks

- **Annoyance is the real bug.** A perfectly legal sound that fires every play will get muted
  forever. Bias quiet.
- **Double-firing** on discard-then-draw (Antonio) and on Undo. Follow the flight hook's guards.
- **`.exe` size.** Eight small OGGs are fine; a music loop is what bloats. Keep music out.
- **License mix-ups.** If the ledger row is empty, the file does not ship.
