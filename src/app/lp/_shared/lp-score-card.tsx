import type { LpCard } from "./lp-spot";

/**
 * The signature score card, shared by every /lp variant.
 *
 * /lp/2 shows it directly under the headline; /lp/3 pulls it up over the bottom
 * edge of the hero photo. Same markup either way — the position is CSS.
 *
 * Everything on it is real and city-specific (see lp-spot.ts). The freshness
 * chip reads UPDATED HOURLY rather than the prototype's "LIVE · 5 MIN AGO":
 * scoring is a per-city fan-out, not a five-minute loop.
 */
export default function LpScoreCard({ card }: { card: LpCard }) {
  return (
    <div className="score-card" aria-label={`Conditions for ${card.spotName}`}>
      <div className="score-card-top">
        <span className="mono-label">ReelCaster Score</span>
        <span className="live-badge">
          <span className="live-dot" />
          UPDATED HOURLY
        </span>
      </div>
      <div className="score-card-body">
        <div className="spot-row">
          <div>
            <div className="spot-name">{card.spotName}</div>
            <div className="spot-meta">{card.meta}</div>
          </div>
          <div className="score-big">
            <div className={`score-num score-${card.tier}`}>{card.score}</div>
            {card.tagWord ? (
              <span className={`score-tag tag-${card.tier}`}>{card.tagWord}</span>
            ) : null}
          </div>
        </div>

        {card.windowTime ? (
          <div className={`window-band band-${card.tier}`}>
            <div className="mono-label">Best window today</div>
            <div className="window-time">{card.windowTime}</div>
            {card.windowNote ? <div className="window-note">{card.windowNote}</div> : null}
          </div>
        ) : null}

        <div className="hours" aria-hidden="true">
          {card.hours.map((h, i) => (
            <span
              key={i}
              className={
                i >= card.bestFrom && i <= card.bestTo ? `bar on bar-${card.tier}` : "bar"
              }
              // Floor the height so a zero-score hour is still a visible tick
              // rather than a gap that reads as missing data.
              style={{ height: `${Math.max(h, 6)}%` }}
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

        {/* Only drawn when there is intel. A "0 fresh catches" line on a cold
            landing page argues against the product. */}
        {card.freshCatches > 0 ? (
          <div className="catch-line">
            <span>
              <strong>
                {card.freshCatches} fresh {card.freshCatches === 1 ? "catch" : "catches"}
              </strong>{" "}
              logged here in the last {card.freshWindowDays} days
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
