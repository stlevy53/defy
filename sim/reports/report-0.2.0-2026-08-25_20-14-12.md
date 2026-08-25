# DEFY! fuzz report — v0.2.0

Run 2026-08-25T20:14:12.016Z · 11940 ms · 4000 games (2000 seeds × 2 policies, step cap 2000)

## Headline

- **0** crashes · **0** softlocks · **0** invariant breaks · **0** non-terminating
- **0** unimplemented effect(s) hit the `[stub]` path
- 4000/4000 games reached an ending

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

Rounds — min 1 / mean 1.58 / max 4 · Steps — mean 17.47 / max 51

| Outcome | Games |
|---|---|
| win:Draw | 1083 |
| loss:missions | 793 |
| loss:civilians | 124 |

### Policy: greedy

Rounds — min 1 / mean 3.39 / max 6 · Steps — mean 50.01 / max 82

| Outcome | Games |
|---|---|
| loss:spies | 886 |
| loss:missions | 859 |
| loss:civilians | 255 |
