# `sim/live/` — Tier 2 live UI/UX harness

Drives the **real app** over the Chrome DevTools Protocol and captures what a pure-logic fuzzer
can't see: what the screen actually shows, console errors during real play, and whether the UI
tracks engine state. No browser download — Electron already embeds Chromium.

## Prerequisites (one-time)

```bash
npm install          # picks up chrome-remote-interface (added to devDependencies)
```

## Run

The harness attaches to a CDP **debugging port**, so the app must be started with one open. Electron
opens the port itself, so it's the simplest path — and it exercises the real shipping shell.

**A — Electron shell (recommended).** The hook only ships in dev or a `VITE_DEFY_DEBUG=1` build, so
build with that flag once:

```powershell
# terminal 1  (PowerShell)
$env:VITE_DEFY_DEBUG=1; npm run build
npx electron . --remote-debugging-port=9222
```
```powershell
# terminal 2
npm run tier2 -- --port 9222 --seeds 5 --policy greedy
```

**B — Chrome + Vite dev server (alternative).** A dev server alone has no debugging port — Chrome
must be launched with one:

```powershell
# terminal 1
npm run dev                                    # serves http://localhost:5173 (hook on automatically)
# terminal 2 — launch Chrome ON the debug port, pointed at the app
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 http://localhost:5173
# terminal 3
npm run tier2 -- --port 9222 --seeds 5 --policy greedy
```

## Options

`--seeds 1,2,3` or `--seeds 5 --start 1` · `--policy greedy|random` · `--port 9222` ·
`--url <devserver>` · `--shots phases|all|none` · `--settle-ms 60` · `--step-cap 2000`.

## Output → `sim/live/out/`

- **PNG screenshots** `seed-<n>-r<round>-<phase>-...png` — one per phase transition (plus decision
  panels, softlocks, start/end). This is the material for a UX read.
- **`tier2-findings.json`** — console errors / uncaught exceptions (tagged with the seed + phase
  they occurred in), softlocks, dispatch rejections (a move the UI refused though the engine
  reported it legal — a real desync or a hook race), white-screen checks, and per-seed summaries.

Exit code is non-zero if anything was found.

## What it catches vs. Tier 1

Tier 1 proves the *engine* is consistent. Tier 2 exercises the *rendered app*: white-screens,
console errors/exceptions during play, and UI/engine desync. The screenshots feed the qualitative
UX critique (readability, discoverability of legal moves, phase clarity, affordances) — the part
that needs eyes, not assertions.

## Strengthening the DOM-vs-state oracle (optional)

The built-in DOM check is deliberately light (did the app render at all). Adding a few stable
`data-testid` attributes to the pile-count rail, the attack-strength readout, and the phase
indicator would let the harness assert rendered numbers equal `getState()` values — turning "it
didn't crash" into "it showed the right thing."
