/**
 * Reporting conversions to Google through the Data Manager API.
 *
 * WHY THIS EXISTS AT ALL. Google's older route for this, the Ads API's
 * `UploadClickConversions`, is permanently closed to this account: since
 * 15 June 2026 it rejects any developer token that had not already uploaded an
 * offline conversion between December 2025 and May 2026
 * (`CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE`), and this account never
 * uploaded one, so it cannot join the allowlist it is being asked for. Every
 * `google` row in `marketing_conversions` has been resting at
 * `skipped / google_not_configured` since the Seattle launch as a result. The
 * Data Manager API is the route Google now points advertisers at, it needs no
 * developer token, and it takes the same click ids.
 *
 * WHAT IT CHANGES. Two things Google could not previously be told:
 *
 *  1. The trials the browser tag loses. On 2026-09-15 the Ads UI counted 3
 *     Sign-ups for Sep 3-13 against 4 gclid `trial_start` rows here. The tag
 *     works; it is just the only channel, and it runs in a browser that has
 *     been round-tripped through Stripe and may be an in-app webview, may have
 *     an ad blocker, may never load the return page at all.
 *  2. The day-7 purchase, which no browser is present for. Google's click
 *     window is long enough to attribute it, unlike Meta's seven days (see
 *     src/lib/conversion-upload.ts), so a purchase uploaded from here is a
 *     conversion Google can actually credit and eventually bid towards. This
 *     is the whole difference between optimising for trials and optimising for
 *     revenue.
 *
 * WHY NO BROWSER-COPY GRACE, UNLIKE META. Google deduplicates a browser
 * conversion against an uploaded one when both carry the same transaction id
 * for the same conversion action, and `transactionId` here is the exact string
 * the gtag conversion sends as `transaction_id` (see src/lib/google-ads.ts).
 * So both copies are sent, always, and Google keeps one. Meta's equivalent
 * needed a twenty-minute wait only because a Conversions API Gateway is
 * already relaying a second copy there and a third arrival is what trips the
 * "Event not deduplicated" flag. Nothing relays anything here.
 *
 * ONE EVENT PER REQUEST. The API fast-fails: one bad field rejects the whole
 * request rather than reporting per-event errors the way the Ads API's
 * `partialFailure` did. The queue uploads a row at a time anyway, so keeping
 * that shape means a rejection names the row that caused it instead of
 * condemning its neighbours.
 *
 * INERT UNTIL CONFIGURED, like every other uploader here. Missing credentials
 * are a clean `skipped`, never a throw into a Stripe webhook.
 */

import type { ConversionRow } from './conversion-upload';

export const DATA_MANAGER_ENDPOINT = 'https://datamanager.googleapis.com/v1/events:ingest';

/**
 * The scope. Deliberately NOT `https://www.googleapis.com/auth/adwords`: the
 * Data Manager API is a separate service with a separate scope, so the
 * refresh token pulled for `src/lib/ad-spend.ts` does not authorise it and a
 * new one has to be minted. That is why this reads its own
 * `GOOGLE_DM_REFRESH_TOKEN` rather than borrowing `GOOGLE_ADS_REFRESH_TOKEN`.
 */
export const DATA_MANAGER_SCOPE = 'https://www.googleapis.com/auth/datamanager';

export interface DataManagerConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Google Ads customer id, digits only. */
  customerId: string;
  /** Conversion action ids, per event. Numeric ids, not tag labels. */
  actions: { trial_start: string | null; purchase: string | null };
  /**
   * Sends every request as a dry run. Google validates and reports back
   * without recording anything, which is the only way to prove credentials
   * and ids are right before real conversions ride on them.
   */
  validateOnly: boolean;
  /**
   * A value for the trial event, in cents, for the case where the API insists
   * on one. Normally unset: the conversion action carries a fixed value in the
   * Ads UI, and a value sent from here would override it, which would put the
   * number in two places that can disagree.
   */
  trialValueCents: number | null;
}

