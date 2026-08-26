// Pure career derivations over GameRecord[] (design: docs/PROFILE_STATS_SPEC.md). No persistence,
// no React — just functions the Profile screen calls at read time. Two scoring rules from LOCKED 2
// are enforced here so every chart/aggregate stays honest:
//   Trap A — a loss has no official score. The "score" series/aggregates use official win points;
//            a separate progress-VP series (defeatedVp, all games) shows how far a loss got.
//   Trap B — Draw is a win. "Undefeated rate" = share of games that ended undefeated (Draw incl.);
//            tier quality is a separate breakdown. Epic is a completion trophy, not a VP record.

import type { GameRecord } from './profile'

/** Win tiers low → high. Index doubles as the tier "level" for best-tier comparisons. */
export const WIN_TIER_ORDER = ['Draw', 'Minor Victory', 'Victory', 'Major Victory', 'Epic Victory'] as const
export type WinTierName = (typeof WIN_TIER_ORDER)[number]

/** Loss reasons, in the order the outcome strip lists them. */
export const LOSS_REASONS = ['civilians', 'missions', 'spies'] as const
export const LOSS_REASON_LABELS: Record<string, string> = {
  civilians: 'Civilians',
  missions: 'Failed missions',
  spies: 'All-Spy hand',
}

/** Tier rank (0..4), or -1 for an unknown/absent tier. */
export function tierLevel(tier?: string): number {
  return tier ? WIN_TIER_ORDER.indexOf(tier as WinTierName) : -1
}

/** The official score of a win: its banked points, falling back to defeatedVp if points is missing. */
function officialPoints(g: GameRecord): number {
  return g.points ?? g.defeatedVp
}

export interface CareerStats {
  gamesPlayed: number
  wins: number // ended undefeated (Draw included)
  losses: number
  undefeatedRate: number // wins / gamesPlayed, 0 when no games
  bestPoints: number | null // max official win VP
  avgPoints: number | null // mean official win VP
  bestTier: string | null // highest tier reached
  tierCounts: Record<string, number> // one entry per WIN_TIER_ORDER
  lossReasonCounts: Record<string, number> // one entry per LOSS_REASONS
}

export function deriveStats(games: GameRecord[]): CareerStats {
  const wins = games.filter((g) => g.outcome === 'win')
  const winPts = wins.map(officialPoints)
  const gamesPlayed = games.length

  const tierCounts: Record<string, number> = Object.fromEntries(WIN_TIER_ORDER.map((t) => [t, 0]))
  let bestTier: string | null = null
  let bestLevel = -1
  for (const g of wins) {
    const t = g.tier ?? 'Draw'
    if (t in tierCounts) tierCounts[t] += 1
    const lvl = tierLevel(t)
    if (lvl > bestLevel) {
      bestLevel = lvl
      bestTier = t
    }
  }

  const lossReasonCounts: Record<string, number> = Object.fromEntries(LOSS_REASONS.map((r) => [r, 0]))
  for (const g of games) {
    if (g.outcome === 'loss' && g.reason && g.reason in lossReasonCounts) lossReasonCounts[g.reason] += 1
  }

  return {
    gamesPlayed,
    wins: wins.length,
    losses: gamesPlayed - wins.length,
    undefeatedRate: gamesPlayed ? wins.length / gamesPlayed : 0,
    bestPoints: winPts.length ? Math.max(...winPts) : null,
    avgPoints: winPts.length ? winPts.reduce((a, b) => a + b, 0) / winPts.length : null,
    bestTier,
    tierCounts,
    lossReasonCounts,
  }
}

/** One plotted point. `index` is the chronological game number (1-based), shared by both series so
 *  a loss shows as a gap in the official line but a point in the progress line. */
export interface ScorePoint {
  index: number
  playedAt: number
  value: number
  outcome: 'win' | 'loss'
  tier?: string
}

/** Primary series: official win VP, one point per win (losses omitted). */
export function officialScoreSeries(games: GameRecord[]): ScorePoint[] {
  const out: ScorePoint[] = []
  games.forEach((g, i) => {
    if (g.outcome === 'win') {
      out.push({ index: i + 1, playedAt: g.playedAt, value: officialPoints(g), outcome: 'win', tier: g.tier })
    }
  })
  return out
}

/** Secondary (opt-in) series: progress VP for every game — how far each run got, losses included. */
export function progressScoreSeries(games: GameRecord[]): ScorePoint[] {
  return games.map((g, i) => ({
    index: i + 1,
    playedAt: g.playedAt,
    value: g.defeatedVp,
    outcome: g.outcome,
    tier: g.tier,
  }))
}

export interface PersonalRecords {
  highestVp: GameRecord | null // best official win VP
  bestTier: GameRecord | null // highest tier (tiebreak: more points)
  mostMissions: GameRecord | null // most missions defeated in one game
  longestSurvival: GameRecord | null // most rounds reached
  shortestWin: GameRecord | null // fewest rounds among wins
  bestLossProgress: GameRecord | null // highest defeatedVp on a loss
  firstEpic: GameRecord | null // earliest Epic Victory
  firstMajor: GameRecord | null // earliest Major Victory
}

/** Pick the record maximizing `score` (nullable score skips the record); ties keep the earlier game. */
function bestBy(games: GameRecord[], score: (g: GameRecord) => number | null): GameRecord | null {
  let best: GameRecord | null = null
  let bestScore = -Infinity
  for (const g of games) {
    const s = score(g)
    if (s === null) continue
    if (s > bestScore) {
      bestScore = s
      best = g
    }
  }
  return best
}

/** Earliest game (by playedAt) matching a predicate. */
function firstMatch(games: GameRecord[], pred: (g: GameRecord) => boolean): GameRecord | null {
  let first: GameRecord | null = null
  for (const g of games) {
    if (!pred(g)) continue
    if (!first || g.playedAt < first.playedAt) first = g
  }
  return first
}

export function personalRecords(games: GameRecord[]): PersonalRecords {
  const wins = games.filter((g) => g.outcome === 'win')
  return {
    highestVp: bestBy(wins, (g) => officialPoints(g)),
    bestTier: bestBy(wins, (g) => tierLevel(g.tier) * 1000 + officialPoints(g)),
    mostMissions: bestBy(games, (g) => g.missionsDefeated.length),
    longestSurvival: bestBy(games, (g) => g.round),
    shortestWin: bestBy(wins, (g) => -g.round),
    bestLossProgress: bestBy(
      games.filter((g) => g.outcome === 'loss'),
      (g) => g.defeatedVp,
    ),
    firstEpic: firstMatch(wins, (g) => g.tier === 'Epic Victory'),
    firstMajor: firstMatch(wins, (g) => g.tier === 'Major Victory'),
  }
}
