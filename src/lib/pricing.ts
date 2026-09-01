/**
 * ReelCaster Pro pricing — ONE plan, billed yearly, in the buyer's currency.
 *
 * The control, and what everyone is served unless a price test is running:
 *
 *   CAD: $33 / year        USD: $33 / year
 *
 * There is no monthly plan to choose any more. The copy does the division for
 * the reader instead of offering a cadence toggle: $33 a year IS $2.75 a
 * month, which is the number every surface leads with.
 *
 * Every subscription starts with a free trial (TRIAL_DAYS): a payment method
 * is collected at checkout, $0 is charged today, and the first invoice lands
 * when the trial ends. The trial is granted per-session by the checkout route
 * (subscription_data.trial_period_days) and only to first-time subscribers —
 * it is not baked into the Stripe Price object, and it does not vary by arm.
 *
 * ── THE PRICE IS NO LONGER A CONSTANT ────────────────────────────────────
 *
 * It used to be `ANNUAL_PRICE_CENTS`, imported directly by fifteen surfaces.
 * That worked while there was exactly one price and it was the same number in
 * both currencies. Neither is guaranteed any more: see `split_tests` in the
 * ReelCaster database, where a payment test can put a visitor on a different
 * Stripe price for the length of their visit.
 *
 * So the shape to reach for is {@link PricingView}, resolved per request from
 * the visitor's arms. The control constants are exported as CONTROL_* to make
 * an accidental import read wrong at the call site. If you are writing copy
 * that quotes a price, you want the view, not the constant.
 *
 * THE ONE RULE. The amount displayed and the amount charged must be the same
 * number. A visitor shown $39 and billed $45 is a chargeback and a complaint
 * to a regulator, and no amount of "the test said so" survives it. That is
 * why {@link verifiedPriceForCheckout} asks Stripe what the price actually
 * costs before a session is created, and refuses the sale rather than
 * guessing when the answer disagrees with what was advertised.
 */

import type Stripe from 'stripe';

export type BillingCurrency = 'cad' | 'usd';

/**
 * Today's price, per currency. The fallback for every degraded path: no test
 * running, a test running with a broken arm, a registry that would not load.
 */
export const CONTROL_ANNUAL_CENTS: Record<BillingCurrency, number> = {
  cad: 3300,
  usd: 3300,
};

/** Free-trial length, in days. Shared by checkout and every piece of UI copy. */
export const TRIAL_DAYS = 7;

/**
 * How far ahead of the charge the trial-ending reminder goes out. On a 7-day
 * trial that is day 4.
 *
 * It lives here rather than next to the sender because customer-facing copy
 * has to state the day, and `lib/trial-reminder` pulls in the mailer and the
 * Supabase admin client — a client component that imported the constant from
 * there would drag both into the browser bundle. `trial-reminder` re-exports
 * it, so the send and the promise still cannot disagree.
 */
export const REMINDER_LEAD_DAYS = 3;

/** The control arm's Stripe price. Unset means the product cannot be sold. */
export const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID ?? '';

/**
 * LEGACY. The old $5/month plan, which is no longer sold anywhere.
 *
 * Customers who subscribed monthly before the switch are still on it and
 * still billing, so billing email needs this to label their renewal and
 * payment-failure notices with the amount they actually pay. Nothing
 * customer-facing may use it to *sell*.
 */
export const LEGACY_MONTHLY_PRICE_CENTS = 500;

