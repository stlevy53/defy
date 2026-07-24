# Resist! — PC Port (working title: DEFY!)

A single-player digital port of the physical solitaire card game *Resist!* (Salt & Pepper Games, 2022), built as a web app (TypeScript + React).

## Status

**Phase 0 scaffold in place** — Vite + React + TypeScript project with the card data wired in and a passing test suite. Phase 1 (card data) is complete and validated against the rulebook. See [`RESIST_PC_PORT_PLAN.md`](./RESIST_PC_PORT_PLAN.md) for the full plan.

## Getting started

```
npm install      # install dependencies
npm run dev      # start the dev server
npm test         # run the test suite (data integrity)
npm run build    # typecheck + production build
```

## Layout

| Path | Contents |
|---|---|
| `src/` | Application source. `data/` (typed loader), `types/` (shared interfaces), `engine/` (rules engine — Phase 2), `App.tsx` (placeholder UI). |
| `data/` | Structured card data (Maquis, Missions, Enemies, Civilians, Spies) + `rules.json`. See [`data/README.md`](./data/README.md). |
| `Card Assets/` | Source photos of the physical cards (transcription source of truth). |
| `Resist_Rulebook_English_v4_(1).pdf` | Official rulebook. |
| `RESIST_PC_PORT_PLAN.md` | Project plan and phased roadmap. |
| `RESIST_PC_PORT_HANDOFF.md` | Original research handoff (rules, mechanics, layout). |

## Roadmap

1. ✅ **Phase 1** — card data to JSON
2. ✅ **Phase 0** — project scaffold (Vite + React + TypeScript)
3. 🔨 **Phase 2** — headless rules engine (validated against the rulebook's worked example) — slice 1 (state + RNG + setup) done
4. **Phase 3** — playable prototype UI
5. **Phase 4** — polish & desktop packaging (Tauri)

## Credits

Original game by Trevor Benjamin, Roger Tankersley, and David Thompson; illustrated by Albert Monteys. This is a personal, non-commercial port.
