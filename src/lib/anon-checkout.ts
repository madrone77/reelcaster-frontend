/**
 * The Stripe Checkout Session for a buyer with no account yet.
 *
 * Lived inside /api/stripe/checkout until a second caller needed exactly the
 * same session: the "almost done" reminder link (/api/stripe/checkout/resume),
 * which sends somebody who abandoned checkout straight back into a fresh one.
 * Two copies of this would drift in the way that costs money: one path offering
 * a trial the other withholds, or charging a different split arm.
 *
 * The session has NO customer attached. Stripe creates one from the email, and
 * the webhook provisions the account from it when the checkout completes. See
 * src/lib/checkout-account.ts.
 */

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appOrigin } from '@/lib/stripe';
import {
  ANNUAL_PRICE_ID,
  MONTHLY_PRICE_ID,
  TRIAL_DAYS,
  monthlyPricing,
  type BillingCurrency,
  type BillingPlan,
} from '@/lib/pricing';
import {
  resolveSplitContext,
  verifiedPriceForCheckout,
} from '@/lib/split-tests-server';
import {
  SPLIT_COOKIE,
  SPLIT_COOKIE_MAX_AGE,
  serializeSplitArms,
  splitMetadata,
  type SplitArms,
} from '@/lib/split-tests';
import { checkTrialEligibilityByEmail } from '@/lib/trial';
import { acquisitionMetadata } from '@/lib/acquisition-metadata';

/**
 * Pay-first checkout (buy Pro with no account, account provisioned from the
 * email Stripe bills). NEXT_PUBLIC_ so the paywall UI and the routes read the
 * same switch; the modal shows its email field only when this is on.
 */
export const PAY_FIRST_ENABLED = process.env.NEXT_PUBLIC_PAY_FIRST_CHECKOUT === '1';

/**
 * How long a signed-out Checkout Session stays open. Stripe's default is 24
 * hours, and the "almost done" email goes out when a session expires, so the
 * default meant a nudge arriving a day after somebody walked away. Three hours
 * lands it the same day, while the trip is still being planned. Stripe accepts
 * 30 minutes to 24 hours.
 */
export const ANON_CHECKOUT_TTL_SECONDS = 3 * 60 * 60;

export type PricedCheckout = {
  ok: true;
  priceId: string;
  arms: SplitArms;
  changed: boolean;
  cookie: string;
};

/**
 * The price to charge this visitor, and the arms to stamp on the subscription.
 *
 * A refusal here is returned to the caller as `plan_unavailable`, the same
 * shape an unset price id already produces, rather than being quietly
 * downgraded to the control. The reason is in verifiedPriceForCheckout: a
 * fallback would charge an amount that was never displayed, which is the one
 * outcome this whole design exists to make impossible.
 */
export async function resolveCheckoutPrice(
  request: Request,
  stripe: Stripe,
  currency: BillingCurrency,
  plan: BillingPlan = 'annual',
): Promise<PricedCheckout | { ok: false }> {
  const ctx = await resolveSplitContext(request.headers.get('cookie'), currency);
  // Monthly is one price with no arm, but it goes through the same Stripe
  // check as the annual arms: the sheet printed $5, and $5 is what the card
  // must be charged. The visitor's arms still ride to Stripe so a monthly
  // buyer counts for whichever tests they were in.
  const view = plan === 'monthly' ? monthlyPricing(currency) : ctx.pricing;
  const priced = await verifiedPriceForCheckout(stripe, view);
  if (!priced.ok) {
    console.error('[stripe checkout] price refused', priced.reason, view);
    return { ok: false };
  }
  return {
    ok: true,
    priceId: priced.priceId,
    arms: ctx.arms,
    changed: ctx.changed,
    cookie: serializeSplitArms(ctx.arms),
  };
}

/**
 * Attach the arm cookie to a response, so a buyer who was assigned during
 * checkout keeps the same arm if they come back.
 */
