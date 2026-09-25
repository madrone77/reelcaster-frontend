"use client";

import { forwardRef, useState } from "react";
import { priceStrings } from "../../_shared/lp-content";
import { trialChargeDate } from "../../_shared/lp-checkout";
import { usePricing } from "@/app/components/split-test/use-pricing";
import { reportCampaignCta, type LpCtaId } from "../../_shared/lp-telemetry";
import { trackEvent } from "@/lib/analytics";
import type { Persona } from "./persona";

/**
 * The quiz's ask: one email field that posts straight to Stripe for the
 * 7-day Pro trial, same contract as _shared/lp-trial-form.tsx and
 * _blend/blend-track.tsx.
 *
 * Not a reuse of either. LpTrialForm is styled by lp-css.ts and counts
 * through the path-derived `reportLpCta`, which is silent on /lp/q; the blend
 * form is styled by its own CSS. This one is Tailwind and counts through
 * `reportCampaignCta` with the persona in the angle column.
 *
 * The disclosure under the button reads the reader's OWN price
 * (`usePricing`, split-test aware), because an auto-charging trial must
 * state the amount it will charge, beside the button, and it must be the
 * amount Stripe bills.
 *
 * The charge date is computed here, in the browser, which is safe only
 * because the result screen never renders on the server: the quiz's phase
 * starts at "questions", so there is no server copy of this markup to
 * mismatch. It also means the date is today's, not the ISR render's.
 */

const ERRORS: Record<string, string> = {
  account_exists: "You already have a ReelCaster account with this email.",
  already_subscribed: "This email already has ReelCaster Pro.",
  trial_used: "This email has already had a free trial.",
};

interface Props {
  citySlug: string;
  /** Billing region, e.g. "WA". BC bills CAD, the US states bill USD. */
  region: string;
  persona: Persona;
  inputId: string;
  cta: LpCtaId;
  ctaLabel: string;
}

const QuizTrialForm = forwardRef<HTMLInputElement, Props>(function QuizTrialForm(
  { citySlug, region, persona, inputId, cta, ctaLabel },
  inputRef,
) {
  const PRICE = priceStrings(usePricing(region));
  const chargeDate = trialChargeDate(PRICE.trialDays);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Counted on submit, not on press, so a press the browser rejects for a
    // bad email never reaches the counter.
    reportCampaignCta(cta, {
      landing: "lpq",
      target_city: citySlug,
      target_spot: "",
      wall: "",
      angle: `q:${persona}`,
    });
    trackEvent("Quiz CTA Clicked", { landing: "lpq", city: citySlug, persona, cta });

    setSubmitting(true);
    setError(null);
    setErrorCode("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: `lpq-${persona}`, region, email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "checkout_failed");
      const dest = body.url ?? body.redirect;
      if (!dest) throw new Error("no_url");
      window.location.href = dest;
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setErrorCode(code);
      setError(ERRORS[code] ?? "We couldn’t start checkout. Please try again.");
      setSubmitting(false);
    }
  }

  // Someone who already has an account belongs on sign in; a used trial can
  // still buy on the checkout page, just without the free week.
  const signIn = errorCode === "account_exists" || errorCode === "already_subscribed";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor={inputId} className="text-sm font-semibold text-rc-ink">
        Your email
      </label>
      <input
        ref={inputRef}
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
        // 16px or larger, or iOS zooms the page on focus.
        className="h-14 w-full rounded-2xl border-2 border-rc-rule bg-rc-panel px-4 text-base text-rc-ink outline-none focus:border-rc-brand"
      />
      <button
        type="submit"
        disabled={submitting}
        className="flex min-h-[56px] items-center justify-center rounded-2xl bg-rc-brand px-6 text-lg font-bold text-white hover:bg-rc-brand-hover disabled:opacity-70"
      >
        {submitting ? "Starting…" : ctaLabel}
      </button>
      <p className="text-center text-sm leading-snug text-rc-ink-mute">
        Free until <strong className="text-rc-ink">{chargeDate}</strong>, then{" "}
        <strong className="text-rc-ink">{PRICE.year}</strong> until you cancel. Cancel any time
        before then and you pay nothing. No account needed, we make one from this email.
      </p>
      {error ? (
        <p className="rounded-xl bg-rc-poor-bg px-3 py-2 text-sm text-rc-poor-ink" role="alert">
          {error}{" "}
          {signIn ? (
            <a className="font-semibold underline" href="/login">
              Sign in instead.
            </a>
          ) : (
            <a className="font-semibold underline" href={`/plans/checkout?from=lpq-${persona}&region=${region}`}>
              Continue on the checkout page instead.
            </a>
          )}
        </p>
      ) : null}
    </form>
  );
});

export default QuizTrialForm;
