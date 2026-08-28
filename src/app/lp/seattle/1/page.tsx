import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { angleFrom } from "../../_shared/lp-angles";
import { resolveLpCard } from "../../_shared/lp-spot";
import { lpRegionFor } from "../../_shared/lp-region";
import { PRICE, PROOF } from "../../_shared/lp-content";
import { fetchMapSpots } from "@/lib/bluecaster";
import {
  ANON_FORECAST_DAYS,
  FREE_FORECAST_DAYS,
  PRO_FORECAST_DAYS,
} from "@/lib/forecast-horizon";
import { formatHour12 } from "@/lib/time-format";
import { LP8_CSS } from "./lp8-css";
import ExploreReel from "./explore-reel";
import { LpSeattleHit, TrackedCta } from "./lp-track";
import { buildCityProof, type CityProof, type HeroMark } from "./city-proof";

/**
 * /lp/seattle/1 — the wide, Seattle-led variant.
 *
 * Every other variant sells the product and then proves it with the city's
 * data. This one opens with the city's actual day and lets the product be the
 * explanation for it: the hero is one real mark, one real species and its 24
 * real hourly scores, with the good window lit. A cold reader understands what
 * this is before reading a word of copy, which is the thing a feature list has
 * never managed on this traffic.
 *
 * What it isolates against /lp/6 and /lp/7 is whether leading with the answer
 * beats leading with the pitch. Everything else is held as close to constant
 * as a different layout allows: same trial, same checkout route, same
 * attribution shape, same jurisdiction resolution.
 *
 * It carries its own shell (see lp8-css.ts) for the same reason /lp/1 does.
 * The shared shell describes a 480px phone column, and bending it around a
 * two-column hero would put every other running variant at risk.
 *
 * The CTA is the map itself: every button on the page opens Explore framed on
 * Seattle, with nothing to fill in. The page has no email field and no card,
 * because the product's own free tier already answers the question the ad
 * asked -- is today worth going -- and asking for a card before answering it
 * is a wall in front of the demo. The trial is sold inside Explore, where the
 * reader has seen the thing they would be paying for.
 *
 * Everything the page promises is therefore a promise about the SIGNED-OUT
 * product. The day counts are imported from lib/forecast-horizon rather than
 * typed, so the page cannot go on advertising two days after the horizon
 * moves.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

// Matches the other variants. Inert while the page reads searchParams for the
// angle, and correct the moment it stops.
export const revalidate = 900;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
/**
 * The city is the route, not a parameter.
 *
 * This page was /lp/8/[city] and served all nine cities. It is now Seattle
 * only: the copy names Seattle species in Puget Sound terms, the where/what/
 * when render is a WDFW mark, and the paid traffic behind it is American. A
 * second city gets its own /lp/<city>/<n> rather than a branch in here.
 */
const CITY_SLUG = "seattle-wa";

/**
 * Where every CTA on this page goes.
 *
 * z=10 frames the city the way the app's own Seattle view does. Without it
 * Explore opens a city at zoom 9, which on Puget Sound pulls back far enough
 * to show water nobody in this ad is launching into.
 *
 * Written once because it was written twice: a link that drops the zoom is
 * indistinguishable from one that keeps it until somebody lands on it.
 */
const EXPLORE_HREF = `/explore?loc=${CITY_SLUG}&z=10`;

/** The one label, so the nav, the hero and the close cannot disagree. */
const CTA_LABEL = "Start Exploring Free";

/**
 * The line under the button, and the whole of the qualification on it.
 *
 * "to start" is doing real work: what is free is getting in, not everything
 * past it, and a flat "no account and no card" would be read as a claim about
 * the whole product by somebody who then meets the day limit on the next
 * screen. The limits themselves are spelled out further down, where there is
 * room to be exact about them.
 */
const CTA_NOTE = "No account and no card to start.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const slug = CITY_SLUG;
  const sp = await searchParams;
  const card = await resolveLpCard(slug);
  const angle = angleFrom(sp);
  return {
    title: {
      absolute: card
        ? `${card.cityName} fishing: the hours worth going | ReelCaster`
        : `${angle.title} | ReelCaster`,
    },
    description: card
      ? `Every hour at every ${card.cityName} fishing spot, scored. ${angle.subhead}`
      : angle.subhead,
    robots: { index: false, follow: true },
  };
}

