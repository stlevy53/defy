// Tier-2 live UI/UX harness. Drives the REAL app over the Chrome DevTools Protocol — no browser
// download: Electron already embeds Chromium, so `electron . --remote-debugging-port=9222` exposes a
// CDP endpoint we attach to. (A plain Chrome tab on the Vite dev server works identically.)
//
// For a set of seeds it: forces the seed via window.__defy, plays the game through using the SAME
// decision/policy logic as the Tier-1 fuzzer, screenshots every phase transition, captures console
// errors + uncaught exceptions, and runs light DOM-vs-state checks — then writes PNGs + a findings
// JSON to sim/live/out/ for a human (or Claude) UX read.
//
//   1) start the app with a debugging port:
//        npm run build && npx electron . --remote-debugging-port=9222        (packaged-style)
//        # or, fastest iteration:  VITE_DEFY_DEBUG unnecessary in dev →  npm run dev   (then point --url at it)
//   2) run the harness:
//        npm run tier2 -- --seeds 1,2,3 --policy greedy
//        npm run tier2 -- --url http://localhost:5173 --seeds 5 --start 1     (dev server)
//
// The hook (window.__defy) only exists in dev builds or a `VITE_DEFY_DEBUG=1` build, so this never
// touches a normal release.

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import CDP from 'chrome-remote-interface'
import type { Action, GameState } from '../../src/engine'
import { mulberry32 } from '../prng'
import { autoSelect } from '../decision'
import { POLICIES, type NamedPolicy } from '../policies'

interface Args {
  port: number
  url: string | null
  seeds: number[]
  policy: NamedPolicy
  stepCap: number
  settleMs: number
  outDir: string
  shots: 'phases' | 'all' | 'none'
}

