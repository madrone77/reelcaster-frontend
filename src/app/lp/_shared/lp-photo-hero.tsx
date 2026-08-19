import Image from "next/image";
import type { Angle } from "./lp-angles";
import LpScoreCard from "./lp-score-card";
import type { LpCard } from "./lp-spot";
import { heroFor } from "./lp-heroes";

/**
 * Photo-led hero, shared by /lp/3 and /lp/5. A full-bleed image carries the headline, and the
 * score card climbs back over the bottom edge so the product's output is
 * attached to the photograph instead of floating below it.
 *
 * `priority` + `sizes` because this image is the LCP element on a paid landing
 * page: it is the one asset worth blocking on, and the column never exceeds
 * 480px, so asking for a viewport-width source above that would ship pixels
 * nobody sees.
 */
export default function LpPhotoHero({
  angle,
  card,
}: {
  angle: Angle;
  card: LpCard;
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
            <p className="locality">Every spot around {card.cityName}, scored hour by hour.</p>
          </div>
        </div>
      </div>
      <div className="wrap">
        <LpScoreCard card={card} />
      </div>
    </section>
  );
}
