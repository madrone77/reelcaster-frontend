"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Angle } from "./lp-angles";
import { FEATURES, LAYERS, PRICE, PROOF } from "./lp-content";
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

/** Feature thumbnail art, keyed by feature id. */
const THUMBS: Record<string, React.ReactElement> = {
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

export default function LpShell({
  angle,
  checkoutHref,
  year,
  hero,
}: {
  angle: Angle;
  checkoutHref: string;
  /** Rendered server-side and passed down — reading the clock during a client
   *  render is what makes a footer year a hydration mismatch on New Year. */
  year: number;
  /** The variant's hero. Rendered above the primary CTA. */
  hero: React.ReactNode;
}) {
  const heroCtaRef = useRef<HTMLAnchorElement>(null);
  const finalCtaRef = useRef<HTMLAnchorElement>(null);
  const [showSticky, setShowSticky] = useState(false);

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

  const features = angle.features.map((id) => FEATURES[id]);

  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: LP_CSS }} />

      <div className="page">
        {/* Header: logo + trust chip. No nav — nothing competes with the CTA. */}
        <header>
          <div className="wrap header-row">
            <span className="logo">
              <Image
                src="/reelcaster-mark.svg"
                alt="ReelCaster"
                width={104}
                height={34}
                priority
              />
            </span>
            <span className="trust-chip">DFO + NOAA DATA</span>
          </div>
        </header>

        {hero}

        <section className="hero-cta-band">
          <div className="wrap">
            <a ref={heroCtaRef} className="btn" href={checkoutHref}>
              {angle.cta}
            </a>
            <p className="cta-micro">
              <strong>Cancel anytime.</strong> We remind you before you&rsquo;re charged.
            </p>
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
                    We email you three days out — <strong>before</strong> anything is charged.
                  </div>
                </div>
              </div>
              <div className="t-step charged">
                <div className="t-icon">✓</div>
                <div className="t-body">
                  <div className="t-day">Day {PRICE.trialDays}</div>
                  <div className="t-desc">
                    You&rsquo;re charged <strong>{PRICE.year}</strong> — or cancel in two taps and
                    pay nothing.
                  </div>
                </div>
              </div>
            </div>
            <p className="price-plain">
              {PRICE.trialDays} days free, then <b>{PRICE.year}</b> ({PRICE.perMonth})
            </p>
            <p className="price-anchor">Less than a single litre of boat fuel per month.</p>
          </div>
        </section>

        {/* FEATURE STACK — order set by the angle. */}
        <section className="section white">
          <div className="wrap">
            <div className="section-kicker">Everything Pro unlocks</div>
            {features.map((f) => (
              <div className="feature" key={f.id}>
                <div className="f-thumb">{THUMBS[f.id]}</div>
                <div>
                  <div className="f-title">
                    {f.title}
                    {f.tag ? <span className="f-pro">{f.tag}</span> : null}
                  </div>
                  <div className="f-desc">{f.desc}</div>
                </div>
              </div>
            ))}
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
                <div className="quote-attr">— {PROOF.quote.attr}</div>
              </div>
            </div>
          </section>
        ) : null}

        {/* HOW THE SCORE IS MADE */}
        <section className="section white">
          <div className="wrap">
            <div className="section-kicker">How the score is made</div>
            <div className="distill">
              <div className="d-score">
                <span className="mono-label">ReelCaster Score</span>
                <span className="d-num">85</span>
                <span className="d-tag">GOOD</span>
              </div>
              <div className="d-line" />
              <div className="d-stack" role="list" aria-label="Signal layers behind the score">
                {LAYERS.map((l) => (
                  <div className={l.top ? "d-layer top" : "d-layer"} role="listitem" key={l.label}>
                    <span className="d-label">{l.label}</span>
                    <span className="d-src">{l.src}</span>
                  </div>
                ))}
              </div>
              <p className="d-caption">
                Hundreds of signals across five layers, distilled into one number — refreshed
                through the day.
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
                Yes — but you won&rsquo;t be charged for {PRICE.trialDays} days, and we email you on
                day {PRICE.reminderDay} so nothing surprises you. Cancel in two taps from your
                account, no phone calls, no forms.
              </div>
            </details>
            <details>
              <summary>What waters do you cover?</summary>
              <div className="faq-a">
                Pro covers coastal British Columbia and Washington — reefs, banks, and ledges, plus
                your own pinned spots inside that coverage. More regions are coming.
              </div>
            </details>
            <details>
              <summary>What happens if I cancel?</summary>
              <div className="faq-a">
                Cancel during the trial and you pay nothing. Your account, your spots, and your
                catch log stay — you keep the free 7-day forecast. Cancel later and Pro runs to the
                end of your paid year.
              </div>
            </details>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final">
          <div className="wrap">
            <h2>{angle.closer}</h2>
            <a ref={finalCtaRef} className="btn" href={checkoutHref}>
              {angle.cta}
            </a>
            <p className="cta-micro">
              <strong>Cancel anytime.</strong> {PRICE.trialDays} days free, then {PRICE.year}.
            </p>
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
            <span>then {PRICE.year}</span>
          </div>
          <a className="btn" href={checkoutHref}>
            Start free trial
          </a>
        </div>
      </div>
    </div>
  );
}
