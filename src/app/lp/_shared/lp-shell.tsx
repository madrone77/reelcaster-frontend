"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Angle } from "./lp-angles";
import { buildFeatures, buildLayers, priceStrings, PROOF, type LpTreatment } from "./lp-content";
import { usePricing } from "@/app/components/split-test/use-pricing";
import { useSplitExposure } from "@/app/components/split-test/report";
import { lpRegionFor } from "./lp-region";
import LpTrialForm from "./lp-trial-form";
import { reportLpCta, useLpHit } from "./lp-telemetry";
import LpFlagUs from "./lp-flag";
import type { LpCard } from "./lp-spot";
import { LP_CSS } from "./lp-css";

/**
 * The frame every /lp variant shares: header, the CTA under the hero, and the
 * whole body below it (trial timeline, feature stack, proof, score breakdown,
 * FAQ, closing CTA, footer, sticky bar).
 *
 * The hero itself is passed in, because that is the only thing the /lp/2 vs
 * /lp/3 test is meant to vary. Everything else living here — rather than being
 * copied into each variant — is what keeps the two pages honest: a copy fix
 * lands on both, so the experiment measures the hero and not the drift between
 * two diverging files.
 */

/**
 * Classic feature art, keyed by feature id. The signed-off /lp/2 and /lp/3
 * set: light line icons on a white tile.
 */
const CLASSIC_THUMBS: Record<string, React.ReactElement> = {
  forecast14: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="4" y="22" width="4" height="12" rx="1" fill="#D8DCEA" />
      <rect x="11" y="14" width="4" height="20" rx="1" fill="#16A34A" />
      <rect x="18" y="8" width="4" height="26" rx="1" fill="#16A34A" />
      <rect x="25" y="16" width="4" height="18" rx="1" fill="#16A34A" />
      <rect x="32" y="24" width="4" height="10" rx="1" fill="#D8DCEA" />
    </svg>
  ),
  alerts: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="28" height="32" rx="5" stroke="#0E1B47" strokeWidth="2.5" />
      <rect x="10" y="9" width="20" height="8" rx="2" fill="#DCFCE7" />
      <circle cx="13.5" cy="13" r="1.5" fill="#16A34A" />
      <rect x="10" y="20" width="14" height="2.5" rx="1.25" fill="#D8DCEA" />
      <rect x="10" y="25" width="10" height="2.5" rx="1.25" fill="#D8DCEA" />
    </svg>
  ),
  regulations: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="28" height="28" rx="5" stroke="#0E1B47" strokeWidth="2.5" />
      <path
        d="M12 20.5l4.5 4.5L28 14"
        stroke="#16A34A"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  customSpots: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M8 30c3-9 7-14 12-14s9 5 12 14"
        stroke="#2447E0"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="12" r="5" fill="#DCFCE7" stroke="#16A34A" strokeWidth="2.5" />
    </svg>
  ),
  catchLog: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="7" y="5" width="26" height="30" rx="4" stroke="#0E1B47" strokeWidth="2.5" />
      <path d="M13 13h14M13 19h14M13 25h9" stroke="#D8DCEA" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M25 27l3 3 5-6"
        stroke="#16A34A"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

/**
 * Feature glyphs, keyed by feature id.
 *
 * Drawn as marine instrument faces rather than the usual bell / calendar /
 * pencil set. The audience here runs chartplotters and sounders, and a thin
 * generic icon row is the fastest way to tell them this is a novelty app for
 * beginners. Each glyph shows the actual output of its feature: a score
 * sparkline, a message with a live dot, a management-area shield, a waypoint
 * reticle over depth contours, a logged data point against a tide curve.
 *
 * Set on a dark slate tile (see .f-thumb in lp-css.ts) so they read as
 * instrument panels at 44px on a phone, which is the only size that matters
 * for this traffic.
 */
const STROKE = "#7FE3D0";
const DIM = "#4A5A85";

