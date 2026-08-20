import Image from "next/image";
import type { Angle } from "./lp-angles";
import LpScoreCard from "./lp-score-card";
import type { LpCard } from "./lp-spot";
import { heroFor, type HeroMarket } from "./lp-heroes";

/**
 * Photo-led hero, shared by /lp/3 and /lp/5. A full-bleed image carries the headline, and the
 * score card climbs back over the bottom edge so the product's output is
 * attached to the photograph instead of floating below it.
 *
 * `priority` + `sizes` because this image is the LCP element on a paid landing
 * page: it is the one asset worth blocking on, and on the phone layout the
 * column never exceeds 480px, so asking for a viewport-width source above that
 * would ship pixels nobody sees. `wide` raises that ceiling for the desktop
 * layout, where the photo is a 560px-ish column rather than the page width.
 */
export default function LpPhotoHero({
  angle,
  card,
  market = "default",
  wide = false,
}: {
  angle: Angle;
  card: LpCard;
  /** Which photography this page gets. /lp/6 asks for "us"; the variants that
   *  serve both sides of the border stay on the neutral shot. */
  market?: HeroMarket;
  /** Page uses the desktop layout above 900px, so ask for the larger source
   *  and let the browser pick. Must match LpShell's `wide`. */
  wide?: boolean;
}) {
  const hero = heroFor(angle.id, market);

  return (
    <section className="hero photo">
      <div className="hero-photo">
        <Image
          src={wide ? hero.urlWide ?? hero.url : hero.url}
          alt={hero.alt}
          fill
          priority
          sizes={wide ? "(max-width: 899px) 100vw, 560px" : "(max-width: 480px) 100vw, 480px"}
        />
        <div className="hero-cap">
          <div className="wrap">
            {angle.eyebrow ? <span className="eyebrow">{angle.eyebrow}</span> : null}
            <h1>
              {angle.headline.lead} <span className="accent">{angle.headline.accent}</span>
            </h1>
            <p className="subhead">{angle.subhead}</p>
            <p className="locality">
              Every spot around {card.cityName}, scored hour by hour
              {market === "us" ? " for the next 14 days" : ""}.
            </p>
          </div>
        </div>
      </div>
      <div className="wrap">
        <LpScoreCard card={card} />
      </div>
    </section>
  );
}