/**
 * Null when anything required is missing, so an unconfigured environment
 * uploads nothing and says so, rather than half-failing.
 *
 * The OAuth client is shared with the Ads API credentials when it is not
 * overridden: the same Cloud project can hold both, and asking Casey to mint a
 * second client for one more scope would be busywork. The refresh token never
 * falls back, because a token minted for `adwords` alone authenticates fine
 * here and then 403s on every call, which is a much worse failure than "not
 * configured".
 */
export function googleDataManagerConfig(): DataManagerConfig | null {
  const clientId = process.env.GOOGLE_DM_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_DM_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DM_REFRESH_TOKEN;
  // Digits only: the dashed form people copy out of the Ads UI is rejected.
  const customerId = (
    process.env.GOOGLE_DM_CUSTOMER_ID ??
    process.env.GOOGLE_ADS_CUSTOMER_ID ??
    ''
  ).replace(/\D/g, '');

  if (!clientId || !clientSecret || !refreshToken || !customerId) return null;

  const trialValue = Number.parseInt(process.env.GOOGLE_DM_TRIAL_VALUE_CENTS ?? '', 10);

  return {
    clientId,
    clientSecret,
    refreshToken,
    customerId,
    actions: {
      trial_start: process.env.GOOGLE_DM_ACTION_TRIAL?.trim() || null,
      purchase: process.env.GOOGLE_DM_ACTION_PURCHASE?.trim() || null,
    },
    validateOnly: process.env.GOOGLE_DM_VALIDATE_ONLY === '1',
    trialValueCents: Number.isFinite(trialValue) ? trialValue : null,
  };
}

/**
 * The conversion action to credit.
 *
 * A Data Manager destination names the action by its numeric id, which is the
 * "Conversion type ID" on the action's own page in the Ads UI. It is not the
 * tag label in src/lib/google-ads.ts: the label identifies the action to the
 * browser tag, the id identifies it to the API, and they are different strings
 * for the same object.
 *
 * `signup` and `paywall_view` are absent on purpose. Both are fired by a
 * browser that is standing right there — a signup happens in our own form, a
 * paywall open happens because the paywall opened — so an upload of either
 * would be a second copy of an event that never goes missing, and the paywall
 * open in particular is the one currently feeding Smart Bidding. If a browser
 * tag for those ever proves lossy the way the trial tag has, add them here.
 */
export function googleDataManagerAction(
  cfg: DataManagerConfig,
  event: ConversionRow['event_type'],
): string | null {
  if (event === 'trial_start') return cfg.actions.trial_start;
  if (event === 'purchase') return cfg.actions.purchase;
  return null;
}

/**
 * Whether a configured Google upload would send this event at all.
 *
 * The drain asks before spending two Stripe reads resolving an identity for a
 * row: an unconfigured environment, or an event with no conversion action id
 * behind it, is going to answer `skipped` either way.
 */
export function googleUploadsThisEvent(event: ConversionRow['event_type']): boolean {
  const cfg = googleDataManagerConfig();
  return cfg ? googleDataManagerAction(cfg, event) !== null : false;
}

/**
 * RFC 3339, Z-normalised, which is what the API documents and what
 * `toISOString` already emits. Nothing like the Ads API's
 * "yyyy-MM-dd HH:mm:ss+HH:mm", so the old `googleDateTime` does not transfer.
 */
