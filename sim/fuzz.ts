// Tier-1 fuzzer CLI. Self-plays N seeds under one or more policies, aggregates crashes / softlocks
// / invariant breaks / non-termination / [stub] hits plus balance telemetry, and writes a JSON
// (machine) + Markdown (human) report to sim/reports/, stamped with the build version and time.
//
//   npm run fuzz                          # defaults: 2000 seeds, both policies
//   npm run fuzz -- --seeds 5000          # more coverage
//   npm run fuzz -- --policy greedy       # one policy
//   npm run fuzz -- --seed 12345          # reproduce a single seed (deterministic)
//
// A finding reproduces from its seed + policy alone (the fuzzer's own choices are seeded).

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { playGame, type RunResult, type Failure } from './driver'
import { POLICIES, type NamedPolicy } from './policies'

interface Args {
  seeds: number
  start: number
  policies: NamedPolicy[]
  stepCap: number
  salt: number
  single: number | null
  outDir: string
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const policyArg = get('--policy') ?? 'both'
  const policies =
    policyArg === 'both'
      ? [POLICIES.random, POLICIES.greedy]
      : [POLICIES[policyArg]].filter(Boolean)
  if (policies.length === 0) throw new Error(`unknown --policy ${policyArg} (use random|greedy|both)`)
  const single = get('--seed')
  return {
    seeds: Number(get('--seeds') ?? 2000),
    start: Number(get('--start') ?? 1),
    policies,
    stepCap: Number(get('--step-cap') ?? 2000),
    salt: Number(get('--salt') ?? 0),
    single: single !== undefined ? Number(single) : null,
    outDir: get('--out') ?? join(process.cwd(), 'sim', 'reports'),
  }
}

function appVersion(): string {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version ?? '?'
  } catch {
    return '?'
  }
}

function repro(r: RunResult, stepCap: number): string {
  return `npm run fuzz -- --seed ${r.seed} --policy ${r.policy} --step-cap ${stepCap}`
}

function failLabel(f: Failure): string {
  switch (f.type) {
    case 'crash':
      return `crash @step ${f.step}: ${f.message}`
    case 'softlock':
      return `softlock @step ${f.step} in ${f.phase}`
    case 'invariant':
      return `invariant @step ${f.step} in ${f.phase}: ${f.violations.map((v) => `${v.kind}(${v.detail})`).join('; ')}`
    case 'nontermination':
      return `non-termination (hit step cap ${f.stepCap})`
  }
}

interface Stats {
  count: number
  min: number
  max: number
  mean: number
}
function stats(xs: number[]): Stats {
  if (xs.length === 0) return { count: 0, min: 0, max: 0, mean: 0 }
  const sum = xs.reduce((a, b) => a + b, 0)
  return { count: xs.length, min: Math.min(...xs), max: Math.max(...xs), mean: +(sum / xs.length).toFixed(2) }
}

function outcomeKey(r: RunResult): string {
  if (!r.result) return `unfinished:${r.finalPhase}`
  if (r.result.outcome === 'win') return `win:${r.result.tier ?? 'Win'}`
  return `loss:${r.result.reason ?? 'loss'}`
}

