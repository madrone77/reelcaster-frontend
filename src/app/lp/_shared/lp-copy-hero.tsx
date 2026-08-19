import type { Angle } from "./lp-angles";
import LpScoreCard from "./lp-score-card";
import type { LpCard } from "./lp-spot";

/**
 * The copy-led hero: headline over white, with the score card as the visual,
 * so the first thing a cold visitor meets is the product's actual output
 * rather than a photograph of fishing.
 *
 * Shared by /lp/2 and /lp/4. Those two differ only in the copy they are handed
 * (generic against species-and-city targeted), which is the whole point of
 * running them against each other, so they must not differ in markup. /lp/3 is
 * this hero's counterpart with a photo.
 */
export default function LpCopyHero({
  angle,
  card,
  locality,
}: {
  angle: Angle;
  card: LpCard;
  /** Overrides the line under the subhead. Defaults to the city-only version. */
  locality?: string;
}) {
  return (
    <section className="hero">
      <div className="wrap">
        {angle.eyebrow ? <span className="eyebrow">{angle.eyebrow}</span> : null}
        <h1>
          {angle.headline.lead} <span className="accent">{angle.headline.accent}</span>
        </h1>
        <p className="subhead">{angle.subhead}</p>
        <p className="locality">
          {locality ?? `Every spot around ${card.cityName}, scored hour by hour.`}
        </p>
        <LpScoreCard card={card} />
      </div>
    </section>
  );
}
