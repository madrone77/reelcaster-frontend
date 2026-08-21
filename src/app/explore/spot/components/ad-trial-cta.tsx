"use client";

import { useState } from "react";
import { PRICE } from "@/app/lp/_shared/lp-content";
import { reportCampaignCta, type CampaignTarget } from "@/app/lp/_shared/lp-telemetry";
import type { LpCtaId } from "@/app/lp/_shared/lp-telemetry";
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
function pitchFor(wall: AdWall, spotName: string): { head: string; sub: string } {
  if (wall === "today") {
    return {
      head: `See the next 13 days at ${spotName}`,
      sub: "Today is above. The rest of the fortnight, every hour scored, is on the other side of this.",
    };
  }
  if (wall === "day2") {
    return {
      head: `See all 14 days at ${spotName}`,
      // Not "this weekend": the two open days are today and tomorrow, which on
      // a Tuesday is not a weekend and reads as a page that does not know what
      // day it is.
      sub: "You have today and tomorrow. Pro has the next fortnight, hour by hour, plus a text when a good window opens.",
    };
  }
  return {
    head: `Get a text when ${spotName} comes good`,
    sub: "Set the score you care about and we watch the forecast for it. Plus the full 14-day outlook and catch reports.",
  };
}

export default function AdTrialCta({
  spotName,
  region,
  chargeDate,
  wall,
  cta,
  inputId,
  dims,
}: {
  spotName: string;
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
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { head, sub } = pitchFor(wall, spotName);

  // The attribution key that rides to Stripe and lands in the conversion
  // columns. Keyed by WALL, not just "spot-ad": which wall earned the card is
  // the whole question this page exists to answer.
  const from = `spot-ad-${wall}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Counted here rather than on the button, so a press the browser rejects
    // for a malformed email never reaches the counter. What this measures is a
    // real attempt to buy.
    reportCampaignCta(cta, dims);

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
      // Uncovered regions come back as a redirect to the waitlist rather than a
      // Stripe URL. Follow whichever we are given.
      const dest = body.url ?? body.redirect;
      if (!dest) throw new Error("no_url");
      window.location.href = dest;
    } catch {
      setError("We couldn’t start checkout. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-rc-brand/30 bg-rc-brand-soft/40 p-5 lg:p-6">
      <h2 className="rc-title-lg text-xl lg:text-2xl">{head}</h2>
      <p className="rc-body text-sm text-rc-ink-soft mt-2 max-w-[52ch]">{sub}</p>

      <form className="mt-5 max-w-[34rem]" onSubmit={onSubmit}>
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
