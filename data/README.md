# Resist! — Card Data

Structured card data for the digital port of *Resist!*, transcribed directly from full-resolution photos of the physical cards (`Card Assets/`) and cross-checked against the official rulebook. This is the Phase 1 groundwork; the rules engine (Phase 2) reads from these files.

## Files

| File | Contents | Count |
|---|---|---|
| `maquis.json` | 24 Maquis, each with a Hidden and Revealed side (attack value, action type, action text) | 24 |
| `missions.json` | 20 Missions across 3 Eras (garrison, defense, victory points, keyword, effect) | 20 |
| `enemies.json` | 8 enemy types, 32 physical cards (defense value per copy, keyword, effect) | 32 |
| `civilians.json` | 8 Civilian cards (civilian count; one special "0" reshuffle card) | 8 |
| `spies.json` | 6 identical Spy dead-weight cards | 6 |
| `rules.json` | Setup constants, loss conditions, scoring/win table, effect timing | — |

## Field conventions

- **Attack value / defense value**: integers. `attack` on Maquis sides, `defense` on Missions/Enemies.
- **Mission icons**: `garrison` = card-stack icon (number of Enemy cards dealt to the Mission); `defense` = numbered shield (Attack Strength needed to defeat it); `victoryPoints` = laurel icon.
- **`actionType`** (Maquis): `PLAN`, `ATTACK`, or `PLAN/ATTACK`. `null` means the side shows an X (no action).
- **`keyword`**: `DEFEND`, `DEFEAT`, or `SURVIVE`. Skull marker = DEFEAT, shield marker = DEFEND on the card face.
- **Enemies**: within a type the effect text is identical; `defenseValues[]` lists the Defense of every physical copy, so its length equals the type's count.

## Reconciliation notes (vs. rulebook)

- **Enemy count**: 32, matching the rulebook. The handoff's "33" was a photo miscount (rows are 11 + 11 + 10).
- **Mission count**: 20 total (Era 1 = 8, Era 2 = 6, Era 3 = 6). All are photographed. Per game, setup removes 4/3/3, leaving 10 in play.
- **Win table** (re-read from the rulebook table): Epic Victory = defeat all 10 missions; 22+ = Major; 19–21 = Victory; 15–18 = Minor; 1–14 = Draw.
- **Engineer defense**: one Engineer's shield was obscured in the photo; inferred as 3 and since **confirmed** by the user against the physical card. Engineers are defense 2 and 3.

## Source

- Photos: `Card Assets/` (7 sheets, 2560×1920).
- Rulebook: `Resist_Rulebook_English_v4`.
