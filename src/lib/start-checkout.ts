/**
 * The one way a signed-out reader is sent to Stripe.
 *
 * Every surface that sells the trial to someone without an account goes
 * through this: the trial sheet (via TrialCtaProvider), the quiz's email
 * form, and anything built later. It is the whole of the paid flow between
 * the tap and Stripe's page, in order:
 *
 *   1. captureWall        the rc_wall cookie names the wall that is selling,
 *                         so the server can record checkout_start and stamp
 *                         attr_* on the subscription. A form that skipped
 *                         this (the quiz did, until 2026-09-25) produced
 *                         trials with no start row and no wall.
 *   2. POST /api/stripe/checkout   one request, with `return_to` so Stripe's
 *                         back arrow lands on the page the reader left.
 *   3. goToCheckout       leaves for Stripe, reports the hop, and hands the
 *                         URL back as a plain link if the browser is still
 *                         here three seconds later.
 *
 * Nothing here reads a split arm, a cookie or a registry; the server prices
 * the session and refuses it if the displayed price is not the charged one.
 *
 * Returns what happened so the caller can draw the right thing: the reader
 * left, or was refused for a reason the caller can name, or nothing could be
 * started. A refusal is not an error: `account_exists` means "sign in", and
 * `trial_used` means "ask again on paid terms" (`acceptPaid: true`).
 */

import { captureWall } from './attribution';
import { goToCheckout } from './checkout-redirect';
import { currentPath } from './trial-return';
import type { BillingPlan } from './pricing';

export interface StartCheckoutInput {
  /** The wall or form that is selling, for attribution ("city-ad-intro"). */
  from: string;
  /** The paywall feature the wall names; defaults to the fortnight. */
  feature?: string;
  /** Billing region ("WA", "BC"). Empty lets the server use the IP country. */
  region?: string;
  email: string;
  plan?: BillingPlan;
  /** The reader has seen paid terms for this address and pressed anyway. */
  acceptPaid?: boolean;
  /** Called with Stripe's URL if the browser has not left after 3 s. */
  onStuck?: (url: string) => void;
}

export type StartCheckoutResult =
  | { kind: 'left'; cancel: () => void }
  | { kind: 'refused'; reason: 'account_exists' | 'trial_used' }
  | { kind: 'error'; error: string };

type CheckoutPayload = { url?: string; id?: string; redirect?: string; error?: string };

export async function startAnonCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  const address = input.email.trim();
  captureWall(input.feature ?? 'forecast-14d', input.from);

  let status = 0;
  let payload: CheckoutPayload = {};
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: input.from,
        region: input.region ?? '',
        email: address,
        plan: input.plan,
        accept_paid: Boolean(input.acceptPaid),
        // Stripe's back arrow returns here rather than to /billing/cancel.
        return_to: currentPath(),
      }),
    });
    status = res.status;
    try {
      payload = (await res.json()) as CheckoutPayload;
    } catch {
      /* non-JSON error body */
    }
  } catch {
    return { kind: 'error', error: 'network' };
  }

  if (status === 409 && (payload.error === 'account_exists' || payload.error === 'trial_used')) {
    return { kind: 'refused', reason: payload.error };
  }
  if (status < 200 || status >= 300) {
    return { kind: 'error', error: payload.error ?? 'checkout_failed' };
  }
  if (payload.redirect) {
    // A region we do not sell in: the waitlist, on our own site.
    window.location.href = payload.redirect;
    return { kind: 'left', cancel: () => {} };
  }
  if (!payload.url) return { kind: 'error', error: 'no_url' };

  const cancel = goToCheckout(payload.url, {
    sessionId: payload.id ?? null,
    viewerTier: 'anon',
    onStuck: input.onStuck,
  });
  return { kind: 'left', cancel };
}
