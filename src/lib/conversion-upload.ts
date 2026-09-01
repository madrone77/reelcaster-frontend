/**
 * Reporting a conversion back to the network that sold us the click.
 *
 * This is the half that changes what the ad platforms DO. Without it, Google
 * and Meta only ever learn that somebody started a free trial, so their bidding
 * optimises towards cheap trial signups — and at $33/year the cheapest trial
 * signups are reliably the ones that never pay. Sending the actual purchase
 * back, seven days later, is what lets bidding optimise towards revenue.
 *
 * Both networks are called over plain REST rather than through their official
 * SDKs. Google's client library is a very large dependency for what amounts to
 * one token refresh and one POST, and it would land in a bundle that a cold ad
 * landing page has to pay for.
 *
 * Everything here no-ops cleanly when unconfigured. Credentials for these two
 * APIs are fiddly and arrive late, and the failure mode of a half-configured
 * uploader must be "nothing was sent", never "the webhook 500s and Stripe
 * retries the subscription write".
 *
 * Deliberately NOT sent: email, hashed or otherwise. Meta's match rate would
 * improve with it, and the privacy policy says we do not send it, so we do not
 * send it. The click id is the only identifier that leaves here, and the
 * network issued that id itself.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { googleAdsConfig, googleAccessToken, googleAdsHeaders } from './google-ads-auth';
import { META_SIGNUP_EVENT, signupEventId } from './signup-conversion';
import { PAYWALL_VIEW_META_EVENT } from './paywall-conversion';

/** Give up after this many tries, so a permanently bad row stops churning. */
const MAX_ATTEMPTS = 5;

export interface ConversionRow {
  id: number;
  event_type: 'trial_start' | 'purchase' | 'signup' | 'paywall_view';
  occurred_at: string;
  click_at: string | null;
  value_cents: number;
  /** Reporting-only worth of a free signup. Zero on the two Stripe events. */
  modeled_value_cents: number;
  currency: string;
  click_id: string | null;
  click_type: string | null;
  upload_network: string | null;
  upload_attempts: number;
  landing_path: string | null;
  /** Null on a signup, which is the one event with no subscription behind it. */
  stripe_subscription_id: string | null;
  /** Null on the anon buy-first flow until the account exists. */
  user_id: string | null;
  /**
   * Set only on `paywall_view`, the one event with neither a subscription nor
   * an account to key on. See src/lib/paywall-conversion.ts.
   */
  dedupe_key: string | null;
}

/**
 * The id a conversion is deduplicated on, shared with whatever browser tag
 * reports the same event.
 *
 * Stripe events key on the subscription, which both halves can see. A signup
 * has none, so it keys on the account instead, via the same helper the browser
 * uses. A signup with no user id cannot be deduplicated and is not uploaded at
 * all; that combination does not occur, because the row is written by the route
 * that authenticated the user.
 */
export function conversionEventId(row: ConversionRow): string | null {
  if (row.event_type === 'signup') {
    return row.user_id ? signupEventId(row.user_id) : null;
  }
  // A paywall open has neither, and its dedupe key is already a stable
  // per-session string chosen for exactly this second job.
  if (row.event_type === 'paywall_view') {
    return row.dedupe_key;
  }
  return row.stripe_subscription_id ? `${row.stripe_subscription_id}:${row.event_type}` : null;
}

/**
 * The Meta event each of ours reports as. Three are standard names, chosen so
 * Meta's pre-trained models apply; `paywall_view` is custom because no standard
 * event means it and borrowing one would make two behaviours unreadable. The
 * argument is at the top of src/lib/paywall-conversion.ts.
 */
export function metaEventName(event: ConversionRow['event_type']): string {
  if (event === 'purchase') return 'Purchase';
  if (event === 'signup') return META_SIGNUP_EVENT;
  if (event === 'paywall_view') return PAYWALL_VIEW_META_EVENT;
  return 'StartTrial';
}

/**
 * What to tell Meta the conversion was worth, or null to send no value.
 *
 * A purchase reports what Stripe actually charged. A signup reports a modeled
 * figure, which is honest only because it rides on its own event name and can
 * never be summed into purchase revenue. A trial start reports nothing, because
 * a free week is worth nothing until it converts and the purchase event says so
 * seven days later.
 */
