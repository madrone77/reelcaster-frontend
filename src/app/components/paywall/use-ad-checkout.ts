"use client";

import { useState } from "react";
import { reportCampaignCta, type CampaignTarget, type LpCtaId } from "@/app/lp/_shared/lp-telemetry";

/**
 * The card ask on an ad-framed surface, minus the dressing.
 *
 * Two surfaces run it now — the spot page's inline card and the explore map's
 * sticky bar — and they look nothing alike, so what they share is exactly this:
 * the email, the post, the redirect, and the counter. Third copies of a
 * checkout call are how one of them quietly stops stamping attribution.
 *
 * What deliberately does NOT live here is the disclosure. A card-required
 * trial that auto-charges has to state the amount, the date and how to cancel
 * beside the button being pressed, and "beside" is a layout fact that only the
 * renderer knows. Each surface writes its own, and each one has to be readable
 * as compliant on its own.
 */
export function useAdCheckout({
  wall,
  region,
  cta,
  dims,
}: {
  /** Which paywall this surface is running. Rides to Stripe as the
   *  attribution key, so "which wall earned the card" stays answerable. */
  wall: string;
  /** Billing region, e.g. "WA". Decides the currency; empty falls back to
   *  edge geo in the checkout route. */
  region: string;
  cta: LpCtaId;
  dims: CampaignTarget;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = `${dims.landing === "explore" ? "explore-ad" : "spot-ad"}-${wall}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Counted on submit rather than on the button's click, so a press the
    // browser rejects for a malformed email never reaches the counter. What
    // this measures is a real attempt to buy.
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

  return { email, setEmail, submitting, error, submit, from };
}
