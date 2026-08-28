import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { angleFrom } from "../_shared/lp-angles";
import { resolveLpCard } from "../_shared/lp-spot";
import { lpRegionFor } from "../_shared/lp-region";
import { PRICE } from "../_shared/lp-content";
import { trialChargeDate } from "../_shared/lp-checkout";
import { fetchMapSpots } from "@/lib/bluecaster";
import { loadCityBySlug } from "@/app/fishing/[province]/[city]/instrument/load-city";
import KeepToday from "@/app/fishing/[province]/[city]/hub/keep-today";
import {
  ANON_FORECAST_DAYS,
  FREE_FORECAST_DAYS,
  PRO_FORECAST_DAYS,
} from "@/lib/forecast-horizon";
import ExploreReel from "../_reel/explore-reel";
import { buildCityProof, type CityProof } from "../_reel/city-proof";
import type { BlendCity } from "./blend-city";
import { BLEND_CSS } from "./blend-css";
import BlendInstrument from "./blend-instrument";
import { BlendHit, BlendTrialForm, TrackedCta } from "./blend-track";

/**
 * The two Seattle blends: /lp/seattle/1's hero on top of /lp/7's instrument.
 *
 * ── What it takes from each ──────────────────────────────────────────────
 *
 * From /lp/seattle/1: the shell, and the animated Explore reel. A phone
 * walking the city's own marks, pin to pin, is the one thing on any of these
 * pages that shows the product working rather than describing it, and it costs
 * one 80 KB still plus markup, no map engine, no tiles, no video to go stale
 * the next time a score moves.
 *
 * From /lp/7/<city>: the headline and everything under the fold. The H1 names
 * today's actual best window at a named mark, and below the hero sits the real
 * city instrument, the 14-day strip, the 24-hour chart, every mark we score,
 * the map, custom spots, and what is legal to keep today. Each of its sections
 * carries its own three-claim intro, which is why none of that copy is
 * restated here.
 *
 * ── What it drops ────────────────────────────────────────────────────────
 *
 * /lp/seattle/1's middle: the marketing screenshot, the proof strip, the
 * scoring ladder, the marks list, the six-tabs chips, the review and the FAQ.
 * All of it argues that the product has real data. The instrument IS the real
 * data, on the page, and an argument standing in front of the evidence is nine
 * screens the reader has to get past to reach it. The one band kept from that
 * half is "how far ahead you can see", because it is the offer rather than a
 * claim, and it is the question a reader has after scrolling a strip with
 * padlocks on it.
 *
 * ── The two variants ─────────────────────────────────────────────────────
 *
 * `ask` is the whole difference between /lp/seattle/2 and /lp/seattle/3, and
 * it is the thing being tested:
 *
 *   "explore"  A link and nothing else. No email, no card. The argument is
 *              that the free tier already answers the question the ad asked,
 *              is today worth going, and that asking for a card in front of
 *              the answer is a wall in front of the demo.
 *   "trial"    Email, then Stripe, with the amount and the charge date under
 *              the button. The argument is that a page carrying this much real
 *              data has already earned the ask, and that sending a warm reader
 *              into a free tier is spending the moment they were ready.
 *
 * Both count into the same campaign table under their own landing key, so the
 * report can put them side by side.
 *
 * ── What it does NOT change ──────────────────────────────────────────────
 *
 * The data. The instrument loads through `loadCityBySlug`, which is where the
 * anonymous-horizon slicing lives, exactly as /lp/7 does. Nothing here fetches
 * its own forecast, so this page cannot be the one that ships day-9 scores to
 * cold traffic.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

/**
 * The city is the route, not a route PARAMETER.
 *
 * `/lp/<city>/<n>` rather than `/lp/<n>/[city]` like the numbered variants,
 * because this page cannot serve an arbitrary city: the reel is drawn on a
 * baked still of that city's own water, and a still is a capture somebody has
 * to make and a frame somebody has to solve. A city with no capture would
 * render a phone showing the wrong bay, which is worse than rendering no phone
 * at all. See ../_reel/reel-frame.ts and blend-city.ts.
 */

/** Where a reader goes when the ask is a link rather than a form. z=10 frames
 *  a city the way the app's own city view does; without it Explore opens at
 *  zoom 9, which on either of these inlets shows water nobody in this ad is
 *  launching into. */
const exploreHref = (slug: string) => `/explore?loc=${slug}&z=10`;

export type BlendAsk = "explore" | "trial";

const LABEL: Record<BlendAsk, string> = {
  explore: "Start Exploring Free",
  trial: "Start Free Trial",
};

