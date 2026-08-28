"use client";

import { useState } from "react";
import { reportLpCta, type LpCtaId } from "../../_shared/lp-telemetry";

/**
 * The email field and the button that starts a trial checkout, for /lp/8.
 *
 * Behaviourally identical to `_shared/lp-trial-form.tsx` — same POST to
 * /api/stripe/checkout, same CTA counter, same fallback — and separate from it
 * only because that component is styled by the shared phone-column CSS and
 * this page has its own shell. If the checkout contract changes, both move
 * together.
 *
 * The two things that must survive the shortcut past /plans/checkout are the
 * same here as there, and neither is decoration:
 *
 * 1. The terms. A card-required trial that auto-charges has to disclose the
 *    amount, the date and how to cancel before consent, and "clear and
 *    conspicuous" means beside the button, not further down the page.
 * 2. The email. It is what lets the checkout route decide whether this person
 *    is still eligible for a trial BEFORE Stripe grants one, rather than
 *    leaving the webhook to take it back.
 *
 * `chargeDate` is computed on the server and passed in. Reading a clock during
 * a client render is what turns a date into a hydration mismatch, which this
 * codebase has already paid for once on the spot page.
 */
export default function Lp8TrialForm({
  from,
  region,
  chargeDate,
  price,
  trialDays,
  fallbackHref,
  inputId,
  cta,
  angle,
}: {
  /** Attribution key, e.g. "lp8-window". Rides through to the conversion row. */
  from: string;
  /** Billing region, e.g. "WA". Empty is allowed; the route falls back to geo. */
  region: string;
  /** Server-rendered date the first charge lands, e.g. "August 31". */
  chargeDate: string;
  /** Rendered price, e.g. "$33/year". */
  price: string;
  trialDays: number;
  fallbackHref: string;
  /** Ids must differ between the two copies of this form on one page. */
  inputId: string;
  cta: LpCtaId;
  angle: string;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Counted here rather than on the button's onClick, so a press the browser
    // rejects for a missing or malformed email never reaches the counter. What
    // this measures is a real attempt to buy.
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
      // Uncovered regions come back as a redirect to the waitlist rather than
      // a Stripe URL. Follow whichever we are given.
      const dest = body.url ?? body.redirect;
      if (!dest) throw new Error("no_url");
      window.location.href = dest;
    } catch {
      setError("We could not start checkout. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label htmlFor={inputId}>Your email</label>
      <div className="formrow">
        <input
          id={inputId}
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
        <button type="submit" disabled={submitting}>
          {submitting ? "Starting..." : `Start ${trialDays}-day free trial`}
        </button>
      </div>
      {error ? (
        <p className="err" role="alert">
          {error}{" "}
          <a href={fallbackHref} style={{ color: "inherit" }}>
            Try the checkout page instead.
          </a>
        </p>
      ) : null}
      <p className="terms">
        Free for {trialDays} days. Then {price} starting {chargeDate}, unless
        you cancel first. Cancel any time from your account, in one click.
      </p>
    </form>
  );
}
