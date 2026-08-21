"use client";

import { Star } from "lucide-react";
import { PRICE, PROOF } from "@/app/lp/_shared/lp-content";
import { lpRegionFor } from "@/app/lp/_shared/lp-region";
import LpFlagUs from "@/app/lp/_shared/lp-flag";
import type { CampaignTarget, LpCtaId } from "@/app/lp/_shared/lp-telemetry";
import { useAdCheckout } from "@/app/components/paywall/use-ad-checkout";
import type { AdWall } from "../[slug]/ad-mode";

/**
 * The card ask, inline on an ad-framed spot page.
 *
 * A sibling of src/app/lp/_shared/lp-trial-form.tsx and deliberately a
 * separate component: that one is dressed in the `lp-*` classes injected by
 * LpShell, and this one sits in the middle of a page built from the rc-*
 * tokens. Only the dressing differs. Everything that decides whether the
 * charge is lawful is the same, and is copied here on purpose rather than
 * abstracted, because the two pages must be independently readable as
 * compliant:
 *
 * 1. The disclosure. A card-required trial that auto-charges has to state the
 *    amount, the date and how to cancel before the customer consents (US FTC
 *    negative-option rule, Canadian consumer-protection rules). It sits under
 *    the button because "clear and conspicuous" means beside the thing you are
 *    pressing, not somewhere on the same document.
 * 2. The email. It is what lets the checkout route decide whether this person
 *    may have another trial BEFORE Stripe applies one. Posting without it
 *    would hand a repeat customer a fresh trial and leave the webhook to claw
 *    it back.
 *
 * `PRICE` is imported rather than restated so the two forms cannot quote
 * different money.
 */

/** What the wall is holding back, in the reader's terms. */
function pitchFor(
  wall: AdWall,
  spotName: string,
  cityName: string | null,
): { head: string; sub: string } {
  // "every other spot in Victoria and beyond" only works when we know the
  // city. A custom spot, or one whose city is not published, has no name to
  // put there, and "in null and beyond" is worse than the shorter sentence.
  const beyond = cityName
    ? `every other spot in ${cityName} and beyond`
    : "every other spot we track";
  // "All 14 days" rather than "the next 13", on every wall.
  //
  // The arithmetic was right — a reader at the `today` wall has day one and is
  // being sold the thirteen after it — and it read like arithmetic. What they
  // get is the whole fortnight, which is also what the `day2` wall says, and
  // one headline across both walls means the wall test measures the WALL
  // rather than two different promises.
  if (wall === "today") {
    return {
      head: `See all 14 days at ${spotName}`,
      sub: `Today is above. Sign up to see all 14 here and ${beyond}.`,
    };
  }
  if (wall === "day2") {
    return {
      head: `See all 14 days at ${spotName}`,
      // Not "this weekend": the two open days are today and tomorrow, which on
      // a Tuesday is not a weekend and reads as a page that does not know what
      // day it is.
      // Twelve, not thirteen: this wall has already given away two days. The
      // count in each sub-line is the number that reader has left to buy, so
      // it has to move with the wall.
      sub: "You have today and tomorrow. Pro has the other twelve, hour by hour, plus a text when a good window opens.",
    };
  }
  return {
    head: `Get a text when ${spotName} comes good`,
    sub: "Set the score you care about and we watch the forecast for it. Plus the full 14-day outlook and catch reports.",
  };
}

/**
 * Who the numbers come from, named by agency.
 *
 * Agency NAMES, and on American water a flag.
 *
 * The flag is the market cue — this page runs on American data for American
 * water — and it is the same inline SVG /lp/6 flies, desaturated so it sits
 * with the type instead of shouting over the offer beside it. Drawn inline
 * rather than set as the 🇺🇸 emoji, which has no glyph on most Windows builds
 * and falls back to the letters "US" in a box.
 *
 * ⚠️ US WATER ONLY, and this is the one thing here that must never be wrong.
 * American chrome over Canadian water with DFO regulations printed underneath
 * is exactly the error /lp/6 redirects non-US cities to avoid, and this frame
 * has no redirect to lean on: it serves whatever spot the ad names. So the
 * flag hangs off `region.isUS`, resolved from the spot's own province, and a
 * BC spot renders the same row with no flag on it.
 *
 * Each line says what its agency SUPPLIES, because "NOAA" alone is a badge
 * while "tides and currents from NOAA" is a checkable claim. Agency emblems
 * are deliberately absent — see the note in the pull request; a flag is not a
 * trademark and carries none of that question.
 */