function parseArgs(argv: string[]): Args {
  const get = (f: string) => {
    const i = argv.indexOf(f)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const seedsArg = get('--seeds') ?? '5'
  let seeds: number[]
  if (seedsArg.includes(',')) seeds = seedsArg.split(',').map((s) => Number(s.trim()))
  else {
    const n = Number(seedsArg)
    const start = Number(get('--start') ?? 1)
    seeds = Array.from({ length: n }, (_, i) => start + i)
  }
  const policyName = get('--policy') ?? 'greedy'
  const policy = POLICIES[policyName]
  if (!policy) throw new Error(`unknown --policy ${policyName} (random | greedy)`)
  return {
    port: Number(get('--port') ?? 9222),
    url: get('--url') ?? null,
    seeds,
    policy,
    stepCap: Number(get('--step-cap') ?? 2000),
    settleMs: Number(get('--settle-ms') ?? 60),
    outDir: get('--out') ?? join(process.cwd(), 'sim', 'live', 'out'),
    shots: (get('--shots') as Args['shots']) ?? 'phases',
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface ConsoleFinding {
  seed: number | null
  phase: string | null
  level: string
  text: string
}
interface SeedResult {
  seed: number
  policy: string
  steps: number
  rounds: number
  finalPhase: string
  result: GameState['result']
  screenshots: string[]
  domChecks: { ok: boolean; detail: string }[]
  dispatchRejections: { step: number; action: Action; error: string | null }[]
  softlock: boolean
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  mkdirSync(args.outDir, { recursive: true })

  let client: CDP.Client
  try {
    client = await CDP({ port: args.port })
  } catch (e) {
    console.error(
      `[tier2] could not connect to a CDP endpoint on port ${args.port}.\n` +
        `        Start the app first, e.g.:  npx electron . --remote-debugging-port=${args.port}\n` +
        `        or run the dev server and pass --url http://localhost:5173\n` +
        `        (${(e as Error).message})`,
    )
    process.exit(2)
  }

  const { Page, Runtime } = client
  await Page.enable()
  await Runtime.enable()

  // --- Console + exception capture (spans the whole run; tagged with current seed/phase) ---
  const consoleFindings: ConsoleFinding[] = []
  let curSeed: number | null = null
  let curPhase: string | null = null
  Runtime.consoleAPICalled(({ type, args: a }) => {
    if (type === 'error' || type === 'warning' || type === 'assert') {
      const text = a.map((x) => x.value ?? x.description ?? x.type).join(' ')
      consoleFindings.push({ seed: curSeed, phase: curPhase, level: type, text })
    }
  })
  Runtime.exceptionThrown(({ exceptionDetails }) => {
    consoleFindings.push({
      seed: curSeed,
      phase: curPhase,
      level: 'exception',
      text: exceptionDetails.exception?.description ?? exceptionDetails.text,
    })
  })

  async function evaluate<T>(expression: string): Promise<T> {
    const { result, exceptionDetails } = await Runtime.evaluate({
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    }
    return result.value as T
  }

  if (args.url) {
    await Page.navigate({ url: args.url })
    await Page.loadEventFired()
    await sleep(500)
  }

  // Preflight: the dev hook must be present.
  // Dismiss any launch overlay (the "What's New" modal shows on every open) so it doesn't obscure
  // the board in screenshots.
  // Expressions here run in the page as plain JavaScript — no TypeScript syntax (a cast compiles
  // fine inside this template string, then throws a SyntaxError at runtime).
  const dismissModals = async () => {
    await evaluate(
      `Array.from(document.querySelectorAll('[aria-label="Dismiss"]')).forEach((b) => b.click())`,
    )
  }

  const ready = await evaluate<boolean>(`!!(window.__defy && window.__defy.enabled)`)
  if (!ready) {
    console.error(
      `[tier2] window.__defy not found — the page isn't a hook-enabled build.\n` +
        `        Use the dev server (npm run dev) or build with VITE_DEFY_DEBUG=1.`,
    )
    await client.close()
    process.exit(3)
  }

  const results: SeedResult[] = []

  for (const seed of args.seeds) {
    curSeed = seed
    await evaluate(`window.__defy.newGame(${seed})`)
    await sleep(args.settleMs)
    await dismissModals()

    const rng = mulberry32(seed >>> 0)
    let state = await evaluate<GameState>(`window.__defy.getState()`)
    curPhase = state.phase
    const screenshots: string[] = []
    const domChecks: SeedResult['domChecks'] = []
    const dispatchRejections: SeedResult['dispatchRejections'] = []
    let softlock = false

    const shoot = async (tag: string) => {
      if (args.shots === 'none') return
      const { data } = await Page.captureScreenshot({ format: 'png' })
      const file = `seed-${seed}-${tag}.png`
      writeFileSync(join(args.outDir, file), Buffer.from(data, 'base64'))
      screenshots.push(file)
    }
    // Light DOM-vs-state oracle: the app rendered *something* and didn't white-screen.
    const domCheck = async () => {
      const childCount = await evaluate<number>(`document.getElementById('root')?.childElementCount ?? 0`)
      domChecks.push({ ok: childCount > 0, detail: `#root children=${childCount} phase=${state.phase}` })
    }

    await shoot(`r${state.round}-${state.phase}-s0-start`)
    await domCheck()

    let steps = 0
    for (; steps < args.stepCap; steps++) {
      if (state.result) break

      const before = await evaluate<number>(`window.__defy.getStep()`)
      if (state.pendingDecision) {
        const selection = autoSelect(state.pendingDecision, rng)
        await evaluate(`window.__defy.resolve(${JSON.stringify(selection)})`)
      } else {
        const acts = await evaluate<Action[]>(`window.__defy.legalActions()`)
        if (acts.length === 0) {
          softlock = true
          await shoot(`r${state.round}-${state.phase}-s${steps}-SOFTLOCK`)
          break
        }
        const action = args.policy.choose(state, acts, rng)
        await evaluate(`window.__defy.dispatch(${JSON.stringify(action)})`)
        await sleep(args.settleMs)
        const after = await evaluate<number>(`window.__defy.getStep()`)
        if (after === before) {
          // The UI swallowed the move — engine rejected it though the harness believed it legal.
          const err = await evaluate<string | null>(`window.__defy.getError()`)
          dispatchRejections.push({ step: steps, action, error: err })
        }
      }
      await sleep(args.settleMs)

      const prev = state
      state = await evaluate<GameState>(`window.__defy.getState()`)
      curPhase = state.phase

      const phaseChanged = state.phase !== prev.phase || state.round !== prev.round
      if (args.shots === 'all' || (args.shots === 'phases' && phaseChanged)) {
        await shoot(`r${state.round}-${state.phase}-s${steps}`)
        await domCheck()
      }
      if (state.pendingDecision && args.shots !== 'none') {
        await shoot(`r${state.round}-${state.phase}-s${steps}-decision`)
      }
    }

    await shoot(`r${state.round}-${state.phase}-s${steps}-end`)
    await domCheck()

    results.push({
      seed,
      policy: args.policy.name,
      steps,
      rounds: state.round,
      finalPhase: state.phase,
      result: state.result,
      screenshots,
      domChecks,
      dispatchRejections,
      softlock,
    })
    console.log(
      `[tier2] seed ${seed}: ${steps} steps, ${state.round} rounds, ${state.phase}, ` +
        `${state.result ? (state.result.outcome + (state.result.tier ? '/' + state.result.tier : '')) : 'unfinished'}, ` +
        `${screenshots.length} shots${softlock ? ', SOFTLOCK' : ''}${dispatchRejections.length ? ', ' + dispatchRejections.length + ' rejections' : ''}`,
    )
  }

  await client.close()

  const report = {
    generatedAt: new Date().toISOString(),
    config: { port: args.port, url: args.url, policy: args.policy.name, seeds: args.seeds, stepCap: args.stepCap },
    consoleFindings,
    results,
    totals: {
      seeds: results.length,
      softlocks: results.filter((r) => r.softlock).length,
      dispatchRejections: results.reduce((n, r) => n + r.dispatchRejections.length, 0),
      whiteScreens: results.reduce((n, r) => n + r.domChecks.filter((d) => !d.ok).length, 0),
      consoleErrors: consoleFindings.length,
      screenshots: results.reduce((n, r) => n + r.screenshots.length, 0),
    },
  }
  writeFileSync(join(args.outDir, 'tier2-findings.json'), JSON.stringify(report, null, 2))
  console.log(
    `[tier2] done — ${report.totals.seeds} seeds, ${report.totals.screenshots} screenshots, ` +
      `${report.totals.consoleErrors} console errors, ${report.totals.softlocks} softlocks, ` +
      `${report.totals.dispatchRejections} rejections, ${report.totals.whiteScreens} white-screens`,
  )
  console.log(`[tier2] output → ${args.outDir}`)
  const bad =
    report.totals.softlocks + report.totals.dispatchRejections + report.totals.whiteScreens + report.totals.consoleErrors
  process.exit(bad > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('[tier2] fatal:', (e as Error).message)
  process.exit(1)
})