export function conversionValue(
  row: ConversionRow,
): { value: number; currency: string } | null {
  if (row.event_type === 'purchase') {
    return { value: row.value_cents / 100, currency: row.currency.toUpperCase() };
  }
  if (row.event_type === 'signup' && row.modeled_value_cents > 0) {
    return { value: row.modeled_value_cents / 100, currency: row.currency.toUpperCase() };
  }
  return null;
}

export type UploadOutcome =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string };

// ── Google Ads ───────────────────────────────────────────────────────

const GOOGLE_API_VERSION = 'v18';

/** The conversion action to credit, which differs per event. */
function googleConversionAction(event: ConversionRow['event_type']): string | null {
  const raw =
    event === 'purchase'
      ? process.env.GOOGLE_ADS_CONVERSION_ACTION_PURCHASE
      : event === 'signup'
        ? process.env.GOOGLE_ADS_CONVERSION_ACTION_SIGNUP
        : event === 'paywall_view'
          ? process.env.GOOGLE_ADS_CONVERSION_ACTION_PAYWALL_VIEW
          : process.env.GOOGLE_ADS_CONVERSION_ACTION_TRIAL;
  return raw?.trim() || null;
}

/**
 * Google wants "yyyy-MM-dd HH:mm:ss+HH:mm" and rejects ISO-8601 with a "T" or
 * a "Z". Emitted in UTC with an explicit +00:00 offset, which is accepted and
 * saves guessing at the advertiser account's timezone.
 */
export function googleDateTime(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 19).replace('T', ' ')}+00:00`;
}

async function uploadToGoogle(row: ConversionRow): Promise<UploadOutcome> {
  const cfg = googleAdsConfig();
  if (!cfg) return { status: 'skipped', reason: 'google_not_configured' };

  const conversionAction = googleConversionAction(row.event_type);
  if (!conversionAction) {
    return { status: 'skipped', reason: 'google_conversion_action_unset' };
  }
  if (!row.click_id || !row.click_type) {
    return { status: 'skipped', reason: 'no_click_id' };
  }

  // gclid, gbraid and wbraid are mutually exclusive fields, not one field with
  // three names. Sending the wrong key is silently ignored by the API.
  const idField =
    row.click_type === 'gclid'
      ? { gclid: row.click_id }
      : row.click_type === 'gbraid'
        ? { gbraid: row.click_id }
        : row.click_type === 'wbraid'
          ? { wbraid: row.click_id }
          : null;
  if (!idField) return { status: 'skipped', reason: `not_a_google_click:${row.click_type}` };

  const token = await googleAccessToken(cfg);
  const headers = googleAdsHeaders(cfg, token);

  const res = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_API_VERSION}/customers/${cfg.customerId}:uploadClickConversions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversions: [
          {
            ...idField,
            conversionAction,
            // Click time, not conversion time, is what Google reports against.
            conversionDateTime: googleDateTime(row.click_at ?? row.occurred_at),
            conversionValue: conversionValue(row)?.value ?? 0,
            currencyCode: row.currency.toUpperCase(),
          },
        ],
        // Without this a single bad row fails the whole request. With it, the
        // errors come back per-conversion and are readable.
        partialFailure: true,
      }),
    },
  );

  const body = await res.text();
  if (!res.ok) throw new Error(`google ${res.status}: ${body.slice(0, 300)}`);

  // A 200 with partialFailureError means the conversion was REJECTED. Treating
  // that as success is the classic way to believe uploads are working for
  // months while Google has accepted nothing.
  const parsed = JSON.parse(body) as { partialFailureError?: { message?: string } };
  if (parsed.partialFailureError) {
    throw new Error(`google partial failure: ${(parsed.partialFailureError.message ?? '').slice(0, 300)}`);
  }

  return { status: 'sent' };
}

// ── Meta ─────────────────────────────────────────────────────────────

const META_API_VERSION = 'v21.0';

function metaConfig() {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return null;
  return { pixelId, accessToken, testCode: process.env.META_CAPI_TEST_CODE || null };
}

/**
 * Meta does not accept a bare fbclid. It wants `fb.1.<click_time_ms>.<fbclid>`,
 * where the 1 is the subdomain-index and the timestamp is when the click
 * happened. Sending the raw id is accepted by the endpoint and then matches
 * nothing, which is the worst of both outcomes.
 */
export function metaFbc(row: ConversionRow): string | null {
  if (!row.click_id) return null;
  const clickMs = new Date(row.click_at ?? row.occurred_at).getTime();
  return `fb.1.${clickMs}.${row.click_id}`;
}

async function uploadToMeta(row: ConversionRow): Promise<UploadOutcome> {
  const cfg = metaConfig();
  if (!cfg) return { status: 'skipped', reason: 'meta_not_configured' };
  if (row.click_type !== 'fbclid') {
    return { status: 'skipped', reason: `not_a_meta_click:${row.click_type}` };
  }
  const fbc = metaFbc(row);
  if (!fbc) return { status: 'skipped', reason: 'no_click_id' };

  const eventId = conversionEventId(row);
  if (!eventId) return { status: 'skipped', reason: 'no_event_id' };

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.reelcaster.com';
  const value = conversionValue(row);

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: metaEventName(row.event_type),
        event_time: Math.floor(new Date(row.occurred_at).getTime() / 1000),
        action_source: 'website',
        event_source_url: `${origin}${row.landing_path ?? '/'}`,
        // Stable and derived, not random: the browser fires StartTrial and
        // CompleteRegistration with these same ids, and Meta dedupes the pair
        // on them rather than counting each conversion twice.
        event_id: eventId,
        user_data: { fbc },
        ...(value ? { custom_data: value } : {}),
      },
    ],
  };
  if (cfg.testCode) payload.test_event_code = cfg.testCode;

  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${cfg.pixelId}/events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    throw new Error(`meta ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return { status: 'sent' };
}