/**
 * The line under the button, and the whole of the qualification on it.
 *
 * On the explore variant "to start" is doing real work: what is free is
 * getting in, not everything past it, and a flat "no account and no card"
 * would be read as a claim about the whole product by somebody who then meets
 * the day limit on the next screen. The trial variant states its terms in the
 * form instead, under the button, where a card-required trial has to state
 * them.
 */
const EXPLORE_NOTE = "No account and no card to start.";

/**
 * The title and description, and NOTHING read off the query string.
 *
 * /lp/seattle/1 and the numbered variants vary these by `?a=`, which is what
 * makes them `ƒ` in the build output. Reading searchParams anywhere in a route
 * opts the whole thing out of static generation, and `generateMetadata`
 * counts, so every ad click pays for a cold render of three upstream calls
 * before it sees anything. `export const revalidate` does not save it; that
 * caches the fetches, not the render.
 *
 * The angle buys almost nothing here to set against that. These pages are
 * noindex, so the description is never read by anyone, and the title is a
 * browser tab on a page bought by the click. The angle still does its real
 * job: blend-track.tsx reads `?a=` on the client and files every hit and press
 * under it, so the report can still tell the pitches apart.
 *
 * Keep it that way. A single `searchParams` read added back here silently
 * turns both variants dynamic again, and the build output is the only place
 * that would say so.
 */
export async function blendMetadata(city: BlendCity): Promise<Metadata> {
  const card = await resolveLpCard(city.slug);
  const fallback = angleFrom({});
  return {
    title: {
      absolute: card
        ? `${card.cityName} fishing: the hours worth going | ReelCaster`
        : `${fallback.title} | ReelCaster`,
    },
    description: card
      ? `Every hour at every ${card.cityName} fishing spot, scored. ${fallback.subhead}`
      : fallback.subhead,
    robots: { index: false, follow: true },
  };
}

