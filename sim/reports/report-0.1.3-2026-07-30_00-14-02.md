# DEFY! fuzz report — v0.1.3

Run 2026-07-30T00:14:02.279Z · 21800 ms · 10000 games (5000 seeds × 2 policies, step cap 2000)

## Headline

- **0** crashes · **0** softlocks · **0** invariant breaks · **0** non-terminating
- **0** unimplemented effect(s) hit the `[stub]` path
- 10000/10000 games reached an ending

## Crashes (0)

_None._

## Softlocks (0)

_None._

## Invariant breaks (0)

_None._

## Non-termination (0)

_None._

## Unimplemented effects — `[stub]` hits (0)

_None — every effect that fired has a handler._

## Balance telemetry

### Policy: random

Rounds — min 1 / mean 1.57 / max 4 · Steps — mean 17.25 / max 58

| Outcome | Games |
|---|---|
| win:Draw | 2762 |
| loss:missions | 1942 |
| loss:civilians | 296 |

### Policy: greedy

Rounds — min 1 / mean 3.37 / max 6 · Steps — mean 49.92 / max 83

| Outcome | Games |
|---|---|
| loss:spies | 2255 |
| loss:missions | 2102 |
| loss:civilians | 643 |
