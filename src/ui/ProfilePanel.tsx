// Profile tab content (design: docs/PROFILE_STATS_SPEC.md). Self-contained: reads/writes the local
// profile through profile.ts and derives every stat through stats.ts, so SettingsMenu needs no new
// props. One local display name for now; the same records feed the Steam persona/cloud later.

import { useMemo, useRef, useState } from 'react'
import {
  clearGames,
  exportProfileJson,
  importProfileJson,
  loadProfile,
  setDisplayName,
  type GameRecord,
  type Profile,
} from './profile'
import {
  deriveStats,
  LOSS_REASON_LABELS,
  officialScoreSeries,
  personalRecords,
  progressScoreSeries,
  WIN_TIER_ORDER,
  type ScorePoint,
} from './stats'

/** Compact local date (e.g. "Jul 27"). */
function formatDay(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/** Round to one decimal without a trailing ".0". */
function num(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

export function ProfilePanel() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile())
  const [name, setName] = useState(profile.displayName)
  const [showProgress, setShowProgress] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const games = profile.games
  const stats = useMemo(() => deriveStats(games), [games])
  const records = useMemo(() => personalRecords(games), [games])

  const reload = () => setProfile(loadProfile())

  const commitName = () => {
    const trimmed = name.trim()
    setDisplayName(trimmed)
    setProfile((p) => ({ ...p, displayName: trimmed }))
  }

  const doExport = () => {
    try {
      const blob = new Blob([exportProfileJson()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `defy-profile-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('Exported your stats to a file.')
    } catch {
      setStatus('Could not export — your browser blocked the download.')
    }
  }

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    file
      .text()
      .then((text) => {
        const r = importProfileJson(text)
        if (r.ok) {
          reload()
          setName(loadProfile().displayName)
          setStatus(`Imported ${r.count} game${r.count === 1 ? '' : 's'}.`)
        } else {
          setStatus(r.reason)
        }
      })
      .catch(() => setStatus('Could not read that file.'))
  }

  const doClear = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    clearGames()
    reload()
    setConfirmClear(false)
    setStatus('Cleared your game history.')
  }

  return (
    <div className="settings-actions profile-panel">
      <div className="settings-scale">
        <label className="si-title" htmlFor="defy-player-name">
          Player name
        </label>
        <span className="si-sub">Local for now. On Steam this becomes your Steam name.</span>
        <input
          id="defy-player-name"
          className="seed-input"
          type="text"
          value={name}
          placeholder="Player"
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          aria-label="Player name"
        />
      </div>

      {games.length === 0 ? (
        <p className="profile-empty">No games yet. Finish a game and your stats will start here.</p>
      ) : (
        <>
          <div className="profile-tiles">
            <StatTile label="Games" value={String(stats.gamesPlayed)} />
            <StatTile label="Undefeated" value={`${Math.round(stats.undefeatedRate * 100)}%`} />
            <StatTile label="Best tier" value={stats.bestTier ?? '—'} />
            <StatTile label="Best VP" value={stats.bestPoints != null ? String(stats.bestPoints) : '—'} />
            <StatTile label="Avg VP" value={stats.avgPoints != null ? num(stats.avgPoints) : '—'} />
          </div>

          <div className="settings-scale">
            <div className="profile-chart-head">
              <span className="si-title">Score over time</span>
              <label className="profile-toggle">
                <input
                  type="checkbox"
                  checked={showProgress}
                  onChange={(e) => setShowProgress(e.target.checked)}
                />
                Include losses (progress VP)
              </label>
            </div>
            <ScoreChart games={games} showProgress={showProgress} />
            <span className="si-sub">
              Solid line: banked VP on wins. {showProgress ? 'Dashed line: how far every game got, losses included.' : ''}
            </span>
          </div>

          <div className="settings-scale">
            <span className="settings-group-label">Outcomes</span>
            <div className="profile-bars">
              {WIN_TIER_ORDER.map((t) => (
                <OutcomeRow key={t} label={t} count={stats.tierCounts[t] ?? 0} total={stats.gamesPlayed} tone="win" />
              ))}
              {Object.entries(stats.lossReasonCounts).map(([reason, count]) => (
                <OutcomeRow
                  key={reason}
                  label={`Loss — ${LOSS_REASON_LABELS[reason] ?? reason}`}
                  count={count}
                  total={stats.gamesPlayed}
                  tone="loss"
                />
              ))}
            </div>
          </div>

          <div className="settings-scale">
            <span className="settings-group-label">Personal records</span>
            <div className="profile-records">
              <RecordRow label="Highest VP" rec={records.highestVp} value={(g) => `${g.points ?? g.defeatedVp} VP`} />
              <RecordRow label="Best tier" rec={records.bestTier} value={(g) => g.tier ?? '—'} />
              <RecordRow label="Most missions" rec={records.mostMissions} value={(g) => `${g.missionsDefeated.length}`} />
              <RecordRow label="Longest game" rec={records.longestSurvival} value={(g) => `${g.round} rounds`} />
              <RecordRow label="Fastest win" rec={records.shortestWin} value={(g) => `${g.round} rounds`} />
              <RecordRow label="First Epic" rec={records.firstEpic} value={(g) => formatDay(g.playedAt)} />
              <RecordRow label="First Major" rec={records.firstMajor} value={(g) => formatDay(g.playedAt)} />
            </div>
          </div>

          <div className="settings-scale">
            <span className="settings-group-label">History</span>
            <div className="profile-history">
              {[...games]
                .reverse()
                .slice(0, 20)
                .map((g, i) => (
                  <HistoryRow key={games.length - i} rec={g} />
                ))}
            </div>
          </div>
        </>
      )}

      <div className="settings-scale">
        <span className="settings-group-label">Manage</span>
        <div className="scale-row">
          <button type="button" className="scale-opt" onClick={doExport} disabled={games.length === 0}>
            Export
          </button>
          <button type="button" className="scale-opt" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <button
            type="button"
            className={`scale-opt ${confirmClear ? 'danger' : ''}`}
            onClick={doClear}
            onBlur={() => setConfirmClear(false)}
            disabled={games.length === 0}
          >
            {confirmClear ? 'Click to confirm' : 'Clear stats'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
      </div>

      {status && <p className="si-sub profile-status">{status}</p>}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-tile">
      <span className="profile-tile-value">{value}</span>
      <span className="profile-tile-label">{label}</span>
    </div>
  )
}

function OutcomeRow({ label, count, total, tone }: { label: string; count: number; total: number; tone: 'win' | 'loss' }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div className="profile-bar-row">
      <span className="profile-bar-label">{label}</span>
      <span className="profile-bar-track">
        <span className={`profile-bar-fill ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="profile-bar-count">{count}</span>
    </div>
  )
}

function RecordRow({ label, rec, value }: { label: string; rec: GameRecord | null; value: (g: GameRecord) => string }) {
  return (
    <div className="profile-record-row">
      <span className="profile-record-label">{label}</span>
      {rec ? (
        <span className="profile-record-value">
          {value(rec)} <span className="profile-record-seed">· seed {rec.seed}</span>
        </span>
      ) : (
        <span className="profile-record-value muted">—</span>
      )}
    </div>
  )
}

function HistoryRow({ rec }: { rec: GameRecord }) {
  const outcome =
    rec.outcome === 'win' ? rec.tier ?? 'Win' : `Loss — ${LOSS_REASON_LABELS[rec.reason ?? ''] ?? 'defeat'}`
  const score = rec.outcome === 'win' ? `${rec.points ?? rec.defeatedVp} VP` : `${rec.defeatedVp} VP`
  return (
    <div className={`profile-history-row ${rec.outcome}`}>
      <span className="profile-history-when">{formatDay(rec.playedAt)}</span>
      <span className="profile-history-outcome">{outcome}</span>
      <span className="profile-history-score">{score}</span>
      <span className="profile-history-round">R{rec.round}</span>
    </div>
  )
}

// --- Score chart --------------------------------------------------------------------------------
// A small dependency-free SVG line chart. The solid line is official win VP (LOCKED 2 primary
// series); the optional dashed line is progress VP for every game. Faint guides mark the Minor /
// Victory / Major VP thresholds so a point's tier reads at a glance.

const CHART_W = 320
const CHART_H = 150
const PAD_L = 26
const PAD_R = 10
const PAD_T = 12
const PAD_B = 20
const THRESHOLDS: { vp: number; label: string }[] = [
  { vp: 15, label: 'Minor' },
  { vp: 19, label: 'Victory' },
  { vp: 22, label: 'Major' },
]

function ScoreChart({ games, showProgress }: { games: GameRecord[]; showProgress: boolean }) {
  const official = officialScoreSeries(games)
  const progress = progressScoreSeries(games)
  const n = games.length

  const maxValue = Math.max(25, ...official.map((p) => p.value), ...progress.map((p) => p.value))
  const plotW = CHART_W - PAD_L - PAD_R
  const plotH = CHART_H - PAD_T - PAD_B

  const x = (index: number) => (n <= 1 ? PAD_L + plotW / 2 : PAD_L + ((index - 1) / (n - 1)) * plotW)
  const y = (value: number) => PAD_T + plotH - (value / maxValue) * plotH

  const line = (pts: ScorePoint[]) => pts.map((p) => `${x(p.index)},${y(p.value)}`).join(' ')

  return (
    <svg className="score-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Score over time">
      {/* Y axis baseline */}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH} className="chart-axis" />
      <line x1={PAD_L} y1={PAD_T + plotH} x2={PAD_L + plotW} y2={PAD_T + plotH} className="chart-axis" />

      {/* VP tier guides */}
      {THRESHOLDS.filter((t) => t.vp <= maxValue).map((t) => (
        <g key={t.vp}>
          <line x1={PAD_L} y1={y(t.vp)} x2={PAD_L + plotW} y2={y(t.vp)} className="chart-guide" />
          <text x={PAD_L - 4} y={y(t.vp) + 3} className="chart-guide-label" textAnchor="end">
            {t.vp}
          </text>
        </g>
      ))}

      {/* Progress VP (all games) — optional dashed */}
      {showProgress && progress.length > 1 && <polyline points={line(progress)} className="chart-line progress" />}
      {showProgress &&
        progress.map((p) => <circle key={`pg-${p.index}`} cx={x(p.index)} cy={y(p.value)} r={2} className="chart-dot progress" />)}

      {/* Official win VP */}
      {official.length > 1 && <polyline points={line(official)} className="chart-line official" />}
      {official.map((p) => (
        <circle key={`of-${p.index}`} cx={x(p.index)} cy={y(p.value)} r={3} className="chart-dot official">
          <title>{`${p.tier ?? 'Win'} · ${p.value} VP`}</title>
        </circle>
      ))}
    </svg>
  )
}