// ── Dispatch ─────────────────────────────────────────────────────────

export async function uploadConversion(row: ConversionRow): Promise<UploadOutcome> {
  try {
    switch (row.upload_network) {
      case 'google':
        return await uploadToGoogle(row);
      case 'meta':
        return await uploadToMeta(row);
      case null:
      case undefined:
        return { status: 'skipped', reason: 'no_network' };
      default:
        // Microsoft and anything added later: recorded, not uploadable yet.
        return { status: 'skipped', reason: `unsupported_network:${row.upload_network}` };
    }
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'unknown error' };
  }
}

/**
 * Drain the pending queue.
 *
 * Called from the webhook (so a conversion is normally reported within
 * seconds) and from a cron (so a network outage during that moment is not
 * permanent). Both are safe to run concurrently: the worst case is one
 * duplicate upload, which both networks dedupe — Meta on `event_id`, Google on
 * the click id plus conversion action plus time.
 */
export async function uploadPendingConversions(
  admin: SupabaseClient,
  limit = 25,
): Promise<{ sent: number; skipped: number; failed: number }> {
  const { data, error } = await admin
    .from('marketing_conversions')
    .select(
      'id, event_type, occurred_at, click_at, value_cents, modeled_value_cents, currency, click_id, click_type, upload_network, upload_attempts, landing_path, stripe_subscription_id, user_id, dedupe_key',
    )
    .eq('upload_status', 'pending')
    .lt('upload_attempts', MAX_ATTEMPTS)
    .order('occurred_at', { ascending: true })
    .limit(limit);

  if (error || !data) {
    console.warn('[conversion-upload] queue read failed', error);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of data as ConversionRow[]) {
    const outcome = await uploadConversion(row);
    const attempts = (row.upload_attempts ?? 0) + 1;

    if (outcome.status === 'sent') {
      sent++;
      await admin
        .from('marketing_conversions')
        .update({
          upload_status: 'sent',
          upload_attempts: attempts,
          uploaded_at: new Date().toISOString(),
          upload_last_error: null,
        })
        .eq('id', row.id);
      continue;
    }

    if (outcome.status === 'skipped') {
      skipped++;
      // A resting state, not an error. Recorded so the dashboard can say WHY
      // nothing was sent, which is the difference between "not configured yet"
      // and "silently broken".
      await admin
        .from('marketing_conversions')
        .update({
          upload_status: 'skipped',
          upload_attempts: attempts,
          upload_last_error: outcome.reason,
        })
        .eq('id', row.id);
      continue;
    }

    failed++;
    // Stay pending while retries remain; only a exhausted row becomes failed,
    // so a transient 503 does not permanently lose a conversion.
    await admin
      .from('marketing_conversions')
      .update({
        upload_status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        upload_attempts: attempts,
        upload_last_error: outcome.error.slice(0, 500),
      })
      .eq('id', row.id);
  }

  return { sent, skipped, failed };
}
