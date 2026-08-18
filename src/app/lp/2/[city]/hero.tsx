import type { Angle } from "../../_shared/lp-angles";
import LpScoreCard from "../../_shared/lp-score-card";

/**
 * /lp/2 hero — copy-led. The headline carries the page and the score card is
 * the visual, so the first thing a cold visitor meets is the product's actual
 * output rather than a photograph of fishing.
 *
 * The counterpart is /lp/3, which leads with a photo. Same copy, same CTA,
 * same body — the hero is the variable under test.
 */
export default function Lp2Hero({
  angle,
  cityName,
}: {
  angle: Angle;
  cityName: string;
}) {
  return (
    <section className="hero">
      <div className="wrap">
        {angle.eyebrow ? <span className="eyebrow">{angle.eyebrow}</span> : null}
        <h1>
          {angle.headline.lead} <span className="accent">{angle.headline.accent}</span>
        </h1>
        <p className="subhead">{angle.subhead}</p>
        <p className="locality">Every spot around {cityName}, scored hour by hour.</p>
        <LpScoreCard />
      </div>
    </section>
  );
}
