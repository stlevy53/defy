# Resist! — PC Port (working title: DEFY!)

A single-player digital port of the physical solitaire card game *Resist!* (Salt & Pepper Games, 2022), built as a web app (TypeScript + React).

## Status

**Phase 1 complete** — all card data transcribed from the physical cards into structured JSON and validated against the rulebook. See [`RESIST_PC_PORT_PLAN.md`](./RESIST_PC_PORT_PLAN.md) for the full plan.

## Layout

| Path | Contents |
|---|---|
| `data/` | Structured card data (Maquis, Missions, Enemies, Civilians, Spies) + `rules.json`. See [`data/README.md`](./data/README.md). |
| `Card Assets/` | Source photos of the physical cards (transcription source of truth). |
| `Resist_Rulebook_English_v4_(1).pdf` | Official rulebook. |
| `RESIST_PC_PORT_PLAN.md` | Project plan and phased roadmap. |
| `RESIST_PC_PORT_HANDOFF.md` | Original research handoff (rules, mechanics, layout). |

## Roadmap

1. ✅ **Phase 1** — card data to JSON
2. **Phase 2** — headless rules engine (validated against the rulebook's worked example)
3. **Phase 3** — playable prototype UI
4. **Phase 4** — polish & desktop packaging (Tauri)

## Credits

Original game by Trevor Benjamin, Roger Tankersley, and David Thompson; illustrated by Albert Monteys. This is a personal, non-commercial port.
