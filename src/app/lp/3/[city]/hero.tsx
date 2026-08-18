import Image from "next/image";
import type { Angle } from "../../_shared/lp-angles";
import LpScoreCard from "../../_shared/lp-score-card";
import { heroFor } from "./heroes";

/**
 * /lp/3 hero — photo-led. A full-bleed image carries the headline, and the
 * score card climbs back over the bottom edge so the product's output is
 * attached to the photograph instead of floating below it.
 *
 * `priority` + `sizes` because this image is the LCP element on a paid landing
 * page: it is the one asset worth blocking on, and the column never exceeds
 * 480px, so asking for a viewport-width source above that would ship pixels
 * nobody sees.
 */
export default function Lp3Hero({
  angle,
  cityName,
}: {
  angle: Angle;
  cityName: string;
}) {
  const hero = heroFor(angle.id);

  return (
    <section className="hero photo">
      <div className="hero-photo">
        <Image
          src={hero.url}
          alt={hero.alt}
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
        />
        <div className="hero-cap">
          <div className="wrap">
            {angle.eyebrow ? <span className="eyebrow">{angle.eyebrow}</span> : null}
            <h1>
              {angle.headline.lead} <span className="accent">{angle.headline.accent}</span>
            </h1>
            <p className="subhead">{angle.subhead}</p>
            <p className="locality">Every spot around {cityName}, scored hour by hour.</p>
          </div>
        </div>
      </div>
      <div className="wrap">
        <LpScoreCard />
      </div>
    </section>
  );
}