export function googleEventTimestamp(iso: string): string | null {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** The one of the three click-id fields this row carries, or null. */
export function googleAdIdentifiers(
  row: Pick<ConversionRow, 'click_id' | 'click_type'>,
): { gclid: string } | { gbraid: string } | { wbraid: string } | null {
  if (!row.click_id) return null;
  // Mutually exclusive fields, not one field with three names. iOS traffic
  // arrives as gbraid or wbraid because Google suppresses gclid there, so
  // handling only gclid would quietly drop the mobile half.
  if (row.click_type === 'gclid') return { gclid: row.click_id };
  if (row.click_type === 'gbraid') return { gbraid: row.click_id };
  if (row.click_type === 'wbraid') return { wbraid: row.click_id };
  return null;
}

export interface IngestInput {
  row: ConversionRow;
  /** The conversion action id this event is being credited to. */
  actionId: string;
  customerId: string;
  /**
   * SHA-256 hex of the person's email, lowercased and trimmed.
   *
   * The same hash the Meta leg sends, reused rather than recomputed, because
   * the two networks agree on this normalisation: trim and lowercase, hash,
   * hex. (Google's extra "drop the dots in a gmail.com address" rule belongs
   * to Customer Match audiences, not to conversion matching, and applying it
   * here would produce a hash the browser tag's own enhanced conversion does
   * not agree with — gtag hashes exactly what it was handed.)
   */
  emailHash?: string | null;
  /** Shared with the browser tag's `transaction_id` so Google keeps one copy. */
  transactionId: string;
  value?: { value: number; currency: string } | null;
  validateOnly?: boolean;
}

/**
 * Build the ingest request body.
 *
 * Pure and exported so the wire format can be asserted in a test rather than
 * discovered in production, which for an uploader that cannot be exercised
 * locally is the only proof available before Casey mints credentials.
 */
export function buildIngestRequest(input: IngestInput): Record<string, unknown> {
  const { row } = input;
  const adIdentifiers = googleAdIdentifiers(row);
  const timestamp = googleEventTimestamp(row.occurred_at);

  const event: Record<string, unknown> = {
    transactionId: input.transactionId,
    // The conversion time, not the click time. The dead Ads API path sent the
    // click time here, which on a day-7 purchase asserted the sale happened a
    // week before it did. Google reports a conversion against the date of the
    // click it matches, and works that out from the click id itself; it does
    // not need us to restate it, and restating it wrongly is how a purchase
    // ends up dated to its own trial.
    eventTimestamp: timestamp,
    eventSource: 'WEB',
    ...(adIdentifiers ? { adIdentifiers } : {}),
    ...(input.emailHash
      ? { userData: { userIdentifiers: [{ emailAddress: input.emailHash }] } }
      : {}),
    ...(input.value
      ? { conversionValue: input.value.value, currency: input.value.currency }
      : {}),
  };

  return {
    destinations: [
      {
        operatingAccount: { accountType: 'GOOGLE_ADS', accountId: input.customerId },
        productDestinationId: input.actionId,
      },
    ],
    // How the hashed identifiers above are encoded. Required whenever any
    // userData rides along, and ignored when none does.
    encoding: 'HEX',
    events: [event],
    ...(input.validateOnly ? { validateOnly: true } : {}),
  };
  // No `consent` block. The field is optional, its two values are assertions
  // about a consent signal we do not collect, and asserting CONSENT_GRANTED
  // because it is the convenient answer would be a claim about a person that
  // nothing here can support. Omitted means unspecified, which is the truth.
}

/**
 * Exchange the refresh token for an access token on the Data Manager scope.
 *
 * Separate from `googleAccessToken` in src/lib/google-ads-auth.ts even though
 * the dance is identical, because that function's config type demands a
 * developer token this API has no use for. One small duplication beats making
 * the Ads credentials type lie about what it requires.
 */
export async function dataManagerAccessToken(cfg: DataManagerConfig): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`data manager oauth ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('data manager oauth returned no access_token');
  return json.access_token;
}

/**
 * POST one event.
 *
 * Returns the request id, which is the only handle on what happened to an
 * accepted event: the API answers 200 with a `requestId` and optional
 * `fieldWarnings`, and processing diagnostics are looked up by that id
 * afterwards. Warnings are logged rather than failed on — a warning means
 * accepted-with-notes, and treating it as a failure would retry an event
 * Google already holds.
 */
export async function ingestGoogleEvent(
  cfg: DataManagerConfig,
  body: Record<string, unknown>,
): Promise<{ requestId: string | null }> {
  const token = await dataManagerAccessToken(cfg);
  const res = await fetch(DATA_MANAGER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`data manager ${res.status}: ${text.slice(0, 300)}`);
  }

  const parsed = JSON.parse(text || '{}') as {
    requestId?: string;
    fieldWarnings?: unknown[];
  };
  if (parsed.fieldWarnings?.length) {
    console.warn(
      '[google-data-manager] field warnings',
      parsed.requestId,
      JSON.stringify(parsed.fieldWarnings).slice(0, 500),
    );
  }
  return { requestId: parsed.requestId ?? null };
}
