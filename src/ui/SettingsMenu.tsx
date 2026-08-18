// Settings modal: opened by the cog in the top bar or the Escape key. Holds the three game-management
// actions — New game, Save game, Load game — plus the first-run coach replay, the board-size control,
// and mute / volume. Save/load are thin wrappers over useGame's localStorage helpers; board size is
// a thin wrapper over useUiScale.

import { useState } from 'react'
import type { SaveMeta, SaveResult, LoadResult } from './useGame'
import { UI_SCALES } from './useUiScale'
import type { UiScale } from './useUiScale'
import { isDraftPromptEnabled, setDraftPromptEnabled } from './draftPref'
import { getVolume, isMuted, playSfx, setMuted, setVolume, unlock } from './audio'

interface Props {
  onClose: () => void
  onNewGame: () => void
  /** Start a new game from a specific seed (reproduce a deal). */
  onPlaySeed: (seed: number) => void
  onSave: () => SaveResult
  onLoad: () => LoadResult
  savedMeta: SaveMeta | null
  appVersion: string
  ui: UiScale
  /** Close Settings and run the first-run table tour. */
  onReplayCoach: () => void
}

/** Compact local date+time for the save's timestamp (e.g. "Jul 27, 2:14 PM"). */
function formatWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return 'saved'
  }
}

type Status = { tone: 'ok' | 'warn' | 'err'; text: string }

