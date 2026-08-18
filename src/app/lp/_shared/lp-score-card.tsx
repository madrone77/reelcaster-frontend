import { DEMO } from "./lp-content";

/**
 * The signature score card, shared by every /lp variant.
 *
 * /lp/2 shows it directly under the headline; /lp/3 pulls it up over the bottom
 * edge of the hero photo. Same markup either way — the position is CSS.
 */
export default function LpScoreCard() {
  return (
    <div className="score-card" aria-label={`Sample conditions for ${DEMO.spotName}`}>
      <div className="score-card-top">
        <span className="mono-label">ReelCaster Score</span>
        {/* Not "LIVE · 5 MIN AGO" — see the note at the top of lp-content.ts. */}
        <span className="live-badge">
          <span className="live-dot" />
          UPDATED HOURLY
        </span>
      </div>
      <div className="score-card-body">
        <div className="spot-row">
          <div>
            <div className="spot-name">{DEMO.spotName}</div>
            <div className="spot-meta">{DEMO.meta}</div>
          </div>
          <div className="score-big">
            <div className="score-num">{DEMO.score}</div>
            <span className="score-tag">{DEMO.tagWord}</span>
          </div>
        </div>
        <div className="window-band">
          <div className="mono-label">Best window today</div>
          <div className="window-time">{DEMO.windowTime}</div>
          <div className="window-note">{DEMO.windowNote}</div>
        </div>
        <div className="hours" aria-hidden="true">
          {DEMO.hours.map((h, i) => (
            <span
              key={i}
              className={i >= DEMO.bestFrom && i <= DEMO.bestTo ? "bar on" : "bar"}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        {/* Five ticks, not four: the bars run midnight→midnight and
            space-between puts labels at 0/25/50/75/100% of the row, so four
            labels would mark hours 0, 8, 16 and 24 while claiming to read
            6A, 12P, 6P, 12A. */}
        <div className="hours-axis">
          <span>12A</span>
          <span>6A</span>
          <span>12P</span>
          <span>6P</span>
          <span>12A</span>
        </div>
        <div className="catch-line">
          <span>
            <strong>{DEMO.freshCatches} fresh catches</strong> logged here in the last{" "}
            {DEMO.freshWindowDays} days
          </span>
        </div>
      </div>
    </div>
  );
}
