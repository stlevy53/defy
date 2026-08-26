// Settings modal: opened by the cog in the top bar or the Escape key. Organized into three tabs so it
// stays short as more settings land: Game (New game + seed, Save, Load), Options (Table: board size +
// draft; Sound: mute + volume) and Help (coach replay, What's New). Always opens on Game; the tab isn't
// persisted. Save/load are thin wrappers over useGame's localStorage helpers; board size is a thin
// wrapper over useUiScale. The save/load status sits below the pane so it survives a tab switch.

import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { SaveMeta, SaveResult, LoadResult } from './useGame'
import { UI_SCALES } from './useUiScale'
import type { UiScale } from './useUiScale'
import { isDraftPromptEnabled, setDraftPromptEnabled } from './draftPref'
import { getVolume, isMuted, playSfx, setMuted, setVolume, unlock } from './audio'
import { ProfilePanel } from './ProfilePanel'

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
  /** Close Settings and open the "What's New" modal for this build. */
  onShowWhatsNew: () => void
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

type TabId = 'game' | 'profile' | 'options' | 'help'

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'game', label: 'Game' },
  { id: 'profile', label: 'Profile' },
  { id: 'options', label: 'Options' },
  { id: 'help', label: 'Help' },
]

export function SettingsMenu({
  onClose,
  onNewGame,
  onPlaySeed,
  onSave,
  onLoad,
  savedMeta,
  appVersion,
  ui,
  onReplayCoach,
  onShowWhatsNew,
}: Props) {
  const [status, setStatus] = useState<Status | null>(null)
  // Track the save locally so the Load button + description update the moment a save is written.
  const [meta, setMeta] = useState<SaveMeta | null>(savedMeta)
  const [seedEntry, setSeedEntry] = useState('')
  const [askDraft, setAskDraft] = useState(isDraftPromptEnabled)
  const [muted, setMutedUi] = useState(isMuted)
  const [volume, setVolumeUi] = useState(getVolume)
  // Always open on Game (the original reason Esc exists). Not persisted between opens.
  const [tab, setTab] = useState<TabId>('game')

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

  // Arrow / Home / End move between tabs (WAI-ARIA tablist keyboard pattern).
  const onTabKeyDown = (e: ReactKeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab)
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    setTab(TABS[next].id)
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

        <div className="settings-tabs" role="tablist" aria-label="Settings sections" onKeyDown={onTabKeyDown}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`settings-pane-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={`settings-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          className="settings-pane"
          role="tabpanel"
          id={`settings-pane-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
        >
          {tab === 'game' && (
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
            </div>
          )}

          {tab === 'profile' && <ProfilePanel />}

          {tab === 'options' && (
            <div className="settings-actions">
              <span className="settings-group-label">Table</span>
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

              <span className="settings-group-label">Sound</span>
              <div className="settings-scale">
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
          )}

          {tab === 'help' && (
            <div className="settings-actions">
              <button className="settings-item" onClick={onReplayCoach}>
                <span className="si-title">How to play this table</span>
                <span className="si-sub">A short tour of the controls. You can skip it any time.</span>
              </button>
              <button className="settings-item" onClick={onShowWhatsNew}>
                <span className="si-title">What's new — v{appVersion}</span>
                <span className="si-sub">See what changed in this build.</span>
              </button>
            </div>
          )}
        </div>

        {status && <p className={`settings-status ${status.tone}`}>{status.text}</p>}
      </div>
    </div>
  )
}