const INSTRUMENT_THUMBS: Record<string, React.ReactElement> = {
  // Fourteen bars of score, the shape of the outlook itself.
  forecast14: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {[26, 22, 15, 11, 17, 24, 28, 21, 13, 9, 14, 20, 25, 29].map((y, i) => (
        <rect
          key={i}
          x={3 + i * 2.5}
          y={y}
          width="1.6"
          height={34 - y}
          rx="0.8"
          fill={y <= 13 ? STROKE : DIM}
        />
      ))}
      <path d="M3 34h34" stroke={DIM} strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  // A message with a live dot, not a notification bell.
  alerts: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M6 12a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H17l-7 5v-5a4 4 0 0 1-4-4z"
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="14.5" r="2" fill="#4ADE80" />
      <path d="M18 14.5h12M12 21h14" stroke={DIM} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  // A management-area shield: the authority, not a generic checkbox.
  regulations: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M20 5l12 4v11c0 7-5 12.5-12 15-7-2.5-12-8-12-15V9z"
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 20.5l4.5 4.5L27 16"
        stroke="#4ADE80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // A waypoint reticle sitting over depth contours.
  customSpots: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M3 28c6-5 11-5 17 0s11 4 17-1" stroke={DIM} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3 34c6-5 11-5 17 0s11 4 17-1" stroke={DIM} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="20" cy="16" r="7" stroke={STROKE} strokeWidth="1.5" />
      <path
        d="M20 6v4M20 22v4M10 16h4M26 16h4"
        stroke={STROKE}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="16" r="2.2" fill="#4ADE80" />
    </svg>
  ),
  // A logged point pinned against the tide curve it was caught on.
  catchLog: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M3 24c5 0 6-11 11-11s6 15 11 15 6-11 12-11"
        stroke={DIM}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M25 28V13" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2.5" />
      <circle cx="25" cy="28" r="3.2" fill="#4ADE80" />
      <path d="M3 34h34" stroke={DIM} strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
};

/**
 * Miniature of the real 14-day strip.
 *
 * A cut-down copy of the product's own forecast row rather than an abstract
 * chart: the point of this block is that the reader can see the thing they
 * would be buying, and a generic bar glyph shows them nothing they could not
 * have guessed. Five cells, not fourteen, because fourteen at this width is a
 * grey smear on a phone.
 *
 * The numbers are illustrative and the block is aria-hidden, the same status
 * as the glyphs it sits beside. It is a picture of the UI, not a claim about
 * today: the real, live figure on this page is the score card at the top,
 * which is resolved per city and is the number the page stands behind.
 */