/** "$45", "$3.75" — trailing cents only when there are any. */
export function dollars(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

/** The price ÷ 12, the way the price is pitched. Derived, never typed out. */
export function perMonthCents(cents: number): number {
  return Math.round(cents / 12);
}

// ── The resolved price ───────────────────────────────────────────────────

/**
 * What one visitor is being quoted, right now, in their currency.
 *
 * Everything a surface needs to write a sentence about price, so that no
 * surface has to divide, format, or decide anything for itself. `testKey` and
 * `variant` ride along so a CTA can report the exposure it just caused
 * without a second lookup.
 */
export interface PricingView {
  currency: BillingCurrency;
  /** The yearly amount, in cents, in `currency`. */
  cents: number;
  /** That ÷ 12, rounded. */
  perMonthCents: number;
  /** "$45" */
  amount: string;
  /** "$3.75" */
  perMonth: string;
  /**
   * Which arm produced this, or null when it is the control. Null is the
   * normal state, because no test running is the normal state.
   */
  testKey: string | null;
  variant: string | null;
  /**
   * The env var naming this arm's Stripe price, for the checkout path to
   * resolve. Never the price id itself: an id in a client payload is an
   * invitation to check out against a price nobody displayed.
   */
  priceEnv: string;
}

function controlView(currency: BillingCurrency): PricingView {
  const cents = CONTROL_ANNUAL_CENTS[currency];
  return {
    currency,
    cents,
    perMonthCents: perMonthCents(cents),
    amount: dollars(cents),
    perMonth: dollars(perMonthCents(cents)),
    testKey: null,
    variant: null,
    priceEnv: 'STRIPE_ANNUAL_PRICE_ID',
  };
}

/** The control view, for surfaces with no request context to resolve from. */
export function controlPricing(currency: BillingCurrency = 'cad'): PricingView {
  return controlView(currency);
}

// ── Billing email ────────────────────────────────────────────────────────

/**
 * The amount to quote a subscriber in a billing email, by tier alone.
 *
 * The LAST resort, and increasingly the wrong one: it can only name a list
 * price, and the moment a price test runs, roughly half of new subscribers
 * are not on it. Prefer {@link amountLabelForSubscription} anywhere the
 * subscription is in hand, which is everywhere the trial-ending notice is
 * sent from. That notice is legally required to state what is about to be
 * charged, so "close enough" is not a standard it can be held to.
 */
export function amountLabelForTier(tier: string | null | undefined): string {
  return dollars(
    tier === 'pro_annual' ? CONTROL_ANNUAL_CENTS.cad : LEGACY_MONTHLY_PRICE_CENTS,
  );
}

/**
 * The amount from a stored `user_settings` row, for senders with no Stripe
 * object in hand.
 *
 * The trial-ending reminder is sent by a cron reading database rows, and it is
 * the notice that legally has to name what is about to be charged. Null means
 * a row written before this column existed, or one hand-set by an admin; those
 * fall back to the list price for the tier, which is the best available answer
 * and was the only answer before.
 */
export function amountLabelForStored(
  amountCents: number | null | undefined,
  tier: string | null | undefined,
): string {
  if (typeof amountCents === 'number' && amountCents > 0) return dollars(amountCents);
  return amountLabelForTier(tier);
}

/**
 * The amount actually on a subscription, for the emails that must state it.
 *
 * Falls back to {@link amountLabelForTier} only when the subscription carries
 * no readable amount, which happens for rows this code did not create.
 */
export function amountLabelForSubscription(
  subscription: Stripe.Subscription | null | undefined,
  tier: string | null | undefined,
): string {
  const amount = subscription?.items?.data?.[0]?.price?.unit_amount;
  if (typeof amount === 'number' && amount > 0) return dollars(amount);
  return amountLabelForTier(tier);
}

// ── Region → currency ────────────────────────────────────────────────────

/**
 * BC buys in CAD; WA/OR in USD. When no region is known (paywall CTAs post
 * region '') the caller may pass the request's x-vercel-ip-country header; a
 * Canadian IP gets CAD, any other known country USD, and with no signal at all
 * we default to CAD (the account's home currency).
 */
export function currencyForRegion(
  region: string | null | undefined,
  ipCountry?: string | null,
): BillingCurrency {
  const r = (region ?? '').trim().toUpperCase();
  if (r === 'BC') return 'cad';
  if (r === 'WA' || r === 'OR') return 'usd';
  const c = (ipCountry ?? '').trim().toUpperCase();
  if (c === 'CA') return 'cad';
  if (c) return 'usd';
  return 'cad';
}

/** Uppercase label for UI copy ("Billed in CAD"). */
export function currencyLabelForRegion(
  region: string | null | undefined,
): 'CAD' | 'USD' {
  return currencyForRegion(region) === 'cad' ? 'CAD' : 'USD';
}