export function SettingsMenu({ onClose, onNewGame, onPlaySeed, onSave, onLoad, savedMeta, appVersion, ui, onReplayCoach }: Props) {
  const [status, setStatus] = useState<Status | null>(null)
  // Track the save locally so the Load button + description update the moment a save is written.
  const [meta, setMeta] = useState<SaveMeta | null>(savedMeta)
  const [seedEntry, setSeedEntry] = useState('')
  const [askDraft, setAskDraft] = useState(isDraftPromptEnabled)
  const [muted, setMutedUi] = useState(isMuted)
  const [volume, setVolumeUi] = useState(getVolume)

  const handleNew = () => {
    onNewGame()
    onClose()
  }

  const handlePlaySeed = () => {
    const n = Number.parseInt(seedEntry.trim(), 10)
    if (Number.isFinite(n)) {
      onPlaySeed(n)
      onClose()
    }
  }

  const handleSave = () => {
    const r = onSave()
    if (r.ok) {
      setMeta({ version: appVersion, savedAt: Date.now() })
      setStatus(
        r.truncated
          ? { tone: 'warn', text: 'Saved — the game was long, so undo history was trimmed to fit.' }
          : { tone: 'ok', text: 'Game saved. You can close and resume it later.' },
      )
    } else {
      setStatus({ tone: 'err', text: r.reason })
    }
  }

  const handleLoad = () => {
    const r = onLoad()
    if (r.ok) {
      onClose() // reveal the restored board
    } else {
      setStatus({ tone: 'err', text: r.reason })
    }
  }

  const loadSub = meta
    ? `Resume your saved game (v${meta.version}, ${formatWhen(meta.savedAt)}).${
        meta.version !== appVersion ? ' From a different build — should still load.' : ''
      }`
    : 'No saved game yet.'

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="settings-panel">
        <button className="whatsnew-x" onClick={onClose} aria-label="Close settings">
          ✕
        </button>
        <h2 className="settings-title">Settings</h2>

        <div className="settings-actions">
          <button className="settings-item" onClick={handleNew}>
            <span className="si-title">New game</span>
            <span className="si-sub">Start a fresh game. Discards the current one.</span>
          </button>
          <div className="settings-seed">
            <span className="si-sub">Or start from a specific seed (reproduce a deal):</span>
            <div className="settings-seed-row">
              <input
                className="seed-input"
                type="text"
                inputMode="numeric"
                value={seedEntry}
                placeholder="seed…"
                onChange={(e) => setSeedEntry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePlaySeed()
                }}
                aria-label="Seed to start a new game from"
              />
              <button className="ghost" onClick={handlePlaySeed} disabled={seedEntry.trim() === ''}>
                Start
              </button>
            </div>
          </div>
          <button className="settings-item" onClick={handleSave}>
            <span className="si-title">Save game</span>
            <span className="si-sub">Store this game so you can pick it up later.</span>
          </button>
          <button className="settings-item" onClick={handleLoad} disabled={!meta}>
            <span className="si-title">Load game</span>
            <span className="si-sub">{loadSub}</span>
          </button>
          <button className="settings-item" onClick={onReplayCoach}>
            <span className="si-title">How to play this table</span>
            <span className="si-sub">A short tour of the controls. You can skip it any time.</span>
          </button>
          <div className="settings-scale">
            <span className="si-title">Board size</span>
            <span className="si-sub">
              Scales the whole table — cards, text and the deck rail together. Ctrl&nbsp;+ and
              Ctrl&nbsp;− adjust it any time; Ctrl&nbsp;0 returns to 100%.
            </span>
            <div className="scale-row" role="group" aria-label="Board size">
              {UI_SCALES.map((s) => (
                <button
                  key={s}
                  className={`scale-opt ${s === ui.scale ? 'active' : ''}`}
                  onClick={() => ui.setScale(s)}
                  aria-pressed={s === ui.scale}
                >
                  {Math.round(s * 100)}%
                </button>
              ))}
            </div>
            <span className="si-sub">Bigger cards mean more scrolling — pick what reads best.</span>
          </div>
          <div className="settings-scale">
            <span className="si-title">Draft setup</span>
            <span className="si-sub">
              At the start of a new game, ask whether to pick your Hidden deck two cards at a time.
              Turn this off to always deal at random.
            </span>
            <div className="scale-row" role="group" aria-label="Draft setup">
              <button
                type="button"
                className={`scale-opt ${askDraft ? 'active' : ''}`}
                onClick={() => {
                  setAskDraft(true)
                  setDraftPromptEnabled(true)
                }}
                aria-pressed={askDraft}
              >
                Ask each game
              </button>
              <button
                type="button"
                className={`scale-opt ${!askDraft ? 'active' : ''}`}
                onClick={() => {
                  setAskDraft(false)
                  setDraftPromptEnabled(false)
                }}
                aria-pressed={!askDraft}
              >
                Off — random deal
              </button>
            </div>
          </div>
          <div className="settings-scale">
            <span className="si-title">Sound</span>
            <span className="si-sub">
              Card flip when anything moves on the table, a sting when you choose a Mission to
              attack, a gunshot when you defeat an Enemy, a knife when a Spy leaves, and an
              explosion when a Mission falls. On by default; mute is one click away. Remembered
              between sessions.
            </span>
            <div className="scale-row" role="group" aria-label="Sound">
              <button
                type="button"
                className={`scale-opt ${!muted ? 'active' : ''}`}
                onClick={() => {
                  unlock()
                  setMuted(false)
                  setMutedUi(false)
                  playSfx('play')
                }}
                aria-pressed={!muted}
              >
                On
              </button>
              <button
                type="button"
                className={`scale-opt ${muted ? 'active' : ''}`}
                onClick={() => {
                  setMuted(true)
                  setMutedUi(true)
                }}
                aria-pressed={muted}
              >
                Mute
              </button>
            </div>
            <div className="volume-row">
              <label className="si-sub" htmlFor="defy-volume">
                Volume
              </label>
              <input
                id="defy-volume"
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                disabled={muted}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(volume * 100)}
                aria-label="Volume"
                onChange={(e) => {
                  const v = Number(e.target.value) / 100
                  setVolume(v)
                  setVolumeUi(v)
                }}
              />
              <span className="volume-pct">{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>

        {status && <p className={`settings-status ${status.tone}`}>{status.text}</p>}
      </div>
    </div>
  )
}
