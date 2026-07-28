# Resist! — PC Port (working title: DEFY!)

A single-player digital port of the physical solitaire card game *Resist!* (Salt & Pepper Games, 2022), built as a web app (TypeScript + React).

## Status

**Playable prototype.** The headless rules engine (Phase 2) is **complete and rulebook-verified**, and a **playable, polished, themed React UI** (Phase 3) sits on top of it — run `npm run dev` and play a full game start to finish. It has a wooden **tabletop** theme, a **real card-art rendering seam** (each card shows its real image when present, else a themed frame), and a **settings menu** (⚙ / Esc) with **save & load** so you can resume a game later. **147/147 tests pass**; `tsc` + `build` are clean. Remaining work: add the real card art (reshoot + slice — see [`tools/card-art.md`](./tools/card-art.md)), minor polish, an optional draft-variant setup, and Phase 4 packaging. For the current working state and a session bootstrap, read [`HANDOFF.md`](./HANDOFF.md); for the phased roadmap see [`RESIST_PC_PORT_PLAN.md`](./RESIST_PC_PORT_PLAN.md).

## Getting started

```
npm install      # install dependencies
npm run dev      # start the dev server
npm test         # run the test suite (data integrity)
npm run build    # typecheck + production build
npm run package  # build a Windows portable .exe for playtesters (see HANDOFF.md §10)
```

## Layout

| Path | Contents |
|---|---|
| `src/` | Application source. `data/` (typed loader), `types/` (shared interfaces), `engine/` (headless rules engine + effects), `ui/` (React view: `Card` rendering seam, `cardArt` manifest, `Tip`, `Zoom`, `useGame` (state + save/load), `format`/guidance, `DecisionPanel`, `SettingsMenu`, `WhatsNew`/`patchNotes`), `App.tsx` (board), `index.css`. |
| `src/assets/cards/` | Per-card art images (`<category>/<id>.jpg`), auto-loaded by `ui/cardArt.ts`. Empty until art is added; cards fall back to a themed frame. |
| `data/` | Structured card data (Maquis, Missions, Enemies, Civilians, Spies) + `rules.json`. See [`data/README.md`](./data/README.md). |
| `docs/ENGINE_DESIGN.md` | Full rules-engine architecture spec. |
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
4. 🔨 **Phase 3** — playable prototype UI (functional, polished, themed; real card art is the remaining piece)
5. 🔨 **Phase 4** — polish & desktop packaging. A **Windows portable `.exe`** build is available for playtesting via `npm run package` (Electron); see [`HANDOFF.md`](./HANDOFF.md) §10. A smaller Tauri build remains a later option.

## Credits

Original game by Trevor Benjamin, Roger Tankersley, and David Thompson; illustrated by Albert Monteys. This is a personal, non-commercial port.
