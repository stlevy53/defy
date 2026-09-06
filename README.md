# Resist! — PC Port (working title: DEFY!)

A single-player digital port of the physical solitaire card game *Resist!* (Salt & Pepper Games, 2022), built as a web app (TypeScript + React).

## Status

**Playable prototype — v0.2.2.** The headless rules engine (Phase 2) is **complete and rulebook-verified**, and a **playable, polished, themed React UI** (Phase 3) sits on top of it — run `npm run dev` and play a full game start to finish. **Every card renders its real printed art**, including the **face-down Enemy back** (all 61 faces + the back: 24 Maquis, 20 Missions, 8 Enemy types, 8 Civilians, the Spy), over a wooden **tabletop** theme. The **24 Maquis were re-scanned in v0.2.2** (fresh full-bleed faces at 3:2, with the Spy re-cropped to match and the hand centred on the table). The board is **rebuilt around fixed-height bands** (status bar, phase guidance, a fixed four-across Mission row, committed lanes, hand) so a maximized window shows the whole table with far less scrolling; committed lanes lay Maquis **up to four across and wrap with a peeking second row** instead of scrolling a tiny strip. Missions render at a readable 452px with a **fixed five-slot garrison strip** and taught **strike order**, feedback is **consolidated** — one Attack Strength number, one event line, hover-peek instead of right-click zoom for hand/committed cards — plus a **Board size** setting that scales the table 75–140% for laptop-to-desktop screens, a **player profile** with per-game stats (best/average score, win rate, a score-per-game chart, personal records and full history; ⚙ Settings → Profile, stored locally), a **settings menu** (⚙ / Esc) holding **save & load**, a **full-card decision window** for pile choices — see [`docs/DECISION_MODAL_SPEC.md`](./docs/DECISION_MODAL_SPEC.md) — a **first-run coach**, the rulebook **draft setup** (offered at the start of a new game; turn it off in Settings), and **sound** (card flip, combat, end-game; mute/volume in Settings — [`docs/AUDIO_SPEC.md`](./docs/AUDIO_SPEC.md)). Spec: [`docs/COACH_SPEC.md`](./docs/COACH_SPEC.md). Tests, `tsc`, and `build` are clean.

**Automated testing.** An in-repo test harness (`sim/`) self-plays the pure engine to find bugs fast: a headless **invariant fuzzer** (`npm run fuzz`) plays thousands of seeded games per minute asserting card-conservation, softlock, crash, and unimplemented-effect oracles; a **regression corpus** (`npm run regress`) detects any behavioral change against a committed baseline; and a **live CDP harness** (`npm run tier2`) drives the real Electron build to screenshot the UI and capture console errors. See [`sim/README.md`](./sim/README.md). Every fuzz run is clean. The board-layout redesign was presentation-only aside from a small rules fix that rode with it: when the Hidden deck and discard are both empty, Celia/Antonio dump a Spy without shuffling it straight back into hand.

Board readability at that art's scale is handled by a **Board size** setting (Settings, or Ctrl +/−/0) that scales the whole table from 75% to 140% — 75% and 90% for laptop screens, up to 140% for reading printed card text — and the board itself now uses a maximized window's width instead of capping at a fixed pixel size (see **Resolved** in [`docs/UX_BACKLOG.md`](./docs/UX_BACKLOG.md)). Remaining work is minor polish. **Sound is in** (mute/volume in Settings; table and combat cues — [`docs/AUDIO_SPEC.md`](./docs/AUDIO_SPEC.md), credits in [`docs/audio-credits.md`](./docs/audio-credits.md)). For the current working state and a session bootstrap, read [`HANDOFF.md`](./HANDOFF.md); for the phased roadmap see [`RESIST_PC_PORT_PLAN.md`](./RESIST_PC_PORT_PLAN.md); for the art pipeline see [`tools/card-art.md`](./tools/card-art.md).

## Getting started

```
npm install      # install dependencies
npm run dev      # start the dev server
npm test         # run the test suite
npm run build    # typecheck + production build
npm run package  # build a Windows portable .exe for playtesters (see HANDOFF.md §10)

npm run fuzz     # headless self-play fuzzer — crashes/softlocks/invariants/[stub] + balance (sim/)
npm run regress  # diff current behavior against the committed regression baseline
npm run tier2    # live UI/UX pass over a running build via Chrome DevTools (see sim/live/README.md)
```

