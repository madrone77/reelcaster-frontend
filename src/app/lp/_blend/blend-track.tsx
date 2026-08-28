"use client";

import { useMemo, useState } from "react";
import { angleFrom } from "../_shared/lp-angles";
import {
  reportCampaignCta,
  useCampaignHit,
  type CampaignTarget,
  type LpCtaId,
} from "../_shared/lp-telemetry";

/**
 * Counting a city-first landing page.
 *
 * `parseLpPath` in lp-telemetry recognises `/lp/<n>/<city>` and nothing else,
 * so on `/lp/seattle/2` it returns an empty landing and every counter that
 * reads it returns early. That is not hypothetical: /lp/seattle/1 shipped that
 * way and recorded nothing at all, not a view, not a click, which looks
 * exactly like a page nobody visited. See ../1/lp-track.tsx.
 *
 * The fix is the one lp-telemetry prescribes for surfaces the parser does not
 * speak for: pass the dimensions in. The parser is shared with five running
 * variants and is not worth widening, and it could not get the city right here
 * anyway, this route's segment is `seattle`, while every row in the table
 * carries a full slug like `seattle-wa`, so reading it would split one city
 * across two values of the column the report groups by. That is also why the
 * slug is threaded through as a prop rather than read back off the path.
 *
 * The same target is handed to `CityInstrument` further down the page, which
 * is where the locked-day wall and the custom-spot wall are. Those are the two
 * asks the instrument half of this page actually makes, and they were the
 * reason the prop exists.
 */

/**
 * The angle is read from the URL on the client, not passed down.
 *
 * The page component deliberately does not touch searchParams: reading them on
 * the server opts the route out of ISR and makes every ad click render from
 * scratch. `campaignDims` already reads the query string for the UTM fields,
 * so the angle rides along the same way and the page stays cacheable.
 */
function currentAngle(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search);
  return angleFrom({
    a: q.get("a") ?? undefined,
    utm_content: q.get("utm_content") ?? undefined,
  }).id;
}

function targetFor(
  landing: string,
  citySlug: string,
  angle: string,
): CampaignTarget {
  return {
    landing,
    target_city: citySlug,
    target_spot: "",
    wall: "",
    angle,
  };
}

/** Count this visit, once per tab. Renders nothing. */
export function BlendHit({
  landing,
  citySlug,
}: {
  landing: string;
  citySlug: string;
}) {
  const angle = useMemo(currentAngle, []);
  useCampaignHit(targetFor(landing, citySlug, angle));
  return null;
}

/**
 * The target to hand `CityInstrument`, resolved on the client.
 *
 * A hook rather than a constant because the angle comes off the URL, and the
 * memo keeps the object identity stable so the instrument's own callbacks are
 * not rebuilt on every render.
 */
export function useBlendTarget(
  landing: string,
  citySlug: string,
): CampaignTarget {
  const angle = useMemo(currentAngle, []);
  return useMemo(
    () => targetFor(landing, citySlug, angle),
    [landing, citySlug, angle],
  );
}

/**
 * A CTA that counts the press before it navigates.
 *
 * `cta` is the POSITION, never the label. That is what makes the hero here
 * comparable with the hero on every other variant, and it is why renaming the
 * button does not break the series.
 */
export function TrackedCta({
  landing,
  citySlug,
  cta,
  href,
  className,
  children,
}: {
  landing: string;
  citySlug: string;
  cta: LpCtaId;
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className={className}
      href={href}
      onClick={() =>
        reportCampaignCta(cta, targetFor(landing, citySlug, currentAngle()))
      }
    >
      {children}
    </a>
  );
}

/**
 * The email field and the button that starts checkout, for the variant that
 * asks for a card.
 *
 * Posts straight to /api/stripe/checkout rather than handing off to
 * /plans/checkout, which for an anonymous visitor is one email field and a
 * button, a whole extra page load between a cold ad click and Stripe. Same
 * shortcut _shared/lp-trial-form.tsx takes, and it carries the same two things
 * that page existed for:
 *
 *  1. The terms. A card-required trial that auto-charges has to disclose the
 *     amount, the date and how to cancel before the customer consents. That is
 *     why the disclosure sits under the button rather than in a band further
 *     down: "clear and conspicuous" means beside the thing being pressed.
 *  2. Trial eligibility. The email is what lets the checkout route decide
 *     whether this person may have another trial BEFORE Stripe applies one.
 *     Posting without it hands a repeat customer a fresh trial and leaves the
 *     webhook to claw it back.
 *
 * `region` decides the currency, and comes from the city config rather than
 * being inferred. BC bills CAD and WA bills USD, and left to guess the route
 * falls back to geo and then to BC, which on the American page means a reader
 * quoted Canadian dollars under WDFW regulations whenever the lookup comes up
 * empty.
 *
 * Not a reuse of `LpTrialForm` for one reason: that component is styled by
 * _shared/lp-css.ts, which this page does not inject, so it would render as
 * unstyled markup, and it counts through `reportLpCta`, which is the
 * path-derived counter that is silent on this route.
 */
export function BlendTrialForm({
  landing,
  citySlug,
  region,
  cta,
  inputId,
  chargeDate,
  price,
  ctaLabel,
}: {
  landing: string;
  citySlug: string;
  /** Billing region, e.g. "WA". See the note above. */
  region: string;
  /** Which copy of the form this is: "hero" or "final". */
  cta: LpCtaId;
  /** Ids must differ between the two copies on one page. */
  inputId: string;
  /** Server-rendered, e.g. "September 4". Reading a clock during a client
   *  render is what turns a date into a hydration mismatch. */
  chargeDate: string;
  /** e.g. "$33/year", from lib/pricing by way of lp-content. */
  price: string;
  ctaLabel: string;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Counted here rather than on the button's onClick, so a press the browser
    // rejects for an empty or malformed email never reaches the counter. What
    // this measures is a real attempt to buy, which is the only version of a
    // CTA click worth putting a CTR on.
    reportCampaignCta(cta, targetFor(landing, citySlug, currentAngle()));

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${landing}-trial`,
          region,
          email: email.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "checkout_failed");
      // Uncovered regions come back as a redirect to the waitlist rather than
      // a Stripe URL. Follow whichever we are given.
      const dest = body.url ?? body.redirect;
      if (!dest) throw new Error("no_url");
      window.location.href = dest;
    } catch {
      setError("We couldn’t start checkout. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="ask" onSubmit={onSubmit}>
      <label className="asklab" htmlFor={inputId}>
        Your email
      </label>
      <input
        id={inputId}
        className="askin"
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
      <button className="go" type="submit" disabled={submitting}>
        {submitting ? "Starting…" : ctaLabel}
      </button>
      <p className="askterms">
        Free until <strong>{chargeDate}</strong>, then <strong>{price}</strong>{" "}
        until you cancel. Cancel any time before then and you pay nothing. No
        account needed, we make one from this email.
      </p>
      {error ? (
        <p className="askerr" role="alert">
          {error}{" "}
          <a href={`/plans/checkout?from=${landing}-trial&region=${region}`}>
            Continue on the checkout page instead.
          </a>
        </p>
      ) : null}
    </form>
  );
}
