/**
 * Recording the two conversions worth reporting back to whoever sold the click.
 *
 *   trial_start  a card is on file and the free week has begun. Value 0.
 *   purchase     the first real payment landed, seven days later. Real value.
 *
 * Why this is server-side and not a pixel on the thank-you page:
 *
 *   1. The paid conversion happens a WEEK after the click. The browser that
 *      clicked the ad is long gone, no cookie is readable, and no client-side
 *      tag can fire. For an annual-with-trial product this is not an
 *      optimisation, it is the only way the conversion can be reported at all.
 *   2. A thank-you page can be refreshed, and reached directly by URL. Both
 *      inflate conversion counts, and one of them is trivially forgeable.
 *   3. Ad blockers and tracking prevention eat a large, non-random slice of
 *      browser pixels — concentrated in exactly the privacy-minded segment.
 *
 * Stripe is therefore the source of truth for both events, and the click id
 * reaches this point by riding in subscription metadata from the checkout
 * route. See attributionMetadata() in src/app/api/stripe/checkout/route.ts.
 */

import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SIGNUP_MODELED_VALUE_CENTS, SIGNUP_VALUE_CURRENCY } from './signup-conversion';
import { armsFromMetadata, type SplitArms } from './split-tests';
import { PAY_METHOD_KEY } from './payment-method';

export type ConversionEvent = 'trial_start' | 'purchase' | 'signup';

/** Which network to report a conversion to, given the id type it issued. */
const NETWORK_BY_CLICK_TYPE: Record<string, string> = {
  gclid: 'google',
  gbraid: 'google',
  wbraid: 'google',
  fbclid: 'meta',
  msclkid: 'microsoft',
};

export function networkForClickType(clickType: string | null | undefined): string | null {
  if (!clickType) return null;
  return NETWORK_BY_CLICK_TYPE[clickType] ?? null;
}

/**
 * The acquisition context the checkout route stamped onto the subscription.
 *
 * Also the shape a signup is recorded with, where it comes from the rc_entry
 * and rc_paid cookies on the request instead of from Stripe metadata. Same
 * columns, same meanings, so the two events stay comparable in every rollup
 * that groups them.
 */
export interface SubscriptionAcquisition {
  attribution_model: string | null;
  click_id: string | null;
  click_type: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_path: string | null;
  entry_path: string | null;
  /** When the ad click happened. See acq_click_at in the checkout route. */
  click_at: string | null;
  /**
   * The machine checkout was started on, and roughly where it was. Stamped
   * from the request headers by the checkout route, so these describe the
   * PURCHASE, not the ad click: a phone click closed on a laptop is recorded
   * as a laptop here and as a phone in campaign_events_daily.
   *
   * Null on every conversion recorded before 2026-08-20, and on any bought
   * through a path that does not stamp them. Nothing derives a default; an
   * unknown device stays unknown rather than becoming a desktop.
   */
  device: string | null;
  os: string | null;
  geo_country: string | null;
  geo_region: string | null;
  geo_city: string | null;
  params: Record<string, string> | null;
  /**
   * Which wall earned this conversion, and where it stood.
   *
   * The answer already existed in two places and in neither usefully: on
   * `user_settings.attr_trial_*`, which is one row per person and write-once,
   * and in Stripe metadata. Neither can be grouped alongside utm_campaign and
   * geo_city in one query, and that query — this wall, this campaign, this
   * city, how many bought — is the whole point of recording any of this.
   *
   * These are the numerator's copy of the two columns `paywall_events` uses
   * for the denominator, with the same vocabulary, so a conversion rate per
   * wall is a filter on each side and a division.
   *
   * Null when a buyer reached checkout without passing a wall: straight to
   * /plans, or from a link in an email. That is a real category and it is left
   * as null rather than credited to something.
   */
  paywall_feature: string | null;
  paywall_surface: string | null;
  /**
   * How it was actually paid for, at the moment of purchase: 'card',
   * 'apple_pay', 'google_pay', 'link'.
   *
   * Mirrored off subscription metadata rather than read live, because Stripe
   * forgets: swap the card on file and an Apple Pay purchase retroactively
   * becomes a card purchase in every report that asks Stripe today. See
   * src/lib/payment-method.ts, which owns the stamp and the vocabulary.
   *
   * Null on a trial recorded before the card was attached — the stamp lands on
   * the `subscription.updated` that follows — and on every conversion recorded
   * before this column existed.
   */
  pay_method: string | null;
  /**
   * Which split-test arms this buyer was in, read back off the `split_*` keys
   * the checkout route stamped on the subscription.
   *
   * The join that makes a split test readable. Exposures live in a counter
   * with no identity in it, so the only way to say "arm b sold four
   * subscriptions" is for the sale itself to remember which arm it came from,
   * and Stripe metadata is the only carrier that survives the week between a
   * trial starting and the first invoice being paid.
   *
   * `{}` for every conversion made while no test was running, which is most
   * of them and is not a gap.
   */
  split_tests: SplitArms;
}

function str(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed || null;
}

