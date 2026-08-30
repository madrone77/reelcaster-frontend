"use client";

import { useRef, useState } from "react";
import { priceStrings } from "./lp-content";
import { usePricing } from "@/app/components/split-test/use-pricing";
import { reportLpCta, type LpCtaId } from "./lp-telemetry";

/**
 * The email field and the button that starts checkout, on the landing page
 * itself.
 *
 * These pages used to hand off to /plans/checkout, which for an anonymous
 * visitor is one email field and a button. That was a whole extra page load
 * between a cold ad click and Stripe for the sake of a single input, so the
 * input moved here and the page posts straight through.
 *
 * What did NOT move is the reason that page existed. Two things have to
 * survive the shortcut:
 *
 * 1. The terms. A card-required trial that auto-charges has to disclose the
 *    amount, the date and how to cancel before the customer consents (US FTC
 *    negative-option rule, Canadian consumer-protection rules). That is why
 *    the disclosure sits directly under the button rather than being left to
 *    the timeline further down the page: "clear and conspicuous" means beside
 *    the thing you are clicking, not somewhere on the same document.
 * 2. Trial eligibility. The email is what lets the checkout route decide
 *    whether this person may have another trial BEFORE Stripe applies one.
 *    Posting without it would hand a repeat customer a fresh trial and leave
 *    the webhook to claw it back.
 *
 * `region` decides the currency (BC bills CAD, WA bills USD), and comes from
 * the card's own province, so the price cannot disagree with the flag and the
 * regulations printed above it.
 *
 * The charge date is computed on the server and passed in. Reading a clock
 * during render is what turns a date into a hydration mismatch, which is a
 * bug this codebase has already paid for once on the spot page.
 */
export default function LpTrialForm({
  from,
  region,
  chargeDate,
  ctaLabel,
  fallbackHref,
  inputId,
  cta,
  angle,
}: {
  /** Attribution key, e.g. "lp6-window". Rides through to the conversion row. */
  from: string;
  /** Billing region, e.g. "WA". Empty is allowed; the route falls back to geo. */
  region: string;
  /** Server-rendered date the first charge lands, e.g. "August 26". */
  chargeDate: string;
  ctaLabel: string;
  /** Where to send someone if the inline post fails. The old two-step path
   *  still works, so a broken fetch costs a click rather than the sale. */
  fallbackHref: string;
  /** Ids must differ between the two copies of this form on one page. */
  inputId: string;
  /** Which of the two copies this is, for the CTA counter: "hero" or "final". */
  cta: LpCtaId;
  /** The pitch this page is running, so a press can be read per angle. */
  angle: string;
}) {
  // The disclosure under this button states what the card will be charged, so
  // it reads the reader's own price rather than the build's. This is the one
  // sentence on a landing page that has to be right: an auto-charging trial
  // must disclose the amount, and disclosing a different amount than the one
  // Stripe bills is the failure the whole split-test design guards against.
  const PRICE = priceStrings(usePricing(region));

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Counted here rather than on the button's onClick, so a press that the
    // browser rejects for an empty or malformed email never reaches the
    // counter. What this measures is a real attempt to buy, which is the only
    // version of a CTA click worth putting a CTR on.
    reportLpCta(cta, angle);

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, region, email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "checkout_failed");
      // 'Other' / uncovered regions come back as a redirect to the waitlist
      // rather than a Stripe URL. Follow whichever we are given.
      const dest = body.url ?? body.redirect;
      if (!dest) throw new Error("no_url");
      window.location.href = dest;
    } catch {
      setError("We couldn’t start checkout. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="lp-form" onSubmit={onSubmit} noValidate={false}>
      <label className="lp-form-label" htmlFor={inputId}>
        Your email
      </label>
      <input
        id={inputId}
        ref={inputRef}
        className="lp-form-input"
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
      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? "Starting…" : ctaLabel}
      </button>

      {/* The disclosure. Sits under the button on purpose, see the note above. */}
      <p className="lp-form-terms">
        Free until <strong>{chargeDate}</strong>, then <strong>{PRICE.year}</strong> until you
        cancel. Cancel anytime before then and you pay nothing. No account needed, we make one
        from this email.
      </p>

      {error ? (
        <p className="lp-form-error" role="alert">
          {error}{" "}
          <a href={fallbackHref}>Continue on the checkout page instead.</a>
        </p>
      ) : null}
    </form>
  );
}
