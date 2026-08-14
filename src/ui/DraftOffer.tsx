// Shown at the start of every new game (unless turned off in Settings): draft the Hidden
// deck two cards at a time, or skip into the random 12/12 deal.

export function DraftOffer({ onDraft, onSkip }: { onDraft: () => void; onSkip: () => void }) {
  return (
    <div className="whatsnew-overlay" role="dialog" aria-modal="true" aria-label="Draft your Maquis?">
      <div className="whatsnew-backdrop" aria-hidden="true" />
      <div className="whatsnew-panel">
        <div className="whatsnew-head">
          <span className="whatsnew-kicker">New game</span>
          <h2 className="whatsnew-title">Draft your Maquis?</h2>
        </div>
        <p className="draft-offer-copy">
          Two cards at a time. Click the one you want in your Hidden deck — the other goes to
          Recruit. Twelve picks, then you play.
        </p>
        <div className="draft-offer-actions">
          <button className="whatsnew-cta" onClick={onDraft}>
            Draft my Maquis
          </button>
          <button type="button" className="ghost draft-offer-skip" onClick={onSkip}>
            Skip — start playing
          </button>
        </div>
        <p className="draft-offer-note">You can turn this off in Settings.</p>
      </div>
    </div>
  )
}
