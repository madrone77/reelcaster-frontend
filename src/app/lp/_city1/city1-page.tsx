import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { angleFrom } from "../_shared/lp-angles";
import { resolveLpCard } from "../_shared/lp-spot";
import { lpRegionFor } from "../_shared/lp-region";
import { PRICE, PROOF } from "../_shared/lp-content";
import { fetchMapSpots } from "@/lib/bluecaster";
import {
  ANON_FORECAST_DAYS,
  FREE_FORECAST_DAYS,
  PRO_FORECAST_DAYS,
} from "@/lib/forecast-horizon";
import { formatHour12 } from "@/lib/time-format";
import { LP8_CSS } from "./city1-css";
import ExploreReel from "../_reel/explore-reel";
import { City1Hit, TrackedCta } from "./city1-track";
import type { City1City, City1Variant } from "./city1-city";
import { loadConditionsFeed } from "./load-conditions";
import ConditionsPhone from "./conditions-phone";
import AlertSmsPhone from "./alert-sms-phone";
import { nextSundayFrom } from "./alert-sms";
import {
  buildCityProof,
  type CityProof,
  type HeroMark,
} from "../_reel/city-proof";

/**
 * The city-first landing page: /lp/seattle/1, /lp/vancouver/1.
 *
 * Every numbered variant sells the product and then proves it with the city's
 * data. This one opens with the city's actual day and lets the product be the
 * explanation for it: the hero is one real mark, one real species and its 24
 * real hourly scores, with the good window lit. A cold reader understands what
 * this is before reading a word of copy, which is the thing a feature list has
 * never managed on this traffic.
 *
 * What it isolates against /lp/6 and /lp/7 is whether leading with the answer
 * beats leading with the pitch. Everything else is held as close to constant
 * as a different layout allows: same checkout route, same attribution shape,
 * same jurisdiction resolution.
 *
 * It carries its own shell (see city1-css.ts) for the same reason /lp/1 does.
 * The shared shell describes a 480px phone column, and bending it around a
 * two-column hero would put every other running variant at risk.
 *
 * The CTA is the map itself: every button on the page opens Explore framed on
 * the city, with nothing to fill in. The page has no email field and no card,
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
 * -- The city is a parameter, not a fork -------------------------------------
 *
 * This was /lp/8/[city] serving all nine cities, then Seattle only, and the
 * second city nearly arrived as a copy: an abandoned branch held a Vancouver
 * twin whose diff against Seattle was a handful of literals and some rewritten
 * comments. Everything else in it was identical, including the bugs the two
 * copies would eventually grow apart on. ../_reel/reel-frame.ts made the same
 * mistake first and records how it went.
 *
 * So the city arrives as a City1City and the route is a wrapper. It is still
 * NOT a `[city]` dynamic segment, and it must not become one: the hero reel is
 * drawn on a baked still of that city's water, and a still is a capture
 * somebody has to make. A city costs a capture and one config object. It does
 * not cost a page.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Where every CTA on the page goes.
 *
 * NO z. Explore's own opening logic owns the frame, and this line must not
 * fight it.
 *
 * It used to append z=10, on the argument that zoom 9 pulls back far enough to
 * show sea nobody in this ad is launching into. That argument was never
 * measured, and it is wrong. Measured on production 2026-08-31, iPhone 13
 * viewport, twenty seconds to settle, count read off the sheet header:
 *
 *     city              z=10          no z
 *     seattle-wa        3 spots       12 spots
 *     vancouver-bc      4 spots       30 spots
 *     victoria-bc      16 spots       47 spots
 *     nanaimo-bc        6 spots       17 spots
 *     friday-harbor-wa 11 spots       27 spots
 *
 * z=10 does not tighten the frame onto the water, it centres on the CITY, and
 * a coastal city at zoom 10 is mostly land. Seattle at z=10 fills the screen
 * with King County and leaves two score pucks on it; at the default the frame
 * is Puget Sound and six pucks are up. No city was better with the param, so
 * there is nothing here to make per-city.
 *
 * That matters because of what the page says directly above the button: "We
 * scored all 15 so you can skip 14." A reader who is promised fifteen and
 * lands on three has been told the product is smaller than it is, by the link
 * itself.
 *
 * Written once because it was written twice: a link that adds a zoom is
 * indistinguishable from one that does not until somebody lands on it.
 *
 * Points at /explore. It briefly pointed at /m/explore, the paid-marketing
 * frame that can strip depth (see @/lib/preview-gate) — that is not launching
 * yet, so the CTA is back on the product's own map and no live surface links to
 * the gate at all. Repointing this line is half of turning it on; the other
 * half is PREVIEW_GATE_ENABLED.
 *
 * Carries `ad=day2`, so Explore arrives in the ad frame: the emptied top bar
 * with one Start free trial button, the trial modal behind it, and no way off
 * the page. The frame follows the reader onto a spot page opened from the map.
 *
 * `day2` is a wall, not a date (@/lib/ad-mode). It is the loosest of the three
 * that still frames the page: exactly what a signed-out visitor already gets,
 * with nothing tightened. That is the honest control for traffic this page has
 * already spent nine screens persuading -- it has earned the map, not another
 * wall -- and it is a one-word edit here if a tighter one converts better.
 */
