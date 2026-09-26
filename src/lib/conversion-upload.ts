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
 * WHAT IDENTIFIES A PERSON HERE. Hashed email, phone and name, the account id,
 * both Meta browser cookies, and the address and user agent of the checkout
 * request. This changed on 2026-09-08 (#630/#631) and again on 2026-09-10; the
 * header used to say an email never left this file, on the strength of a
 * privacy policy that has since been updated to describe hashed advanced
 * matching. Everything personal is SHA-256 before it goes, per Meta's own
 * normalisation in src/lib/meta-match.ts.
 *
 * WHAT MOVES TO META FROM HERE, AND WHAT DOES NOT. The pixel on
 * 1209354965605238 is wired to a Meta Conversions API Gateway: every event the
 * browser fires is relayed by that gateway to Meta a second time, as a server
 * event carrying the same event id. So for any event the browser reports, Meta
 * already holds a browser copy AND a server copy, and one more from this file
 * is a third arrival of the same event. Meta pairs the browser event with one
 * server copy and leaves the other standing, which is the "Event not
 * deduplicated" flag Ads Manager raised on Initiate checkout on 2026-09-03.
 *
 * `paywall_view` is therefore never sent from here: the browser always fires
 * it, because the browser is what opened the paywall. `trial_start` is the
 * hard case and is decided per row. It USUALLY has a browser copy, fired on
 * the checkout return page — but not when an ad blocker ate fbevents.js, not
 * from an in-app webview, and not when the buyer closed the tab on Stripe's
 * receipt. Those trials reached Meta zero times while this file skipped the
 * event wholesale. So the browser now says when it has fired
 * (`browser_reported_at`), and this file sends the server copy only for the
 * ones where it has not. See `trialCopyIsOurs`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildIngestRequest,
  googleAdIdentifiers,
  googleDataManagerAction,
  googleDataManagerConfig,
  googleEventTimestamp,
  googleUploadsThisEvent,
  ingestGoogleEvent,
} from './google-data-manager';
import { META_SIGNUP_EVENT, signupEventId } from './signup-conversion';
import { resolveMetaIdentity, type MetaIdentity } from './meta-identity';


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
  /** Meta's `_fbp` browser id off the checkout, when it carried one. */
  fbp?: string | null;
  /** Meta's `_fbc` click cookie, as fbevents.js wrote it at the ad click. */
  fbc?: string | null;
  /** The checkout request's address and user agent, for Meta's matching. */
  client_ip?: string | null;
  client_user_agent?: string | null;
  /**
   * When the pixel confirmed it fired its own copy. Null means no browser
   * copy is coming and the server upload is Meta's only chance to hear about
   * this conversion.
   */
  browser_reported_at?: string | null;
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
 * The Meta event each of ours reports as, or null for one Meta is not told
 * about. All three are standard names, chosen so Meta's pre-trained models
 * apply.
 *
 * `paywall_view` is null since 2026-09-08. It used to go up as
 * InitiateCheckout; that name now belongs to the Begin checkout tap, which the
 * browser fires and the pixel's Conversions API Gateway relays, and an upload
 * of the open under the same name would put modal opens back into the event
 * the campaign bids on. The row is still written for the admin and still
 * uploaded to Google. See src/lib/paywall-conversion.ts.
 */
