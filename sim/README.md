# `sim/` — automated testing agent (Tier 1)

Headless self-play over the pure `src/engine`. Plays thousands of full games per minute with no
UI and no model tokens, asserting an invariant after every move, and pins every finding to a
reproducing seed. This is Tier 1 of the plan; Tiers 2–3 (live UI/UX agent, Claude-as-playtester)
reuse the same driver by swapping the policy.

## Run

```bash
npm run fuzz                    # 2000 seeds × {random, greedy}, writes sim/reports/
npm run fuzz -- --seeds 5000    # more coverage
npm run fuzz -- --policy greedy # one policy (random | greedy | both)
npm run fuzz -- --seed 12345 --policy random   # reproduce ONE seed deterministically
```

Exit code is non-zero if anything was found (crash / softlock / invariant / non-termination /
`[stub]` hit), so it slots into a pre-push or CI check later.

## What it catches

- **Crashes** — any thrown error from the engine (illegal transition, bad decision).
- **Softlocks** — game not over, no pending decision, zero legal actions.
- **Invariant breaks** — card conservation (via the engine's own `assertConservation`), plus
  negative/NaN scalars and bad enemy defenses.
- **Non-termination** — a game that blows the step cap.
- **`[stub]` hits** — an effect that fired with no registered handler. This is the exact class that
  shipped the Sagrario·revealed / Ramona·revealed bugs; `greedy` prefers revealing Maquis and
  firing actions specifically to flush these out at runtime (complements the static
  `effects/coverage.test.ts`).

Correctness note: a consistent, crash-free run does **not** prove rulebook-correctness — that still
rests on the hand-written tests and the regression corpus below.

## Reports

`sim/reports/report-<version>-<timestamp>.{md,json}` plus `report-latest.{md,json}`. The Markdown is
the human read (prioritized findings + repro commands + balance telemetry); the JSON carries full
failure traces for tooling.

## Regression corpus (change-detector)

```bash
npm run regress -- --capture   # record current behavior as the baseline (sim/corpus/baseline.json)
npm run regress                # diff current build against the committed baseline
```

Records a per-seed behavior signature under the deterministic `greedy` policy. A diff means behavior
changed — **not** necessarily a regression: an intended fix shows up here too, which is how you
confirm a change moved exactly what you meant and nothing else. The committed baseline is
version-stamped; it records current behavior (bugs included) as the reference, not a claim of
correctness.

## Files

`prng.ts` seeded RNG · `decision.ts` valid decision answers · `policies.ts` move policies ·
`invariants.ts` per-step oracles · `driver.ts` the play loop · `fuzz.ts` CLI + report ·
`regression.ts` corpus. Nothing here modifies game logic; `sim/` is outside `tsconfig.json`'s
`include`, so it never affects `npm run build`.