function ForecastStripPreview() {
  const days = [
    { d: "WED", n: 86, today: true, best: false },
    { d: "THU", n: 86, today: false, best: false },
    { d: "FRI", n: 85, today: false, best: false },
    { d: "SAT", n: 87, today: false, best: true },
    { d: "SUN", n: 82, today: false, best: false },
  ];
  return (
    <div className="mini-strip" aria-hidden="true">
      {days.map((day) => (
        <div className={day.today ? "ms-cell today" : "ms-cell"} key={day.d}>
          {day.best ? <span className="ms-best">BEST</span> : null}
          <span className="ms-day">{day.d}</span>
          <span className="ms-num">{day.n}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Mock of the alert message itself.
 *
 * Carries the city the page resolved, so a Seattle ad shows a Seattle text.
 * Everything else on this page went to the trouble of naming the reader's own
 * water; a hardcoded city in the one element that looks like a real message
 * would undo that at the closest range.
 *
 * The timestamp is a fixed string on purpose. Reading a clock during render is
 * what makes a hydration mismatch, and this one is decoration.
 */
function SmsPreview({ cityName }: { cityName: string }) {
  return (
    <div className="mini-sms" aria-hidden="true">
      <div className="ms-bubble">
        The bite is hot in {cityName} this Saturday. Get your friends ready to fill the boat!
        {" - "}
        ReelCaster
      </div>
      <div className="ms-time">9:38 AM</div>
    </div>
  );
}

export default function LpShell({
  angle,
  checkoutHref,
  year,
  hero,
  card,
  treatment = "classic",
  showFlag = false,
  wide = false,
  from,
  chargeDate,
}: {
  angle: Angle;
  checkoutHref: string;
  /** Rendered server-side and passed down — reading the clock during a client
   *  render is what makes a footer year a hydration mismatch on New Year. */
  year: number;
  /** The variant's hero. Rendered above the primary CTA. */
  hero: React.ReactNode;
  /** Same card the hero renders — the breakdown block must show the same
   *  number. Two different scores on one page is the fastest way to make a
   *  visitor stop believing either of them. */
  card: LpCard;
  /** How the body is dressed. /lp/2 and /lp/3 stay on the signed-off classic
   *  treatment; /lp/5 opts into the instrument one. Defaults to classic so a
   *  new variant has to ask for the change rather than inherit it. */
  treatment?: LpTreatment;
  /** Show the market flag in the header chip. /lp/6 opts in; the pages that
   *  serve both sides of the border deliberately do not fly one country's
   *  flag over water belonging to the other. */
  showFlag?: boolean;
  /** Lay the page out for a desktop window above 900px, instead of centring
   *  the 480px phone column on a grey ground. Opt-in, and off by default: the
   *  other variants were signed off as a phone page and are mid-test, so this
   *  is /lp/6 only until it has numbers behind it. */
  wide?: boolean;
  /** Attribution key for the inline checkout post, e.g. "lp6-window". */
  from: string;
  /** First-charge date, formatted on the server. See trialChargeDate. */
  chargeDate: string;
}) {
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const finalCtaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  // Count the visit, once per tab. Every CTA below counts its own press, and
  // the two together are the only measure of whether this page works that
  // exists before somebody buys something.
  useLpHit(angle.id);

  // Sticky CTA rides between the two real CTAs: it appears once the hero button
  // has scrolled away and hides again at the closing button, so there are never
  // two competing buttons on screen at once.
  useEffect(() => {
    const heroCta = heroCtaRef.current;
    const finalCta = finalCtaRef.current;
    if (!heroCta || !finalCta || typeof IntersectionObserver === "undefined") return;

    let heroVisible = true;
    let finalVisible = false;
    const update = () => setShowSticky(!heroVisible && !finalVisible);

    const heroObs = new IntersectionObserver(
      ([e]) => {
        heroVisible = e.isIntersecting;
        update();
      },
      { threshold: 0 },
    );
    const finalObs = new IntersectionObserver(
      ([e]) => {
        finalVisible = e.isIntersecting;
        update();
      },
      { threshold: 0 },
    );
    heroObs.observe(heroCta);
    finalObs.observe(finalCta);
    return () => {
      heroObs.disconnect();
      finalObs.disconnect();
    };
  }, []);

  // Every jurisdiction-dependent string on the page hangs off the card's
  // province, so a Washington ad set never renders Canadian management areas.
  // This happens in both treatments: it is a defect fix, not a style choice.
  const region = lpRegionFor(card.provinceCode);

  // The reader's own price, not the build's. This page is ISR-cached, so the
  // server render is the control for everybody; the hook corrects it after
  // hydration for anyone in a test arm and does nothing at all when no price
  // test is running, which is the normal state.
  const pricing = usePricing(card.provinceCode);
  const PRICE = priceStrings(pricing);

  // Counted here rather than in the CTA, because the ask this page makes is
  // the price itself: a reader who scrolls past it and leaves was still shown
  // the arm, and a denominator that only counted button-pressers would make
  // every arm look identical.
  useSplitExposure(pricing, "lp");
  const instrument = treatment === "instrument";
  const featureCopy = buildFeatures(card, region, treatment);
  const features = angle.features.map((id) => featureCopy[id]);
  const layers = buildLayers(card, region, treatment);
  const thumbs = instrument ? INSTRUMENT_THUMBS : CLASSIC_THUMBS;

  const rootClass = ["lp", instrument ? "lp-instrument" : null, wide ? "lp-wide" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <style dangerouslySetInnerHTML={{ __html: LP_CSS }} />

      <div className="page">
        {/* Header: logo + trust chip. No nav — nothing competes with the CTA. */}
        <header>
          <div className="wrap header-row">
            <span className="logo">
              <Image
                src="/reelcaster-mark-blue.svg"
                alt="ReelCaster"
                width={128}
                height={42}
                priority
              />
            </span>
            <span className={showFlag ? "trust-chip with-flag" : "trust-chip"}>
              {showFlag && region.isUS ? <LpFlagUs /> : null}
              {region.trustChip}
            </span>
          </div>
        </header>

        {hero}

        <section className="hero-cta-band">
          <div className="wrap">
            <div ref={heroCtaRef}>
              <LpTrialForm
                from={from}
                region={card.provinceCode}
                chargeDate={chargeDate}
                ctaLabel={angle.cta}
                fallbackHref={checkoutHref}
                inputId="lp-email-hero"
                cta="hero"
                angle={angle.id}
              />
            </div>
          </div>
        </section>

        {/* TRIAL TIMELINE + PRICE */}
        <section className="section">
          <div className="wrap">
            <div className="section-kicker">How the free trial works</div>
            <div className="timeline">
              <div className="t-step">
                <div className="t-icon">🔓</div>
                <div className="t-body">
                  <div className="t-day">Today</div>
                  <div className="t-desc">
                    Start your free trial. Full 14-day forecasts, alerts, every spot unlocked.
                  </div>
                </div>
              </div>
              <div className="t-step">
                <div className="t-icon">🔔</div>
                <div className="t-body">
                  <div className="t-day">Day {PRICE.reminderDay}</div>
                  <div className="t-desc">
                    We email you three days out, <strong>before</strong> anything is charged.
                  </div>
                </div>
              </div>
              <div className="t-step charged">
                <div className="t-icon">✓</div>
                <div className="t-body">
                  <div className="t-day">Day {PRICE.trialDays}</div>
                  <div className="t-desc">
                    You&rsquo;re charged <strong>{PRICE.year}</strong>, or cancel in two taps and
                    pay nothing.
                  </div>
                </div>
              </div>
            </div>
            <p className="price-plain">
              {PRICE.trialDays} days free, then <b>{PRICE.year}</b> ({PRICE.perMonth})
            </p>
            <p className="price-anchor">{region.fuelAnchor}</p>
          </div>
        </section>

        {/* FEATURE STACK — order set by the angle. */}
        <section className="section white features">
          <div className="wrap">
            <div className="section-kicker">Everything Pro unlocks</div>
            {/* The wrapper carries no styling on a phone. It exists so the
                desktop layout can make the features a grid without the section
                kicker becoming a cell in it. */}
            <div className="feature-grid">
              {features.map((f) => (
                <div className="feature" key={f.id}>
                  <div className="f-thumb">{thumbs[f.id]}</div>
                  <div>
                    <div className="f-title">
                      {f.title}
                      {f.tag ? <span className="f-pro">{f.tag}</span> : null}
                    </div>
                    <div className="f-desc">{f.desc}</div>
                    {f.badge ? <span className="f-badge">{f.badge}</span> : null}
                    {/* Only the instrument treatment shows the UI mocks. Classic
                        stays on its icon-and-text layout, so the A/B still
                        measures the treatment rather than drifting into a third
                        design. */}
                    {instrument && f.id === "forecast14" ? <ForecastStripPreview /> : null}
                    {instrument && f.id === "alerts" ? (
                      <SmsPreview cityName={card.cityName} />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROOF — placeholder content, see PROOF in lp-content.ts. */}
        {PROOF.showProof ? (
          <section className="section">
            <div className="wrap">
              <div className="section-kicker">On the water with ReelCaster</div>
              <div className="stat-band">
                {PROOF.stats.map((s) => (
                  <div className="stat" key={s.label}>
                    <div className="stat-num">{s.num}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="quote">
                <p>&ldquo;{PROOF.quote.text}&rdquo;</p>
                <div className="quote-attr">{PROOF.quote.attr}</div>
              </div>
            </div>
          </section>
        ) : null}

        {/* HOW THE SCORE IS MADE */}
        <section className="section white">
          <div className="wrap">
            <div className="section-kicker">How the score is made</div>
            <div className="distill">
              <div className={`d-score d-${card.tier}`}>
                <span className="mono-label">ReelCaster Score</span>
                <span className="d-num">{card.score}</span>
                {card.tagWord ? <span className="d-tag">{card.tagWord}</span> : null}
              </div>
              <div className="d-line" />
              <div className="d-stack" role="list" aria-label="Signal layers behind the score">
                {layers.map((l) => (
                  <div className={l.top ? "d-layer top" : "d-layer"} role="listitem" key={l.label}>
                    {/* Both the species on the top row and the agencies on the
                        bottom two are resolved, not hardcoded: these are the
                        rows that claim to describe this specific water. */}
                    <span className="d-label">{l.label}</span>
                    <span className="d-src">{l.src}</span>
                  </div>
                ))}
              </div>
              <p className="d-caption">
                {instrument
                  ? "One number out of 100 from tides, current, swell, wind, weather and the bite. Refreshed through the day."
                  : "Hundreds of signals across five layers, distilled into one number. Refreshed through the day."}
              </p>
            </div>
          </div>
        </section>

        {/* FAQ — the three real objections. */}
        <section className="section">
          <div className="wrap">
            <div className="section-kicker">Before you start</div>
            <details>
              <summary>Do I need a credit card?</summary>
              <div className="faq-a">
                Yes, but you won&rsquo;t be charged for {PRICE.trialDays} days, and we email you on
                day {PRICE.reminderDay} so nothing surprises you. Cancel in two taps from your
                account, no phone calls, no forms.
              </div>
            </details>
            <details>
              <summary>What waters do you cover?</summary>
              <div className="faq-a">
                Pro covers {region.coverageAnswer}: reefs, banks and ledges, plus your own pinned
                spots inside that coverage. More regions are coming.
              </div>
            </details>
            <details>
              <summary>What happens if I cancel?</summary>
              <div className="faq-a">
                Cancel during the trial and you pay nothing. Your account, your spots, and your
                catch log stay, and you keep the free 7-day forecast. Cancel later and Pro runs to the
                end of your paid year.
              </div>
            </details>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final">
          <div className="wrap">
            <h2>{angle.closer}</h2>
            <div ref={finalCtaRef}>
              <LpTrialForm
                from={from}
                region={card.provinceCode}
                chargeDate={chargeDate}
                ctaLabel={angle.cta}
                fallbackHref={checkoutHref}
                inputId="lp-email-final"
                cta="final"
                angle={angle.id}
              />
            </div>
          </div>
        </section>

        <footer>
          <div className="wrap">
            <span>© {year} ReelCaster</span>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </div>
        </footer>
      </div>

      <div className={showSticky ? "sticky-cta show" : "sticky-cta"}>
        <div className="sticky-inner">
          <div className="sticky-price">
            <b>{PRICE.trialDays} days free</b>
            <span>
              then {PRICE.year}
              {instrument ? ` (${PRICE.perMonth})` : ""}
            </span>
            {instrument ? <span className="sticky-cancel">Cancel in two taps</span> : null}
          </div>
          {/* The form is the checkout now, so this scrolls to the nearest one
              and puts the cursor in it rather than navigating away. */}
          <button
            type="button"
            className="btn"
            onClick={() => {
              // Counts as a press even though it scrolls rather than
              // navigates: the visitor reached for the button, which is the
              // thing being measured. The form they land in counts its own
              // submit separately, so a scroll that goes nowhere is visible as
              // sticky clicks with no matching final clicks.
              reportLpCta("sticky", angle.id);
              finalCtaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              window.setTimeout(
                () => document.getElementById("lp-email-final")?.focus(),
                420,
              );
            }}
          >
            Start free trial
          </button>
        </div>
      </div>
    </div>
  );
}