const exploreHref = (slug: string) => `/explore?loc=${slug}&ad=day2`;

/** The one label, so the nav, the hero and the close cannot disagree. */
const CTA_LABEL = "Start Exploring Free";

/**
 * There is no line under the button any more.
 *
 * It read "Look at today and tomorrow free." -- the anon horizon stated as
 * what you get rather than as what you are missing (#512). Cut at Casey's
 * call: a qualifier under a button is read as a catch whatever it says, and
 * the limits are spelled out further down where there is room to be exact
 * about them.
 *
 * ⚠ The blend pages still carry the identical string as EXPLORE_NOTE in
 * ../_blend/blend-page.tsx, so /2 and /3 say it and /1 and /4 do not. Left
 * that way deliberately rather than swept: those are separate live arms and
 * changing their copy is a change to their test, not to this one.
 *
 * `.gonote` stays in city1-css.ts because the blend renders it.
 */

export async function city1Metadata(
  city: City1City,
  searchParams: SearchParams,
): Promise<Metadata> {
  const slug = city.slug;
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
export default async function City1Page({
  city,
  variant = 1,
}: {
  city: City1City;
  /**
   * Which arm this route is. The page is otherwise identical: same shell,
   * same copy, same explore-only CTA, same ranking. See City1Variant.
   */
  variant?: City1Variant;
}) {
  const slug = city.slug;
  const explore = exploreHref(slug);

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
   * /lp/4's second picture: one mark's own day, live.
   *
   * Only fetched for the variant that draws it -- /lp/1 must not pay a spot-
   * page round trip for a phone it does not render. Null on any miss, and the
   * section falls back to the still, which is why `shot` stays required for
   * every city rather than becoming optional on the strength of this.
   */
  const conditions =
    variant === 4
      ? await loadConditionsFeed(proof, card.provinceCode, city.conditionsMark)
      : null;

  // The hero reads off the SAME ranking as the marks band below it. Taking
  // the card's spot instead put Constance Bank at 88 above a list topped by
  // Victoria Waterfront at 91, which is a page disagreeing with itself in the
  // reader's first screen. The card still supplies everything that is not a
  // score: the city, the species and the region.
  const hero: HeroMark = proof?.hero ?? {
    name: card.spotName,
    // resolveLpCard returns a card, not a mark, so there is no slug to give.
    // Nothing that needs one uses this fallback: the conditions phone reads
    // proof.hero directly and renders the still when there is no proof.
    slug: "",
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
      <City1Hit city={city} variant={variant} />

      <div className="nav">
        <div className="navin">
          {/* Swapped with the blend's, so this family does not run a typed
              wordmark in the bar above a phone that carries the real mark.
              Blue knockout, the default on a light surface. Not a link: a
              logo that goes to the homepage is the most-pressed way off a
              landing page. */}
          <Image
            className="navmark"
            src="/reelcaster-mark-blue.svg"
            alt="ReelCaster"
            width={104}
            height={48}
            priority
          />
          <TrackedCta city={city} variant={variant} cta="nav" className="navcta" href={explore}>
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
            {/* Casey's copy. Three things are templated out of it and
                nothing else: the city name, the spelling of "coloured", and
                the four species. All three are market facts rather than
                preferences -- an American page spelling it the Canadian way is
                as wrong as a Vancouver page selling Kings, and both are the
                kind of wrong a local reader clocks in the first sentence. See
                city1-city.ts. */}
            <p className="herosub">
              Every hour at every {card.cityName} fishing spot. Scored and{" "}
              {city.colourVerb} by whether it&rsquo;s worth heading out.
              Quickly scan up to 2 weeks ahead for the best fishing times for{" "}
              {city.heroSpecies} when they&rsquo;re open! Now you can even
              score your own custom spots.
            </p>

            {/* One link, no form. */}
            <div id="start">
              <TrackedCta city={city} variant={variant} cta="hero" className="go" href={explore}>
                {CTA_LABEL}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </TrackedCta>
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
              <ExploreReel
                cityName={card.cityName}
                pins={proof.pins}
                frame={city.frame}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* WHERE / WHAT / WHEN.
          The marketing shot carries its own three-beat explainer, so the copy
          beside it names the three questions rather than restating the arrows.

          The screen is THIS city's own water now (city1-city.ts), which is
          what retired the "an example from Washington" caption this section
          used to need. That caption was the honest way to stop a WDFW area
          label implying it governs Canadian water while one screenshot served
          every city; a shot per city removes the hazard instead of labelling
          it. Jurisdiction correctness is shared by every variant, so if a city
          is ever added without its own capture, give it one rather than
          pointing this at another jurisdiction's mark. */}
      <section className="wwwsec">
        <div className="shell www">
          <div>
            <span className="lab">One screen, three answers</span>
            <h2>Where, what, and when, on {card.cityName} water.</h2>
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
            {conditions ? (
              <ConditionsPhone
                feed={conditions}
                serverNowMs={Date.now()}
              />
            ) : (
              <Image
                src={city.shot.src}
                alt={`A ReelCaster spot page for ${city.shot.mark}. Arrows label the spot name as Where, the species score card as What, and the best window as When.`}
                width={city.shot.width}
                height={city.shot.height}
                sizes="(min-width: 940px) 46vw, 92vw"
                className="shot"
              />
            )}
            <figcaption>
              {conditions ? (
                <>
                  {conditions.spotName}, today, scored for{" "}
                  {conditions.speciesName ?? proof?.marksSpecies}. Every
                  reading belongs to the hour the line is sitting on, and you
                  can drag it yourself. The same screen carries the
                  spot&rsquo;s {region.regulator.name} regulations and a full
                  bathymetry map underneath it.
                </>
              ) : (
                <>
                  {city.shot.mark}, one of the spots we score around{" "}
                  {card.cityName}, with its {region.regulator.name} regulations
                  underneath it and a full interactive bathymetry map of the
                  spot.
                </>
              )}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* THE ALERT ARRIVING.
          /lp/4 only, and only for a city with reviewed copy. The two phones
          above still ask the reader to come and look; this is the offer the
          page actually makes, which is that they do not have to. An arriving
          text is the only honest way to show a thing whose whole value is
          that it reaches you when you are not on this page.

          The band sits here rather than higher because it answers the
          question the where/what/when section leaves: fine, but I am not
          going to check this every morning. */}
      {variant === 4 && city.alertSms ? (
        <section className="smssec white">
          <div className="shell www">
            <div>
              <span className="lab">And when you are not looking</span>
              <h2>We text you, so you don&rsquo;t miss them.</h2>
              <p className="sub">
                Set the score you&rsquo;d get up for at the spots you fish. We
                watch all {proof ? proof.spotCount : ""} of them around{" "}
                {card.cityName} every morning and send one text when a day
                clears your bar. No app to open, nothing to remember.
              </p>
              <ul className="wwwlist">
                <li>
                  <b>Your bar</b>
                  <span>You pick the score, not us</span>
                </li>
                <li>
                  <b>Your spots</b>
                  <span>Including custom ones you add yourself</span>
                </li>
                <li>
                  <b>One text</b>
                  <span>The best day in the window, not one a morning</span>
                </li>
              </ul>
            </div>
            <figure className="shotfig">
              {/* The day is computed here, on the server, for the same
                  reason serverNowMs is: the page is cached, so a date read
                  during a client render would disagree with its own HTML. */}
              <AlertSmsPhone
                parts={city.alertSms}
                when={nextSundayFrom(Date.now(), conditions?.tz ?? "America/Los_Angeles")}
                timeLabel={city.alertSmsTime ?? "6:04"}
              />
              {/* No longer claims the wording is the engine's own: the shape
                  is, but the hour in it is one field ahead of what
                  ScoreAlertItem carries (see alert-sms.ts). What is left is
                  checked -- the heads-up really does come days ahead, the
                  spot is really scored, and SMS is really Pro.

                  Do NOT grow this into a claim about what the alert checks
                  before it sends. That path has not been read, and an
                  unverified promise about closures is the worst kind to put
                  on an ad. */}
              <figcaption>
                Days ahead, not the morning of, so there is still time to
                plan. {city.alertSms.spot} is a spot we score around{" "}
                {card.cityName}, and alerts by text are part of Pro.
              </figcaption>
            </figure>
          </div>
        </section>
      ) : null}

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

            <TrackedCta city={city} variant={variant} cta="secondary" className="mapcta" href={explore}>
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
          <TrackedCta city={city} variant={variant} cta="final" className="go" href={explore}>
            {CTA_LABEL}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </TrackedCta>
        </div>
      </section>

      <div className="foot">
        ReelCaster {"·"} {card.cityName} and {city.footerWater}
        <br />
        Forecasts are guidance, not a guarantee. Always check current{" "}
        {region.regulator.name} regulations before you keep a fish.
      </div>
    </div>
  );
}