function SourceRow({ provinceCode }: { provinceCode: string }) {
  const region = lpRegionFor(provinceCode);

  // One line each, because they are three separate claims about three
  // different agencies and a single run-on row read as one long credit that
  // the eye skips. A reader checking whether we use their tide authority
  // should find that in its own line rather than in the middle of a sentence.
  const sources = [
    `Tides and currents from ${region.tideAuthority}`,
    `Regulations from ${region.regulator.name}`,
    "Weather from ECMWF and GFS",
  ];

  return (
    <div className="mt-4 flex items-start gap-2.5">
      {region.isUS && (
        /* Sized to stand beside the list rather than sit inside a line of
           type: at 12px it read as punctuation. mt-[2px] lands its top edge on
           the first bullet's cap height. */
        <span className="mt-[2px] shrink-0 grayscale opacity-75">
          <LpFlagUs size={20} />
        </span>
      )}
      <ul className="space-y-1 font-rc-mono text-[10px] uppercase tracking-[0.07em] text-rc-ink-mute">
        {sources.map((line) => (
          <li key={line} className="flex gap-1.5">
            <span aria-hidden className="text-rc-ink-mute/60">
              ·
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The customer quote, with its rating.
 *
 * The words are `PROOF.quote`, imported rather than copied so this page cannot
 * drift from the one place that records the quote is real, permissioned and
 * verbatim, and cannot be edited for length here. `PROOF.showProof` is
 * honoured too: if the band is ever switched off it goes off everywhere.
 *
 * The rating is `PROOF.quote.rating`, which the customer gave, and is read
 * rather than hardcoded so the stars cannot outlive it. Drawing five filled
 * stars in markup would be a second copy of a claim about a real person, free
 * to disagree with the record the moment either changed.
 */
function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex gap-0.5" aria-label={`${filled} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < filled ? "fill-rc-badge text-rc-badge" : "fill-none text-rc-rule"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}

function Testimonial() {
  if (!PROOF.showProof) return null;
  return (
    <figure className="mt-5 rounded border border-rc-rule bg-rc-panel/70 p-4">
      <Stars rating={PROOF.quote.rating} />
      <blockquote className="rc-body mt-2 text-[13px] leading-relaxed text-rc-ink-soft">
        {PROOF.quote.text}
      </blockquote>
      <figcaption className="mt-2 font-rc-mono text-[11px] text-rc-ink-mute">
        {PROOF.quote.attr}
      </figcaption>
    </figure>
  );
}

export default function AdTrialCta({
  spotName,
  cityName,
  region,
  chargeDate,
  wall,
  cta,
  inputId,
  dims,
  withProof = false,
}: {
  spotName: string;
  /** The city this spot belongs to, for the "and every other spot in X" line.
   *  Null for a custom spot or one whose city is not published. */
  cityName: string | null;
  /** Billing region, e.g. "WA". Decides the currency: BC bills CAD, WA USD.
   *  Empty is allowed; the route falls back to edge geo. */
  region: string;
  /** Server-rendered date the first charge lands. Reading a clock during a
   *  client render is what turns a date into a hydration mismatch, a bug this
   *  page has already paid for once. */
  chargeDate: string;
  wall: AdWall;
  /** Which copy of the form this is, for the CTA counter. */
  cta: LpCtaId;
  /** Ids must differ between the copies of this form on one page. */
  inputId: string;
  dims: CampaignTarget;
  /**
   * Show the sources and the customer quote with this copy of the form.
   *
   * Set on the one at the wall, where the decision is actually made, and not
   * on the closing one: the same quote twice on a page this short reads as
   * padding rather than as proof.
   */
  withProof?: boolean;
}) {
  const { head, sub } = pitchFor(wall, spotName, cityName);
  const { email, setEmail, submitting, error, submit, from } = useAdCheckout({
    wall,
    region,
    cta,
    dims,
  });

  return (
    <section className="rounded-lg border border-rc-brand/30 bg-rc-brand-soft/40 p-5 lg:p-6">
      <h2 className="rc-title-lg text-xl lg:text-2xl">{head}</h2>
      <p className="rc-body text-sm text-rc-ink-soft mt-2 max-w-[52ch]">{sub}</p>

      <form className="mt-5 max-w-[34rem]" onSubmit={submit}>
        <label
          className="rc-label text-[9px] block mb-1.5"
          htmlFor={inputId}
        >
          Your email
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id={inputId}
            className="flex-1 min-w-0 rounded border border-rc-rule bg-rc-panel px-3 py-3 text-[15px] text-rc-ink placeholder:text-rc-ink-mute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 rounded bg-rc-brand px-5 py-3 text-white font-semibold text-[15px] hover:bg-rc-brand/90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand transition-colors"
          >
            {submitting ? "Starting…" : `Start ${PRICE.trialDays}-day trial`}
          </button>
        </div>

        {/* The disclosure. Under the button on purpose, see the note above. */}
        <p className="font-rc-mono text-[11px] leading-relaxed text-rc-ink-mute mt-3">
          Free until <strong className="text-rc-ink-soft">{chargeDate}</strong>,
          then <strong className="text-rc-ink-soft">{PRICE.year}</strong> until
          you cancel. Cancel any time before then and you pay nothing. No
          account needed, we make one from this email.
        </p>

        {withProof && <SourceRow provinceCode={region} />}
        {withProof && <Testimonial />}

        {error ? (
          <p className="text-[13px] text-rc-poor-ink mt-2" role="alert">
            {error}{" "}
            <a className="underline" href={`/plans/checkout?from=${from}`}>
              Continue on the checkout page instead.
            </a>
          </p>
        ) : null}
      </form>
    </section>
  );
}