export function metaEventName(event: ConversionRow['event_type']): string | null {
  if (event === 'purchase') return 'Purchase';
  if (event === 'signup') return META_SIGNUP_EVENT;
  if (event === 'paywall_view') return null;
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
  | { status: 'failed'; error: string }
  /**
   * Not now, but not resolved either: leave the row exactly as it is, do not
   * spend one of its five attempts, and look again next drain. Distinct from
   * `skipped`, which is a resting state a row never leaves.
   */
  | { status: 'deferred'; reason: string };

// ── Google ──────────────────────────────────────────────

/**
 * Report a conversion to Google through the Data Manager API.
 *
 * This replaced an `UploadClickConversions` call to the Ads API on
 * 2026-09-15. That call could never have worked from this account: the offline
 * upload feature is allowlisted, the allowlist closed on 15 June 2026 to any
 * developer token that had not already used it, and this account had not. The
 * rows it was meant to send have been resting at `google_not_configured` ever
 * since. See src/lib/google-data-manager.ts for the replacement and for why
 * both copies of a trial are now sent rather than one.
 *
 * Unlike the Meta leg, there is no browser-copy grace here. Google dedupes the
 * gtag conversion against this upload on the shared transaction id, so sending
 * both is the correct move and is what recovers the trials the return page
 * never fires for.
 */
async function uploadToGoogle(row: ConversionRow, identity?: MetaIdentity): Promise<UploadOutcome> {
  const cfg = googleDataManagerConfig();
  if (!cfg) return { status: 'skipped', reason: 'google_not_configured' };

  const actionId = googleDataManagerAction(cfg, row.event_type);
  if (!actionId) return { status: 'skipped', reason: `google_no_action:${row.event_type}` };

  const transactionId = conversionEventId(row);
  if (!transactionId) return { status: 'skipped', reason: 'no_event_id' };

  // A click id OR a hashed email is enough. Requiring the click id is the
  // mistake the Meta leg made until 2026-09-10: it biases everything the
  // network learns towards the browsers that keep query strings. Nothing to
  // match on at all is a genuine skip.
  const emailHash = identity?.em ?? null;
  if (!googleAdIdentifiers(row) && !emailHash) {
    return { status: 'skipped', reason: 'no_google_identifier' };
  }

  if (!googleEventTimestamp(row.occurred_at)) {
    return { status: 'skipped', reason: 'bad_timestamp' };
  }

  // A trial sends no value, so the fixed value on the conversion action stands
  // as the single place that number lives. `conversionValue` is documented as
  // required, so `GOOGLE_DM_TRIAL_VALUE_CENTS` is the escape hatch if the API
  // turns out to insist; it is unset by default.
  const value =
    conversionValue(row) ??
    (row.event_type === 'trial_start' && cfg.trialValueCents !== null
      ? { value: cfg.trialValueCents / 100, currency: row.currency.toUpperCase() }
      : null);

  const body = buildIngestRequest({
    row,
    actionId,
    customerId: cfg.customerId,
    emailHash,
    transactionId,
    value,
    validateOnly: cfg.validateOnly,
  });

  const { requestId } = await ingestGoogleEvent(cfg, body);

  // A dry run proves the credentials and the ids and records nothing, so the
  // row must stay in the queue. Deferred rather than skipped: skipped is a
  // resting state a row never leaves, and this one has to be sent for real the
  // moment the flag comes off.
  if (cfg.validateOnly) {
    console.info('[google-data-manager] validated', row.id, requestId);
    return { status: 'deferred', reason: 'google_validate_only' };
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
 *
 * The stored `_fbc` cookie wins when there is one. fbevents.js assembled it at
 * the click, from the click, and it is the same string the browser events
 * carry — so the server copy and the browser copy agree.
 *
 * Rebuilt only from a real click time. This used to fall back to
 * `occurred_at`, which on a day-7 purchase produced an fbc asserting the click
 * happened a week after it did: accepted by the endpoint, matched against
 * nothing, and indistinguishable from working. No click time now means no
 * fbc, and the event goes on the other identifiers instead.
 */
export function metaFbc(row: ConversionRow): string | null {
  if (row.fbc) return row.fbc;
  if (!row.click_id || row.click_type !== 'fbclid' || !row.click_at) return null;
  const clickMs = new Date(row.click_at).getTime();
  if (!Number.isFinite(clickMs)) return null;
  return `fb.1.${clickMs}.${row.click_id}`;
}

/**
 * Events the browser ALWAYS reports to Meta itself, and which the pixel's
 * Conversions API Gateway then relays as the server copy. Sending them from
 * here as well makes three arrivals of one event, and Meta only dedupes two of
 * them. See the file header.
 *
 * "Always" is the whole membership test, and it is why only one event is left
 * in here. A paywall open is fired BY the browser opening the paywall: there
 * is no version of that event where no browser saw it. `trial_start` looked
 * like the same shape and was in this set until 2026-09-10, but its browser
 * copy fires on a page the buyer may never load, so the trials that most
 * needed reporting were the exact ones being skipped. It is decided per row
 * now: see `trialCopyIsOurs`.
 *
 * Never here: `purchase`, charged on day 7 with no browser left to fire
 * anything, so this queue is its only route to Meta. `signup` fires from the
 * browser but is queued only when it carries a click id, and it is not the
 * event any campaign bids on; left as-is.
 */
export const META_GATEWAY_OWNED_EVENTS: ReadonlySet<ConversionRow['event_type']> = new Set([
  'paywall_view',
]);

/** How long to wait for the pixel to say it fired before sending our own copy. */
export const BROWSER_COPY_GRACE_MS = 20 * 60 * 1000;

/**
 * Whether the server copy of a `trial_start` is ours to send.
 *
 *   'browser'  the pixel reported. Its copy plus the gateway's relay is
 *              already two arrivals; a third is the deduplication flag.
 *   'wait'     too early to tell. The return page fires within seconds of the
 *              redirect back from Stripe, so twenty minutes of silence is a
 *              generous read of "no browser copy is coming".
 *   'ours'     nobody reported. An ad blocker, an in-app webview, a tab shut
 *              on Stripe's receipt, or a magic-link bounce into a different
 *              browser. These are the trials Meta never heard about at all,
 *              and they are the reason this branch exists.
 *
 * Every other event type is unaffected: a purchase has no browser to wait for
 * and a paywall open never leaves this queue.
 */
export function trialCopyIsOurs(
  row: Pick<ConversionRow, 'event_type' | 'occurred_at' | 'browser_reported_at'>,
  nowMs: number = Date.now(),
): 'browser' | 'wait' | 'ours' {
  if (row.event_type !== 'trial_start') return 'ours';
  if (row.browser_reported_at) return 'browser';
  const occurredMs = new Date(row.occurred_at).getTime();
  // An unparseable timestamp must not wedge a row in the queue forever.
  if (!Number.isFinite(occurredMs)) return 'ours';
  return nowMs - occurredMs < BROWSER_COPY_GRACE_MS ? 'wait' : 'ours';
}

/**
 * Meta needs at least one thing to match a person on, and some things are not
 * worth matching on.
 *
 * The address and the user agent are deliberately not enough by themselves.
 * Meta accepts them, and a match made on a shared mobile IP and a common
 * Android user agent is a coin toss that credits somebody else's ad. They
 * sharpen a match; they do not make one.
 */
export function hasMetaIdentifier(userData: MetaIdentity & { fbc?: string }): boolean {
  return Boolean(
    userData.fbc || userData.fbp || userData.em || userData.ph || userData.external_id,
  );
}

async function uploadToMeta(row: ConversionRow, identity?: MetaIdentity): Promise<UploadOutcome> {
  if (META_GATEWAY_OWNED_EVENTS.has(row.event_type)) {
    return { status: 'skipped', reason: `gateway_owned:${row.event_type}` };
  }
  // Whose copy this is, decided before the credentials are looked at, so the
  // reason names the real cause in every environment rather than reading as
  // an unconfigured uploader.
  const browserCopy = trialCopyIsOurs(row);
  if (browserCopy === 'browser') {
    return { status: 'skipped', reason: 'browser_reported' };
  }
  if (browserCopy === 'wait') {
    return { status: 'deferred', reason: 'awaiting_browser_copy' };
  }

  const cfg = metaConfig();
  if (!cfg) return { status: 'skipped', reason: 'meta_not_configured' };

  // The click id is one identifier among several now, not the price of entry.
  // Requiring it dropped two thirds of the purchases in the thirty days to
  // 2026-09-10 and biased everything Meta learned towards the browsers that
  // keep query strings. See networkForStripeConversion in src/lib/conversions.ts.
  const fbc = metaFbc(row);
  const userData: MetaIdentity = { ...(identity ?? {}), ...(fbc ? { fbc } : {}) };
  if (!hasMetaIdentifier(userData)) {
    return { status: 'skipped', reason: 'no_meta_identifier' };
  }

  const eventId = conversionEventId(row);
  if (!eventId) return { status: 'skipped', reason: 'no_event_id' };

  const eventName = metaEventName(row.event_type);
  if (!eventName) return { status: 'skipped', reason: `not_a_meta_event:${row.event_type}` };

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.reelcaster.com';
  const value = conversionValue(row);

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(new Date(row.occurred_at).getTime() / 1000),
        action_source: 'website',
        event_source_url: `${origin}${row.landing_path ?? '/'}`,
        // Stable and derived, not random: the browser fires StartTrial and
        // CompleteRegistration with these same ids, and Meta dedupes the pair
        // on them rather than counting each conversion twice.
        event_id: eventId,
        // Everything the account holds by now, hashed Meta's way: this is a
        // server-only event with no pixel to carry the browser's identifiers,
        // so the match is only as good as this object.
        user_data: userData,
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

export async function uploadConversion(
  row: ConversionRow,
  identity?: MetaIdentity,
): Promise<UploadOutcome> {
  try {
    switch (row.upload_network) {
      case 'google':
        return await uploadToGoogle(row, identity);
      case 'meta':
        return await uploadToMeta(row, identity);
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
 * The reasons a google row was parked that this code no longer agrees with.
 *
 * `google_not_configured` is every google row written since the Seattle launch:
 * the Ads API upload leg had credentials it could never use, so the drain
 * rested each row on the first pass. `no_click_id` and the action-unset reason
 * are the same class of stale decision. None of them are true once Data Manager
 * credentials exist, and the conversions behind them are real: 4 gclid trials
 * as of 2026-09-15, one of which the browser tag also lost.
 */
const GOOGLE_STALE_SKIPS = [
  'google_not_configured',
  'google_conversion_action_unset',
  'no_click_id',
];

/**
 * How far back to reopen. Google accepts a conversion against a click for 90
 * days; 60 leaves room for the row to sit in the queue and for the click to
 * predate the conversion by a few days without the upload landing outside the
 * window on arrival.
 */
const GOOGLE_REQUEUE_DAYS = 60;

/**
 * Put the parked google rows back in the queue.
 *
 * Self-healing rather than a post-deploy SQL script, for the same reason the
 * Meta organic requeue was (#638): a migration someone has to remember to run
 * by hand is a migration that gets run on some environments and not others,
 * and this one has to work on production exactly once, unattended, whenever
 * Casey finishes minting credentials — which will not be the day this deploys.
 *
 * Idempotent and self-limiting. A row it reopens either uploads or comes to
 * rest on a NEW reason (`google_no_action`, `no_google_identifier`), and those
 * reasons are not in the list above, so nothing loops. Only the two events the
 * uploader actually sends are touched; a paywall open or a signup would just
 * be parked again on the next pass.
 */
export async function requeueGoogleConversions(admin: SupabaseClient): Promise<number> {
  if (!googleDataManagerConfig()) return 0;

  const since = new Date(Date.now() - GOOGLE_REQUEUE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from('marketing_conversions')
    .update({ upload_status: 'pending', upload_attempts: 0, upload_last_error: null })
    .eq('upload_network', 'google')
    .eq('upload_status', 'skipped')
    .in('upload_last_error', GOOGLE_STALE_SKIPS)
    .in('event_type', ['trial_start', 'purchase'])
    .gte('occurred_at', since)
    .select('id');

  if (error) {
    console.warn('[conversion-upload] google requeue failed', error);
    return 0;
  }
  return data?.length ?? 0;
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
): Promise<{ sent: number; skipped: number; failed: number; deferred: number }> {
  const { data, error } = await admin
    .from('marketing_conversions')
    .select(
      'id, event_type, occurred_at, click_at, value_cents, modeled_value_cents, currency, click_id, click_type, upload_network, upload_attempts, landing_path, stripe_subscription_id, user_id, dedupe_key, fbp, fbc, client_ip, client_user_agent, browser_reported_at',
    )
    .eq('upload_status', 'pending')
    .lt('upload_attempts', MAX_ATTEMPTS)
    .order('occurred_at', { ascending: true })
    .limit(limit);

  if (error || !data) {
    console.warn('[conversion-upload] queue read failed', error);
    return { sent: 0, skipped: 0, failed: 0, deferred: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let deferred = 0;

  for (const row of data as ConversionRow[]) {
    // Both ad networks want an identity, and only the rows they might send are
    // worth two Stripe reads for one. A Meta trial still inside its grace
    // window is skipped here too: it will usually turn out to be the browser's,
    // and resolving an identity for it every drain is a Stripe call per row per
    // fifteen minutes for nothing. Best effort throughout — a failed lookup
    // uploads on whatever identifiers the row itself carries.
    //
    // Google takes only the hashed email out of the object (as enhanced
    // conversions, which is what lifts match quality on an upload), and has no
    // grace window to respect: its two copies deduplicate on the transaction
    // id. The Stripe read is worth it for the same reason it is on Meta — the
    // click id is the identifier most likely to be the one that went missing.
    const wantsIdentity =
      row.upload_network === 'google'
        ? googleUploadsThisEvent(row.event_type)
        : row.upload_network === 'meta' &&
          !META_GATEWAY_OWNED_EVENTS.has(row.event_type) &&
          trialCopyIsOurs(row) === 'ours';
    const identity = wantsIdentity ? await resolveMetaIdentity(admin, row) : undefined;
    const outcome = await uploadConversion(row, identity);

    // A deferred row is untouched: no status, no attempt spent, no error
    // recorded. It is not a failure and it must not age out of the queue.
    if (outcome.status === 'deferred') {
      deferred++;
      continue;
    }

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

  return { sent, skipped, failed, deferred };
}