export function acquisitionFromSubscription(
  subscription: Stripe.Subscription,
): SubscriptionAcquisition {
  const m = subscription.metadata ?? {};

  let params: Record<string, string> | null = null;
  if (m.acq_params) {
    try {
      const parsed = JSON.parse(m.acq_params);
      // Metadata is a string map Stripe will echo back whatever we wrote, but
      // it is also editable by hand in the dashboard, so the shape is checked
      // rather than assumed.
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        params = parsed as Record<string, string>;
      }
    } catch {
      // A malformed bag is not worth failing a webhook over. The rest of the
      // attribution is independent of it and still worth recording.
    }
  }

  return {
    attribution_model: str(m.acq_model),
    click_id: str(m.acq_click_id),
    click_type: str(m.acq_click_type),
    utm_source: str(m.acq_source),
    utm_medium: str(m.acq_medium),
    utm_campaign: str(m.acq_campaign),
    utm_content: str(m.acq_content),
    utm_term: str(m.acq_term),
    landing_path: str(m.acq_landing),
    entry_path: str(m.acq_entry_path),
    click_at: str(m.acq_click_at),
    device: str(m.acq_device),
    os: str(m.acq_os),
    geo_country: str(m.acq_country),
    geo_region: str(m.acq_region),
    geo_city: str(m.acq_city),
    paywall_feature: str(m.attr_feature),
    paywall_surface: str(m.attr_from),
    pay_method: str(m[PAY_METHOD_KEY]),
    params,
    split_tests: armsFromMetadata(m),
  };
}

export interface RecordConversionParams {
  /**
   * Signup is excluded by type, not by convention: it has no subscription to
   * key on, and every field below assumes one. See recordSignupConversion.
   */
  event: Exclude<ConversionEvent, 'signup'>;
  subscription: Stripe.Subscription;
  userId: string | null;
  /** From Stripe, in cents. Never a list-price constant and never client-sent. */
  valueCents: number;
  currency: string;
  occurredAt: string;
  invoiceId?: string | null;
}

/**
 * Record a free signup as a conversion.
 *
 * Separate from `recordConversion` because everything that function relies on
 * is missing here: there is no subscription to read metadata off, no invoice,
 * and no money. What is left is an account, the moment it appeared, and the
 * cookies the browser was carrying, which the caller has already checked
 * against the enums (they arrive from a cookie the client can write by hand).
 *
 * Value is modeled, and it is kept out of `value_cents` on purpose. That column
 * is Stripe's: the revenue rollups sum it, and a guess in there would turn into
 * a number on a dashboard that reads as money. `modeled_value_cents` is the
 * only place a made-up figure is allowed to live.
 *
 * No upload is attempted here, unlike the webhook, which drains the queue the
 * moment it records. A signup has a browser standing right there firing the
 * pixel, so the server leg is the backstop rather than the fast path, and
 * making a person wait on a call to Meta to finish loading a page would be a
 * poor trade. The hourly cron picks it up, and Meta accepts events for 7 days.
 *
 * @returns the new row's id, or null when nothing was inserted.
 */
export async function recordSignupConversion(
  admin: SupabaseClient,
  params: {
    userId: string;
    occurredAt: string;
    acquisition: SubscriptionAcquisition;
  },
): Promise<number | null> {
  const acq = params.acquisition;
  const network = networkForClickType(acq.click_type);
  const uploadStatus = acq.click_id && network ? 'pending' : 'skipped';

  const { data, error } = await admin
    .from('marketing_conversions')
    .insert({
      user_id: params.userId,
      event_type: 'signup' satisfies ConversionEvent,
      occurred_at: params.occurredAt,
      value_cents: 0,
      modeled_value_cents: SIGNUP_MODELED_VALUE_CENTS,
      currency: SIGNUP_VALUE_CURRENCY,
      // Null, and the check constraint allows it only for this event type.
      stripe_subscription_id: null,
      ...acq,
      upload_status: uploadStatus,
      upload_network: network,
    })
    .select('id');

  if (error) {
    // A duplicate is the system working: the caller fires on every page load
    // for the whole grace window, and the partial unique index is what makes
    // that safe. Insert rather than upsert because a partial index cannot be an
    // onConflict target in PostgREST, so the conflict is caught here instead.
    if (error.code === '23505') return null;
    console.warn('[conversions] signup record failed', error);
    return null;
  }

  return data?.[0]?.id ?? null;
}

/**
 * Insert a conversion, once.
 *
 * Conflicts are swallowed rather than treated as errors: the unique constraint
 * on (subscription, event) is doing deliberate work here. Stripe redelivers
 * webhooks, several event types describe the same state change, and every
 * annual renewal arrives looking exactly like the original purchase. All three
 * are supposed to be no-ops, so a conflict is the system working.
 *
 * @returns the new row's id, or null when nothing was inserted.
 */
export async function recordConversion(
  admin: SupabaseClient,
  params: RecordConversionParams,
): Promise<number | null> {
  const acq = acquisitionFromSubscription(params.subscription);
  const network = networkForClickType(acq.click_type);

  // A conversion with no click id is still worth recording — it is real
  // revenue and belongs in the CAC denominator — but there is nowhere to send
  // it. `skipped` is a resting state, not a failure, and keeping it out of the
  // pending queue is what stops the uploader retrying it forever.
  const uploadStatus = acq.click_id && network ? 'pending' : 'skipped';

  const { data, error } = await admin
    .from('marketing_conversions')
    .upsert(
      {
        user_id: params.userId,
        event_type: params.event,
        occurred_at: params.occurredAt,
        value_cents: params.valueCents,
        currency: params.currency.toLowerCase(),
        stripe_subscription_id: params.subscription.id,
        stripe_invoice_id: params.invoiceId ?? null,
        ...acq,
        upload_status: uploadStatus,
        upload_network: network,
      },
      { onConflict: 'stripe_subscription_id,event_type', ignoreDuplicates: true },
    )
    .select('id');

  if (error) {
    // Conversion tracking is reporting, not billing. It must never fail a
    // webhook and risk Stripe retrying a subscription write that already
    // succeeded.
    console.warn('[conversions] record failed', params.event, error);
    return null;
  }

  return data?.[0]?.id ?? null;
}