/**
 * The body no longer reads searchParams. `?a=` still picks the title and the
 * subhead in generateMetadata, which is where the angle was always doing most
 * of its work; the rest of it fed the checkout POST and the CTA counter, and
 * both of those left with the form.
 */
export default async function Lp8CityPage() {
  const slug = CITY_SLUG;

  const card = await resolveLpCard(slug);
  if (!card) notFound();

  const region = lpRegionFor(card.provinceCode);

  /**
   * There is no `from` key here any more, and nothing is lost by that.
   *
   * It existed to ride a checkout POST into the conversion row. This page no
   * longer starts a checkout, and the visit is already recorded without it:
   * AttributionCapture in the root layout writes rc_entry on this landing
   * path, write-once, 90 days, and that cookie survives the hop to Explore and
   * whatever signup or upgrade follows it. A query parameter carrying the same
   * fact would be a second copy free to disagree, and lib/attribution is
   * explicit that we do not put the referrer in a URL.
   */

  // The city-wide numbers and the marks band. Separate from the card because
  // resolveLpCard deliberately returns ONE spot; this page also wants the
  // roster around it. A failure here costs the two proof bands, not the page.
  const payload = await fetchMapSpots({ city: slug }).catch(() => null);
  const proof: CityProof | null = payload ? buildCityProof(payload, card) : null;

  /**
   * The where/what/when render is a photograph of one real spot page: Jefferson
   * Head, in WDFW Marine Area 10.
   *
   * On Seattle that is not an illustration, it is the reader's own water, and
   * captioning it "an example" throws away the strongest thing the image has.
   * Anywhere else it is a Washington mark, and the caption has to say so rather
   * than let a WDFW area label imply it governs Canadian water.
   *
   * Tested against the city's own roster instead of the province code, so a
   * future render of a different mark keeps working without touching this.
   */
  const SHOT_MARK = "Jefferson Head";
  const shotIsLocal = Boolean(
    proof?.marks.some((m) => m.name === SHOT_MARK),
  );

  // The hero reads off the SAME ranking as the marks band below it. Taking
  // the card's spot instead put Constance Bank at 88 above a list topped by
  // Victoria Waterfront at 91, which is a page disagreeing with itself in the
  // reader's first screen. The card still supplies everything that is not a
  // score: the city, the species and the region.
  const hero: HeroMark = proof?.hero ?? {
    name: card.spotName,
    score: card.score,
    hours: card.hours,
    bestFrom: card.bestFrom,
    bestTo: card.bestTo,
    peakHour: card.bestFrom >= 0 ? card.bestFrom : 12,
  };

  const peakHourLabel = formatHour12(hero.peakHour);

  return (
    <div className="l8">
      <style dangerouslySetInnerHTML={{ __html: LP8_CSS }} />
      <LpSeattleHit />

      <div className="nav">
        <div className="navin">
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: ".13em",
              color: "var(--l8-brand)",
            }}
          >
            REELCASTER
          </span>
          <TrackedCta cta="nav" className="navcta" href={EXPLORE_HREF}>
            {CTA_LABEL}
          </TrackedCta>
        </div>
      </div>

      {/* HERO: the city's real day, then the ask */}
      <div className="hero">
        <div className="shell herogrid">
          <div>
            <p className="pin">
              <i />
              {card.cityName}
              {region.areaBadge ? ` · ${region.areaBadge}` : ""}
            </p>
            <h1>
              Green means <em>go</em>.
            </h1>
            {/* Casey's copy, verbatim apart from the city name, which is
                templated so the other eight cities do not advertise Seattle.
                US spelling ("colored") is deliberate: this page's paid traffic
                is Puget Sound. */}
            <p className="herosub">
              Every hour at every {card.cityName} fishing spot. Scored and
              colored by whether it&rsquo;s worth heading out. Quickly scan up
              to 2 weeks ahead for the best fishing times for Halibut, Coho,
              Kings or Lings when they&rsquo;re open! Now you can even score
              your own custom spots.
            </p>

            {/* One link, no form. */}
            <div id="start">
              <TrackedCta cta="hero" className="go" href={EXPLORE_HREF}>
                {CTA_LABEL}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </TrackedCta>
              <p className="gonote">{CTA_NOTE}</p>
            </div>
          </div>

          {/* Explore, on a phone, walking the city's own marks.
              This replaces a still of the conditions screen. The still was a
              real screenshot and honest, but it showed one spot holding
              still, and the claim beside it is that every mark around the city
              is scored separately -- which a reader accepts far quicker from
              watching the answer change spot to spot.

              Falls back to nothing rather than to a broken phone: the reel is
              built from the same payload as the marks band, and if that failed
              the hero simply becomes a one-column text block. */}
          {proof && proof.pins.length > 1 ? (
            <div className="stage">
              <ExploreReel cityName={card.cityName} pins={proof.pins} />
            </div>
          ) : null}
        </div>
      </div>

      {/* WHERE / WHAT / WHEN.
          The second marketing shot carries its own three-beat explainer, so
          the copy beside it names the three questions rather than restating
          the arrows. The screen is a Washington mark (Marine Area 10), which
          is why the caption calls it an example rather than implying it is the
          reader's own water: jurisdiction correctness is shared by every
          variant, and a WDFW area label over a DFO city is exactly the mistake
          [[project_lp_landing_variants]] warns about. */}
      <section className="wwwsec">
        <div className="shell www">
          <div>
            <span className="lab">One screen, three answers</span>
            <h2>
              {shotIsLocal
                ? `Where, what, and when, on ${card.cityName} water.`
                : "Where, what, and when."}
            </h2>
            <p className="sub">
              Pick a spot and ReelCaster will tell you what&rsquo;s open,
              what&rsquo;s worth targeting, it&rsquo;s hourly score out of 100,
              and the best window to get the rods in. Even create your own
              custom spots and get alerted when the score is high. No more
              missing the best times and days.
            </p>
            <ul className="wwwlist">
              <li>
                <b>Where</b>
                <span>All the best spots around {card.cityName}</span>
              </li>
              <li>
                <b>What</b>
                <span>Every species at that spot</span>
              </li>
              <li>
                <b>When</b>
                <span>
                  We highlight the best times so you don&rsquo;t need to scan 5
                  apps
                </span>
              </li>
            </ul>
          </div>
          <figure className="shotfig">
            <Image
              src="/marketing/where-what-when.png"
              alt="A ReelCaster spot page for Jefferson Head. Arrows label the spot name as Where, the species score card as What, and the best window as When."
              width={1453}
              height={1820}
              sizes="(min-width: 940px) 46vw, 92vw"
              className="shot"
            />
            <figcaption>
              {shotIsLocal ? (
                <>
                  {SHOT_MARK}, one of the spots we score around{" "}
                  {card.cityName}, with its {region.regulator.name} regulations
                  underneath it and a full interactive bathymetry map of the
                  spot.
                </>
              ) : (
                <>
                  A spot page from Washington. Yours shows {card.cityName} spots
                  and the {region.regulator.name} rules that apply to them.
                </>
              )}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* PROOF STRIP */}
      {proof ? (
        <div className="strip">
          <div className="shell stripin">
            <div className="stat">
              <div className="n">{proof.hoursScored.toLocaleString("en-CA")}</div>
              <div className="t">
                hourly scores in your next two weeks
              </div>
            </div>
            <div className="stat">
              <div className="n">{proof.spotCount}</div>
              <div className="t">
                spots, every one of them scored separately
              </div>
            </div>
            <div className="stat">
              <div className="n">24</div>
              <div className="t">hours a day, scored one at a time</div>
            </div>
            <div className="stat">
              <div className="n">14</div>
              <div className="t">days ahead, rebuilt every morning</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* WHY THE NUMBER IS NOT A GUESS */}
      <section className="white">
        <div className="shell two">
          <div>
            <span className="lab">Where the number comes from</span>
            <h2>Not a tide table with an opinion.</h2>
            <p className="sub">
              A tide table tells you the water is moving. It cannot tell you
              that the same current at first light and at noon are worth
              completely different things to the fish you are after. Every hour
              at every spot is scored against how that species actually feeds
              there, then checked against whether a person can fish it.
            </p>
          </div>

          <div className="ladder">
            <div className="rung">
              <div className="rname">
                Season
                <small>
                  {card.species} run timing near {card.cityName}, week by week
                </small>
              </div>
              <div className="rval">weighted</div>
            </div>
            <div className="rung">
              <div className="rname">
                Light
                <small>Sun angle through the whole day, not just sunrise</small>
              </div>
              <div className="meter">
                <u>
                  <b style={{ width: "100%" }} />
                </u>
                <span className="rval">high</span>
              </div>
            </div>
            <div className="rung">
              <div className="rname">
                Current
                <small>
                  Speed and stage from {region.tideAuthority}, hour by hour
                </small>
              </div>
              <div className="meter">
                <u>
                  <b style={{ width: "62%" }} />
                </u>
                <span className="rval">mid</span>
              </div>
            </div>
            <div className="rung">
              <div className="rname">
                Tide exchange
                <small>How hard the whole day is moving water</small>
              </div>
              <div className="rval">weighted</div>
            </div>
            <div className="rung">
              <div className="rname">
                Fishable
                <small>Wind, sea state, rain and visibility</small>
              </div>
              <div className="meter">
                <u>
                  <b style={{ width: "89%" }} />
                </u>
                <span className="rval">good</span>
              </div>
            </div>
            <div className="sum">
              <span>
                {peakHourLabel} at {hero.name}
              </span>
              <b>{hero.score}</b>
            </div>
          </div>
        </div>
      </section>

      {/* THE MARKS */}
      {proof && proof.marks.length > 2 ? (
        <section>
          <div className="shell">
            <span className="lab">
              {proof.marksSpecies} today, spot by spot
            </span>
            {/* Counts the marks actually LISTED, not the city's roster. The
                map payload carries only the species scoring today, so Seattle
                lists 7 of its 15 marks for halibut; a heading that said 15
                over a list of 7 was the same self-contradiction as the hero
                and the leaderboard naming different spots. */}
            <h2 style={{ marginBottom: 28 }}>
              We scored all {proof.marks.length} so you can skip{" "}
              {proof.marks.length - 1}.
            </h2>
            {/* Every row deep-links to the spot's own page.
                A reader who has scrolled this far has stopped being sold to
                and started shopping, and the anon spot page is the product's
                own free tier: two days of hourly scores, no account. Sending
                them to a signup wall instead would waste the one moment they
                asked to see more. */}
            <div className="marks">
              {proof.marks.map((m) => (
                <a
                  className={`mrow${m.name === hero.name ? " top" : ""}`}
                  key={m.slug}
                  href={`/explore/spot/${m.slug}`}
                >
                  <span className="mn">{m.name}</span>
                  <span className="mb">
                    <i
                      style={{
                        width: `${Math.max(8, Math.min(100, ((m.score - 60) / 35) * 100))}%`,
                      }}
                    />
                  </span>
                  <span className="mv">{m.score}</span>
                </a>
              ))}
            </div>

            <TrackedCta cta="secondary" className="mapcta" href={EXPLORE_HREF}>
              Explore Live {card.cityName} Map
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </TrackedCta>
          </div>
        </section>
      ) : null}

      {/* WHAT IT REPLACES */}
      <section className="white">
        <div className="shell">
          <span className="lab">Before you launch</span>
          <h2>Six tabs, one answer.</h2>
          <div className="chips">
            <span>Tide table</span>
            <span>Wind app</span>
            <span>Current chart</span>
            <span>{region.regulator.name} regulations PDF</span>
            <span>Forum thread</span>
            <span>Your notebook</span>
          </div>
          <div className="one">One number, per hour, per spot.</div>

          {/* Bob's review.
              Words, rating and attribution all come from PROOF rather than
              being retyped here, so this page cannot drift from the one record
              that says the quote is real, permissioned and verbatim. The stars
              are drawn from PROOF.quote.rating for the same reason: hardcoding
              five would be a second copy of a claim about a real person, free
              to disagree with the record the moment either changed. showProof
              is honoured, so switching the band off switches it off here too.

              His sentence is not edited for length or house style. It names
              tides, currents, wind, swell and water temperature in one breath,
              which is the "six tabs, one answer" claim above it made by
              somebody who is not us. */}
          {PROOF.showProof ? (
            <figure className="quote">
              <div
                className="stars"
                role="img"
                aria-label={`${PROOF.quote.rating} out of 5 stars`}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={i < Math.round(PROOF.quote.rating) ? "on" : ""}
                    aria-hidden
                  >
                    {"\u2605"}
                  </span>
                ))}
              </div>
              <blockquote>{PROOF.quote.text}</blockquote>
              <figcaption>{PROOF.quote.attr}</figcaption>
            </figure>
          ) : null}
        </div>
      </section>

      {/* WHAT FREE OPENS.
          This band was "How the trial works", written when the page asked for
          a card. With the ask gone it described a flow the page no longer
          offers, which on ad traffic is worse than saying nothing: the button
          promises free and the section underneath it names a charge date.
          What replaces it is the same three-beat shape answering the question
          a free reader actually has, which is how far ahead they can see. */}
      <section>
        <div className="shell">
          <span className="lab">How far ahead you can see</span>
          <h2 style={{ marginBottom: 24 }}>
            Start free. The days are the thing you buy.
          </h2>
          <div className="steps">
            <div className="step">
              <b>No account</b>
              <p>
                The next <strong>{ANON_FORECAST_DAYS} days</strong>, hour by
                hour, at every {card.cityName} spot. Nothing to fill in.
              </p>
            </div>
            <div className="step">
              <b>Free account</b>
              <p>
                <strong>{FREE_FORECAST_DAYS} days</strong> ahead instead of{" "}
                {ANON_FORECAST_DAYS}. An email address, and no card.
              </p>
            </div>
            <div className="step">
              <b>Pro</b>
              <p>
                All <strong>{PRO_FORECAST_DAYS} days</strong>, plus your own
                custom spots. {PRICE.year}, and you can see the whole product
                before you decide.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="white">
        <div className="shell">
          <span className="lab">Straight answers</span>
          <h2 style={{ marginBottom: 28 }}>
            What you are actually signing up for.
          </h2>
          <div className="faq">
            <div className="qa">
              <h3>Does it tell me where the fish are?</h3>
              <p>
                No, and be careful with anything that claims to. It tells you
                when conditions at a spot line up with how that species feeds
                there, which is the part you can plan a morning around.
              </p>
            </div>
            <div className="qa">
              <h3>Where does the data come from?</h3>
              <p>
                {region.tideAuthority} for tides and currents, marine weather
                models and buoys for wind and sea state, and{" "}
                {region.regulator.name} for what is open and what you may keep.
              </p>
            </div>
            <div className="qa">
              <h3>Do I need to install anything?</h3>
              <p>
                No app and no boat computer. It runs in a browser on the phone
                you already carry, and it works the same on the ramp as it does
                at the kitchen table.
              </p>
            </div>
            <div className="qa">
              <h3>Do I have to sign up?</h3>
              <p>
                Not to look. The map opens on {card.cityName} with the next{" "}
                {ANON_FORECAST_DAYS} days scored and no account at all. An
                account is how you see further out, and Pro is how you see all{" "}
                {PRO_FORECAST_DAYS} days and score your own custom spots.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSE */}
      <section className="close">
        <div className="shell">
          <h2>Fish the three hours, not the whole day.</h2>
          <p className="sub">
            Open the live {card.cityName} map and see the next{" "}
            {ANON_FORECAST_DAYS} days scored, spot by spot and hour by hour.
          </p>
          <TrackedCta cta="final" className="go" href={EXPLORE_HREF}>
            {CTA_LABEL}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </TrackedCta>
          <p className="gonote">{CTA_NOTE}</p>
        </div>
      </section>

      <div className="foot">
        ReelCaster {"·"} {card.cityName} and the Salish Sea
        <br />
        Forecasts are guidance, not a guarantee. Always check current{" "}
        {region.regulator.name} regulations before you keep a fish.
      </div>
    </div>
  );
}
