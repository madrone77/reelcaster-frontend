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

export type ConversionEvent = 'trial_start' | 'purchase';

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

/** The acquisition context the checkout route stamped onto the subscription. */
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
  params: Record<string, string> | null;
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
    params,
  };
}

export interface RecordConversionParams {
  event: ConversionEvent;
  subscription: Stripe.Subscription;
  userId: string | null;
  /** From Stripe, in cents. Never a list-price constant and never client-sent. */
  valueCents: number;
  currency: string;
  occurredAt: string;
  invoiceId?: string | null;
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