export default async function BlendPage({
  city: cfg,
  ask,
  landing,
}: {
  /** Which city, which capture, and how it bills. See blend-city.ts. */
  city: BlendCity;
  ask: BlendAsk;
  /** The campaign key this variant records under, e.g. "lpseattle2". */
  landing: string;
}) {
  /**
   * Three loads, one round trip each at most.
   *
   * `loadCityBySlug` and `resolveLpCard` both call `fetchMapSpots({ city })`,
   * and so does the line below; Next dedupes identical fetches within a render
   * pass, so the three of them are one request. They are kept separate because
   * they answer different questions: the instrument's own data, the card the
   * reel's proof is built against, and the payload the reel walks.
   */
  const [city, card, payload] = await Promise.all([
    loadCityBySlug(cfg.slug),
    resolveLpCard(cfg.slug),
    fetchMapSpots({ city: cfg.slug }).catch(() => null),
  ]);
  if (!card) notFound();

  const region = lpRegionFor(card.provinceCode);
  const proof: CityProof | null = payload ? buildCityProof(payload, card) : null;

  /**
   * The headline, from /lp/7.
   *
   * `headlineWindow` is read off the SAME featured mark the 24-hour chart
   * further down draws, so the H1 and the chart can never advertise different
   * hours at different water. It is named in the line underneath rather than
   * left implied: this page puts a reel of eight other marks directly beside
   * the headline, and a window with no mark attached to it would read as a
   * claim about the whole city, which is not a thing that exists.
   */
  const window = city.headlineWindow;
  const featuredName = city.featured?.name ?? null;

  const chargeDate = trialChargeDate(PRICE.trialDays);

  return (
    <>
      {/* ── The hero, from /lp/seattle/1 ─────────────────────────────── */}
      <div className="l8">
        <style dangerouslySetInnerHTML={{ __html: BLEND_CSS }} />
        <BlendHit landing={landing} citySlug={cfg.slug} />

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
            <TrackedCta
              landing={landing}
              citySlug={cfg.slug}
              cta="nav"
              className="navcta"
              href={ask === "trial" ? "#start" : exploreHref(cfg.slug)}
            >
              {LABEL[ask]}
            </TrackedCta>
          </div>
        </div>

        <div className="hero">
          <div className="shell herogrid">
            <div>
              <p className="pin">
                <i />
                {city.city.name}
                {region.areaBadge ? ` · ${region.areaBadge}` : ""}
              </p>

              {/* /lp/7's H1, with the window set in the accent. The fallback
                  is /lp/7's own: on a day with no resolved window the page
                  says where it is rather than inventing hours. */}
              <h1>
                {window ? (
                  <>
                    Today&rsquo;s best fishing in {city.city.name}:{" "}
                    <em>{window}</em>
                  </>
                ) : (
                  <>
                    Fishing in {city.city.name}, {city.city.provinceCode}
                  </>
                )}
              </h1>

              <p className="herosub">
                {featuredName && window ? (
                  <>
                    That window is today&rsquo;s best at {featuredName}. Below
                    it is the real thing, not a screenshot: every hour at every{" "}
                    {city.city.name} spot, scored, {PRO_FORECAST_DAYS} days out.
                  </>
                ) : (
                  <>
                    This page is the real thing, not a screenshot: every hour at
                    every {city.city.name} spot, scored, {PRO_FORECAST_DAYS}{" "}
                    days out.
                  </>
                )}
              </p>

              <div id="start">
                {ask === "trial" ? (
                  <BlendTrialForm
                    landing={landing}
                    citySlug={cfg.slug}
                    region={cfg.billingRegion}
                    cta="hero"
                    inputId="blend-hero-email"
                    chargeDate={chargeDate}
                    price={PRICE.year}
                    ctaLabel={LABEL.trial}
                  />
                ) : (
                  <>
                    <TrackedCta
                      landing={landing}
                      citySlug={cfg.slug}
                      cta="hero"
                      className="go"
                      href={exploreHref(cfg.slug)}
                    >
                      {LABEL.explore}
                      <Arrow />
                    </TrackedCta>
                    <p className="gonote">{EXPLORE_NOTE}</p>
                  </>
                )}
              </div>
            </div>

            {/* Explore, on a phone, walking the city's own marks.
                Falls back to nothing rather than to a broken phone: the reel is
                built from the same payload as the instrument below, and if that
                failed the hero simply becomes a one-column text block. */}
            {proof && proof.pins.length > 1 ? (
              <div className="stage">
                <ExploreReel
                  cityName={city.city.name}
                  pins={proof.pins}
                  frame={cfg.frame}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── The live data, from /lp/7 ─────────────────────────────────────
          Deliberately OUTSIDE the `.l8` wrapper. `.l8 h2` and `.l8 section`
          are element selectors at (0,1,1) and would outrank the Tailwind
          utilities this component and the public city page share. The bands
          meet without a seam because --l8-bg and --rc-bg are both #F5F6F7. */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-12 space-y-6">
        <BlendInstrument
          landing={landing}
          citySlug={cfg.slug}
          cityName={city.city.name}
          cityLat={city.city.lat}
          cityLng={city.city.lng}
          tz={city.tz}
          serverNowMs={Date.now()}
          initialForecast={city.cityForecast}
          featured={city.featured}
          rows={city.rankedRows}
          rosterCount={city.spots.length}
        />

        <KeepToday
          rows={city.seasonRows}
          cityName={city.city.name}
          provinceCode={city.city.provinceCode}
          regulator={city.regulator}
        />
      </div>

      {/* ── The offer, and the close ─────────────────────────────────────
          The one band kept from /lp/seattle/1's middle. It answers the
          question a reader has directly after scrolling a 14-day strip with
          padlocks on the back half of it, which is how far ahead they get
          without paying. Everything else in that half argued that the data is
          real, and the reader has just scrolled through the data. */}
      <div className="l8">
        <section className="white">
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
                  hour, at every {city.city.name} spot. Nothing to fill in, and
                  it is what you just scrolled.
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

        <section className="close">
          <div className="shell">
            <h2>Fish the three hours, not the whole day.</h2>
            <p className="sub">
              {window
                ? `Today it is ${window}. Tomorrow it is somewhere else, and the map already knows where.`
                : `Open the live ${city.city.name} map and see the next ${ANON_FORECAST_DAYS} days scored, spot by spot and hour by hour.`}
            </p>
            {ask === "trial" ? (
              <BlendTrialForm
                landing={landing}
                citySlug={cfg.slug}
                region={cfg.billingRegion}
                cta="final"
                inputId="blend-final-email"
                chargeDate={chargeDate}
                price={PRICE.year}
                ctaLabel={LABEL.trial}
              />
            ) : (
              <>
                <TrackedCta
                  landing={landing}
                  citySlug={cfg.slug}
                  cta="final"
                  className="go"
                  href={exploreHref(cfg.slug)}
                >
                  {LABEL.explore}
                  <Arrow />
                </TrackedCta>
                <p className="gonote">{EXPLORE_NOTE}</p>
              </>
            )}
          </div>
        </section>

        <div className="foot">
          ReelCaster {"·"} {city.city.name} and {cfg.water}
          <br />
          Forecasts are guidance, not a guarantee. Always check current{" "}
          {city.regulator.name} regulations before you keep a fish.
        </div>
      </div>
    </>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h9M8.5 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
