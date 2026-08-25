// Regression corpus: a change-detector, NOT a correctness oracle. It records how the current build
// behaves for a fixed band of seeds under the deterministic greedy policy (a per-seed "signature":
// outcome, rounds, steps, final phase, stub hits). Re-running on a later build and diffing surfaces
// every *behavioral change* for review — the class of bug that changes results without throwing.
//
// A diff is a prompt to look, not proof of a regression: an intended fix will show up here too, and
// that's the point — you confirm the change is the one you meant and nothing else moved.
//
//   npm run regress -- --capture     # write sim/corpus/baseline.json from the current build
//   npm run regress                  # check current build against the committed baseline
//
// The baseline is version-stamped; capturing v0.2.0 records current behavior (including the Celia/Antonio empty-pool rules fix) as the reference point.

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { playGame, type RunResult } from './driver'
import { greedyPolicy } from './policies'

const DEFAULT_SEEDS = 500
const STEP_CAP = 2000
const CORPUS = join(process.cwd(), 'sim', 'corpus')
const BASELINE = join(CORPUS, 'baseline.json')

interface Signature {
  outcome: string
  rounds: number
  steps: number
  finalPhase: string
  stub: string[]
  failed: boolean
}
interface Baseline {
  version: string
  createdAt: string
  policy: string
  stepCap: number
  seeds: Record<string, Signature>
}

function sig(r: RunResult): Signature {
  const outcome = !r.result
    ? `unfinished:${r.finalPhase}`
    : r.result.outcome === 'win'
      ? `win:${r.result.tier ?? 'Win'}`
      : `loss:${r.result.reason ?? 'loss'}`
  return {
    outcome,
    rounds: r.rounds,
    steps: r.steps,
    finalPhase: r.finalPhase,
    stub: [...r.stubEffects].sort(),
    failed: r.failures.length > 0,
  }
}

function version(): string {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version ?? '?'
  } catch {
    return '?'
  }
}

function run(count: number): Record<string, Signature> {
  const out: Record<string, Signature> = {}
  for (let seed = 1; seed <= count; seed++) out[String(seed)] = sig(playGame(seed, greedyPolicy, { stepCap: STEP_CAP }))
  return out
}

function eq(a: Signature, b: Signature): boolean {
  return (
    a.outcome === b.outcome &&
    a.rounds === b.rounds &&
    a.steps === b.steps &&
    a.finalPhase === b.finalPhase &&
    a.failed === b.failed &&
    a.stub.join(',') === b.stub.join(',')
  )
}

function main() {
  const argv = process.argv.slice(2)
  const capture = argv.includes('--capture')
  const countArg = argv.indexOf('--seeds')
  const count = countArg >= 0 ? Number(argv[countArg + 1]) : DEFAULT_SEEDS

  if (capture) {
    const baseline: Baseline = {
      version: version(),
      createdAt: new Date().toISOString(),
      policy: greedyPolicy.name,
      stepCap: STEP_CAP,
      seeds: run(count),
    }
    mkdirSync(CORPUS, { recursive: true })
    writeFileSync(BASELINE, JSON.stringify(baseline, null, 2))
    console.log(`[regress] captured ${Object.keys(baseline.seeds).length} seeds → ${BASELINE} (v${baseline.version})`)
    return
  }

  if (!existsSync(BASELINE)) {
    console.error(`[regress] no baseline at ${BASELINE}. Run: npm run regress -- --capture`)
    process.exit(2)
  }
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline
  const current = run(Object.keys(baseline.seeds).length)

  const changed: { seed: string; from: Signature; to: Signature }[] = []
  for (const [seed, before] of Object.entries(baseline.seeds)) {
    const after = current[seed]
    if (!after || !eq(before, after)) changed.push({ seed, from: before, to: after })
  }

  console.log(`[regress] baseline v${baseline.version} (${baseline.createdAt}) vs current v${version()}`)
  if (changed.length === 0) {
    console.log(`[regress] no behavioral change across ${Object.keys(baseline.seeds).length} seeds.`)
    return
  }
  console.log(`[regress] ${changed.length} seed(s) changed behavior — review each:`)
  for (const c of changed.slice(0, 50)) {
    const d = (s: Signature) => `${s.outcome} r${s.rounds}/s${s.steps}${s.failed ? ' FAIL' : ''}${s.stub.length ? ' stub[' + s.stub.join(',') + ']' : ''}`
    console.log(`  seed ${c.seed}: ${d(c.from)}  →  ${d(c.to)}   (reproduce: npm run fuzz -- --seed ${c.seed} --policy greedy)`)
  }
  if (changed.length > 50) console.log(`  …and ${changed.length - 50} more.`)
  process.exit(1)
}

main()