## Layout

| Path | Contents |
|---|---|
| `src/` | Application source. `data/` (typed loader), `types/` (shared interfaces), `engine/` (headless rules engine + effects), `ui/` (React view: `Card` rendering seam, `cardArt` manifest, `Tip`, `Zoom`, `useGame` (state + save/load), `format`/guidance, `DecisionPanel` + `DecisionModal` (full-card pile choices), `SettingsMenu`, `ProfilePanel` + `profile`/`stats` (player profile and per-game statistics), `Coach`/`coachLaunch` (first-run tour), `WhatsNew`/`patchNotes`, `audio` (table/combat/end-game cues), `debugHook` (dev-only `window.__defy` test seam)), `App.tsx` (board), `index.css`. |
| `src/assets/cards/` | Per-card art images (`<category>/<id>.jpg`), auto-loaded by `ui/cardArt.ts`. All 61 cards present; anything missing falls back to a themed frame. |
| `src/assets/audio/` | Cue files for the UI sound layer (`ui/audio.ts`). Credits: [`docs/audio-credits.md`](./docs/audio-credits.md). |
| `data/` | Structured card data (Maquis, Missions, Enemies, Civilians, Spies) + `rules.json`. See [`data/README.md`](./data/README.md). |
| `sim/` | Automated testing harness — headless fuzzer, invariants, policies, regression corpus (`sim/corpus/`), reports (`sim/reports/`), and the live CDP harness (`sim/live/`). See [`sim/README.md`](./sim/README.md). |
| `docs/ENGINE_DESIGN.md` | Full rules-engine architecture spec. |
| `docs/DECISION_MODAL_SPEC.md` | Spec for the full-card decision window (routing rule, per-kind behavior, verification). |
| `docs/COACH_SPEC.md` | Spec for the first-run table tour (beats, launch sequence, Settings replay). |
| `docs/PROFILE_STATS_SPEC.md` | Spec for the player profile + per-game statistics (record snapshot, store, derived stats, chart). |
| `docs/AUDIO_SPEC.md` | Sound selection + cue list (mute/volume pipe, table/combat/end-game). Credits: [`docs/audio-credits.md`](./docs/audio-credits.md). |
| `tools/` | Card-art pipeline: `slice_cards.py` (deskew/crop cards from flat photos) + [`card-art.md`](./tools/card-art.md) (shooting + slicing + naming guide). |
| `Card Assets/` | Source photos of the physical cards (data transcription source of truth). |
| `Resist_Rulebook_English_v4_(1).pdf` | Official rulebook. |
| `HANDOFF.md` | Working handoff — current state + session bootstrap. |
| `RESIST_PC_PORT_PLAN.md` | Project plan and phased roadmap. |
| `RESIST_PC_PORT_HANDOFF.md` | Original research handoff (rules, mechanics, layout). |

## Roadmap

1. ✅ **Phase 1** — card data to JSON
2. ✅ **Phase 0** — project scaffold (Vite + React + TypeScript)
3. ✅ **Phase 2** — headless rules engine, validated against the rulebook's worked example (M2 gate passes)
4. 🔨 **Phase 3** — playable prototype UI (functional, polished, themed, with real card art including the Enemy back, a fixed-band board layout that makes a large window pay off, a Board size setting, a first-run coach, and sound; audio: [`docs/AUDIO_SPEC.md`](./docs/AUDIO_SPEC.md); remaining work is minor polish)
5. 🔨 **Phase 4** — polish & desktop packaging. A **Windows portable `.exe`** build is available for playtesting via `npm run package` (Electron); see [`HANDOFF.md`](./HANDOFF.md) §10. A smaller Tauri build remains a later option. An **automated test harness** (`sim/`) backs this phase — fuzzing, a regression corpus, and a live UI pass — so prototype builds can be checked for crashes, softlocks, and behavioral drift before shipping.

## Credits

Original game by Trevor Benjamin, Roger Tankersley, and David Thompson; illustrated by Albert Monteys. This is a personal, non-commercial port.