export function withSplitCookie<T extends NextResponse>(
  response: T,
  priced: { changed: boolean; cookie: string },
): T {
  if (priced.changed) {
    response.cookies.set(SPLIT_COOKIE, priced.cookie, {
      maxAge: SPLIT_COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}

export type AnonCheckoutResult =
  | {
      ok: true;
      session: Stripe.Checkout.Session;
      priced: PricedCheckout;
      trialEligible: boolean;
    }
  | { ok: false; error: 'plan_unavailable' | 'trial_used' };

/**
 * Create the session. Stripe errors throw; the caller decides what a failure
 * looks like to its own client.
 */
export async function createAnonCheckoutSession(params: {
  request: Request;
  stripe: Stripe;
  admin: SupabaseClient;
  currency: BillingCurrency;
  /** Null when the caller let Stripe collect it. */
  email: string | null;
  region: string;
  from: string;
  /**
   * Which cadence. Annual unless the plan picker's monthly card was chosen.
   * Monthly carries no trial: it is charged today, and the sheet says so.
   */
  plan?: BillingPlan;
  /** Stamped on both the session and the subscription. */
  extraMetadata?: Record<string, string>;
  /**
   * What to do when the email has already had its trial. 'refuse' returns
   * `trial_used` and creates nothing, for a caller whose screen promised a
   * trial and has to say otherwise before the buyer reaches Stripe. 'charge'
   * opens a paid session, for a caller that already quoted paid terms (the
   * reminder email reads eligibility before it writes the offer).
   */
  withheldTrial?: 'refuse' | 'charge';
  /**
   * The page the buyer left for Stripe, validated by safeReturnPath. Stripe's
   * back arrow goes through /billing/cancel and on to it, with the sheet
   * reopened (src/lib/trial-return.ts). Unset or unsafe, the arrow lands on
   * /billing/cancel as it always has.
   */
  returnTo?: string | null;
}): Promise<AnonCheckoutResult> {
  const { request, stripe, admin, currency, email, region, from } = params;
  const plan: BillingPlan = params.plan ?? 'annual';
  const extra = params.extraMetadata ?? {};

  if (plan === 'monthly' ? !MONTHLY_PRICE_ID : !ANNUAL_PRICE_ID) {
    console.error(
      `[stripe checkout] ${plan === 'monthly' ? 'STRIPE_MONTHLY_PRICE_ID' : 'STRIPE_ANNUAL_PRICE_ID'} is not configured`,
    );
    return { ok: false, error: 'plan_unavailable' };
  }

  // The price and the trial check do not depend on each other, and both sit
  // on the tap-to-Stripe path, so they go out together rather than in a row.
  // No email, no pre-check: Stripe collects the address and the webhook's
  // guards decide after the fact. Monthly never trials, so it never asks.
  const [priced, eligibility] = await Promise.all([
    resolveCheckoutPrice(request, stripe, currency, plan),
    plan === 'monthly'
      ? { eligible: false as const, reason: 'monthly_plan' }
      : email
        ? checkTrialEligibilityByEmail(admin, email)
        : { eligible: true as const },
  ]);
  if (!priced.ok) return { ok: false, error: 'plan_unavailable' };
  const trialEligible = eligibility.eligible;
  if (!trialEligible) {
    console.info('[stripe checkout] anon trial withheld', eligibility.reason);
    // Only an annual buyer whose screen promised a free week is sent back to
    // the sheet to see paid terms. Monthly never had a trial to withhold: its
    // card already says it is charged today, so there is nothing to re-say.
    if (params.withheldTrial === 'refuse' && plan === 'annual') {
      return { ok: false, error: 'trial_used' };
    }
  }

  const origin = appOrigin(request);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    // No `customer`, and no `customer_email` either: Stripe creates the
    // customer from the address its own field collects, and the webhook binds
    // it to the account it provisions. The sheet's address still rides in the
    // metadata (trial eligibility was checked against it, and the reminder
    // email reads it), but it is NOT prefilled on Stripe's page. Prefilling a
    // Link address makes Checkout open on Link's log-in screen before the form;
    // from 2026-09-23 11:04 PT no Link buyer completed a session, and card and
    // wallet buyers all but stopped too, while page loads held steady. Letting
    // Stripe ask for the email is how the first trials were sold.
    currency,
    line_items: [{ price: priced.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    payment_method_collection: 'always',
    expires_at: Math.floor(Date.now() / 1000) + ANON_CHECKOUT_TTL_SECONDS,
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.returnTo
      ? `${origin}/billing/cancel?back=${encodeURIComponent(params.returnTo)}`
      : `${origin}/billing/cancel`,
    metadata: {
      // No supabase_user_id yet. `anon_checkout` is the webhook's signal to
      // provision one rather than log an unresolvable subscription.
      anon_checkout: 'true',
      ...(email ? { checkout_email: email } : {}),
      plan,
      currency,
      region: region || '',
      from,
      trial: String(trialEligible),
      ...extra,
    },
    subscription_data: {
      metadata: {
        anon_checkout: 'true',
        ...(email ? { checkout_email: email } : {}),
        plan,
        currency,
        trial: String(trialEligible),
        ...acquisitionMetadata(request.headers),
        // The arms, on the SUBSCRIPTION rather than the session. The webhook
        // resolves from the subscription, and for a pay-first buyer there is
        // no account row to read attribution off, so this is the only thing
        // that survives the trip out to Stripe and back a week later. Lose
        // it and the report can count who saw each price but not which price
        // anybody bought.
        ...splitMetadata(priced.arms),
        ...extra,
      },
      ...(trialEligible
        ? {
            trial_period_days: TRIAL_DAYS,
            trial_settings: {
              end_behavior: { missing_payment_method: 'cancel' as const },
            },
          }
        : {}),
    },
  });

  return { ok: true, session, priced, trialEligible };
}