function tally(keys: string[]): [string, number][] {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const version = appVersion()
  const startedAt = new Date()

  const seedList = args.single !== null ? [args.single] : Array.from({ length: args.seeds }, (_, i) => args.start + i)

  const runs: RunResult[] = []
  for (const policy of args.policies) {
    for (const seed of seedList) {
      runs.push(playGame(seed, policy, { stepCap: args.stepCap, salt: args.salt }))
    }
  }

  // --- Aggregate ---
  const failing = runs.filter((r) => r.failures.length > 0)
  const crashes = failing.filter((r) => r.failures.some((f) => f.type === 'crash'))
  const softlocks = failing.filter((r) => r.failures.some((f) => f.type === 'softlock'))
  const invariants = failing.filter((r) => r.failures.some((f) => f.type === 'invariant'))
  const nonterm = failing.filter((r) => r.failures.some((f) => f.type === 'nontermination'))

  const stubMap = new Map<string, RunResult>()
  for (const r of runs) for (const e of r.stubEffects) if (!stubMap.has(e)) stubMap.set(e, r)

  const finished = runs.filter((r) => r.result)
  const balanceByPolicy = args.policies.map((p) => {
    const rs = runs.filter((r) => r.policy === p.name)
    return {
      policy: p.name,
      outcomes: tally(rs.map(outcomeKey)),
      rounds: stats(rs.map((r) => r.rounds)),
      steps: stats(rs.map((r) => r.steps)),
    }
  })

  const summary = {
    version,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    config: { seeds: seedList.length, start: args.start, policies: args.policies.map((p) => p.name), stepCap: args.stepCap, salt: args.salt },
    totals: {
      runs: runs.length,
      finished: finished.length,
      failing: failing.length,
      crashes: crashes.length,
      softlocks: softlocks.length,
      invariants: invariants.length,
      nontermination: nonterm.length,
      stubEffects: stubMap.size,
    },
  }

  // --- Machine report ---
  const json = {
    ...summary,
    findings: {
      crashes: crashes.map((r) => ({ seed: r.seed, policy: r.policy, failures: r.failures, trace: r.trace })),
      softlocks: softlocks.map((r) => ({ seed: r.seed, policy: r.policy, failures: r.failures, trace: r.trace })),
      invariants: invariants.map((r) => ({ seed: r.seed, policy: r.policy, failures: r.failures, trace: r.trace })),
      nontermination: nonterm.map((r) => ({ seed: r.seed, policy: r.policy, failures: r.failures })),
      stubEffects: [...stubMap.entries()].map(([effectId, r]) => ({ effectId, exampleSeed: r.seed, policy: r.policy })),
    },
    balanceByPolicy,
  }

  // --- Human report ---
  const L: string[] = []
  L.push(`# DEFY! fuzz report — v${version}`)
  L.push('')
  L.push(`Run ${startedAt.toISOString()} · ${summary.durationMs} ms · ${runs.length} games ` + `(${seedList.length} seeds × ${args.policies.length} ${args.policies.length === 1 ? 'policy' : 'policies'}, step cap ${args.stepCap})`)
  L.push('')
  L.push('## Headline')
  L.push('')
  L.push(`- **${crashes.length}** crashes · **${softlocks.length}** softlocks · **${invariants.length}** invariant breaks · **${nonterm.length}** non-terminating`)
  L.push(`- **${stubMap.size}** unimplemented effect(s) hit the \`[stub]\` path`)
  L.push(`- ${finished.length}/${runs.length} games reached an ending`)
  L.push('')

  const section = (title: string, rs: RunResult[]) => {
    L.push(`## ${title} (${rs.length})`)
    L.push('')
    if (rs.length === 0) {
      L.push('_None._')
      L.push('')
      return
    }
    for (const r of rs.slice(0, 100)) {
      const labels = r.failures.map(failLabel).join(' · ')
      L.push(`- **seed ${r.seed}** (${r.policy}) — ${labels}`)
      L.push(`  - reproduce: \`${repro(r, args.stepCap)}\``)
    }
    if (rs.length > 100) L.push(`- …and ${rs.length - 100} more (see JSON).`)
    L.push('')
  }
  section('Crashes', crashes)
  section('Softlocks', softlocks)
  section('Invariant breaks', invariants)
  section('Non-termination', nonterm)

  L.push(`## Unimplemented effects — \`[stub]\` hits (${stubMap.size})`)
  L.push('')
  if (stubMap.size === 0) L.push('_None — every effect that fired has a handler._')
  else {
    L.push('These effects fired during play but have no registered handler (silently skipped in-game — the Sagrario/Ramona bug class):')
    L.push('')
    for (const [effectId, r] of stubMap) L.push(`- \`${effectId}\` — first seen seed ${r.seed} (${r.policy})`)
  }
  L.push('')

  L.push('## Balance telemetry')
  L.push('')
  for (const b of balanceByPolicy) {
    L.push(`### Policy: ${b.policy}`)
    L.push('')
    L.push(`Rounds — min ${b.rounds.min} / mean ${b.rounds.mean} / max ${b.rounds.max} · Steps — mean ${b.steps.mean} / max ${b.steps.max}`)
    L.push('')
    L.push('| Outcome | Games |')
    L.push('|---|---|')
    for (const [k, n] of b.outcomes) L.push(`| ${k} | ${n} |`)
    L.push('')
  }

  // --- Write ---
  mkdirSync(args.outDir, { recursive: true })
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const base = `report-${version}-${stamp}`
  writeFileSync(join(args.outDir, `${base}.json`), JSON.stringify(json, null, 2))
  writeFileSync(join(args.outDir, `${base}.md`), L.join('\n'))
  writeFileSync(join(args.outDir, 'report-latest.json'), JSON.stringify(json, null, 2))
  writeFileSync(join(args.outDir, 'report-latest.md'), L.join('\n'))

  // --- Console ---
  console.log(
    `[fuzz] v${version}: ${runs.length} games in ${summary.durationMs}ms — ` +
      `crashes=${crashes.length} softlocks=${softlocks.length} invariants=${invariants.length} ` +
      `nonterm=${nonterm.length} stub=${stubMap.size}`,
  )
  console.log(`[fuzz] report → ${join(args.outDir, base + '.md')}`)
  const exitBad = crashes.length + softlocks.length + invariants.length + nonterm.length + stubMap.size
  process.exit(exitBad > 0 ? 1 : 0)
}

main()
