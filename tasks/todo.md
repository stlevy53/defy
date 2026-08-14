# v0.1.6 — First-run coach (playtest drop)

Spec: `docs/COACH_SPEC.md`. Audio plan (held): `docs/AUDIO_SPEC.md`.

## Plan

- [x] Review the six coach beats
- [x] Confirm auto-show: first-ever only; v0.1.5 testers get What's New, not a forced tour
- [x] Hold sound — document in `docs/AUDIO_SPEC.md`, do not build

## Build

- [x] Coach overlay, launch helpers, Settings replay, scroll lock / re-measure
- [x] Stamp v0.1.6 in `package.json`, `PATCH_NOTES.md`, `src/ui/patchNotes.ts`

## Verify

- [x] `tsc --noEmit`, `npm test` (153/153), `npm run build`, `npm run regress` unchanged (pre-stamp)
- [x] Re-run tests after version stamp
- [x] `npm run package` → `C:\Users\stephen.levy\GHRepos\defy_release\DEFY-Playtest-0.1.6.exe`

## Out of this version

Sound (see `docs/AUDIO_SPEC.md`), big-window board cap, era chips, face-down Enemy back, draft setup.

## Review

Coach ships to the people already on v0.1.5. Version ticks to 0.1.6 so they see What's New pointing at Settings → How to play this table. First-ever launches get the tour. Sound stays on paper.
