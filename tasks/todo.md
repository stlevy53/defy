# Post-v0.2.0 housekeeping

From the status review after the board-layout redesign.

## Queue

- [x] Remove `_to_delete/` so `npm test` matches the real suite
- [x] Fix stale test counts, Mission Eras backlog, leftover HANDOFF claims
- [x] Log audio preload under `PATCH_NOTES.md` Unreleased
- [x] Re-run `npm run fuzz` (and `npm run regress`) after the Celia empty-pool fix
- [x] Play the new board; file any sharp edges in `docs/UX_BACKLOG.md`
- [x] Re-run `npm run tier2` against the new board

## Review

- **Tests:** 199/199. `_to_delete/` leftover repro files were making `npm test` fail; removed.
- **Fuzz:** 4000 games, 0 findings (`sim/reports/report-0.2.0-2026-08-25_20-14-12.md`).
- **Regress:** 15 seeds had drifted vs the v0.1.3 baseline (expected — Mountain Pass, scout-before-discard, Celia empty-pool, etc.). Recaptured `sim/corpus/baseline.json` at v0.2.0; re-check is clean across 500 seeds.
- **Playtest (seed 2117291164, 1920×1080, 100%):** Missions are 452px with five-slot garrisons, strike order and Under attack work, Attack Strength is one token, a full PLAN→ATTACK→AFTERMATH→round 2 loop plays. One click-blocker: **Done attacking sat under the sticky status bar after a short scroll.** Fixed by wrapping the top chrome in `.board-chrome` (sticky as a group). Coach stage clamp also moved from the deleted `.board-main` to `#root`.
- **Tier 2:** 5 greedy seeds, 111 screenshots, 0 console errors / softlocks / rejections / white-screens.

## Out of this queue

Optional niceties, not blockers: compact AFTERMATH summary, custom `.exe` icon, unused Civilian/Maquis card backs, Tauri later, music/UI clicks still out of the audio queue.
