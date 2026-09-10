/**
 * The acquisition context stamped onto a Stripe subscription at checkout.
 *
 * Lived inside src/app/api/stripe/checkout/route.ts until 2026-09-10. It is
 * here because the wallet path — /api/stripe/express-checkout, the Apple Pay
 * and Google Pay sheet — creates subscriptions of its own and stamped NONE of
 * this, so every wallet trial reached the database with no click id, no click
 * time and no browser ids, and was invisible to both ad networks. One copy,
 * two callers.
 *
 * `acq_*` describes the touch we will report back to the ad network. The paid
 * touch wins when there is one, because that is the click the network sold us
 * and the only one it can match a conversion against; first touch is the
 * fallback so organic campaign tags still land somewhere. `acq_model` records
 * which of the two it was, so nothing downstream has to guess.
 *
 * Everything goes into `subscription_data.metadata`, not just the session's.
 * The webhook resolves from `subscription.metadata`, so anything left only on
 * the session is invisible to it.
 *
 * WHY STRIPE METADATA AND NOT A TABLE. The first payment lands seven days
 * after the card does, and the buyer's browser is long gone by then. Stripe
 * metadata is the only carrier that survives that week and comes back attached
 * to the money. For the pay-first anon flow it is not merely convenient, it is
 * the ONLY carrier: no account exists yet, so there is no user_settings row
 * holding attribution for the webhook to read. Lose it here and an ad that
 * bought a paying customer is unattributable forever.
 */

import {
  readEntry,
  readFbc,
  readFbp,
  readPaid,
  readWall,
  type CampaignParams,
} from './attribution';
import { classifyUserAgent } from './device';
import { readEdgeGeo } from './edge-geo';

/** Stripe caps metadata values at 500 chars. Stay well inside it. */
export const META_MAX = 400;

export function meta(value: string | null | undefined): string {
  return (value || '').slice(0, META_MAX);
}

/**
 * The client IP, as the edge saw it.
 *
 * Kept for one reason: Meta's Conversions API weights `client_ip_address`
 * alongside the user agent when matching a server event to a person, and a
 * day-7 purchase has no browser left to supply either. Until 2026-09-10 this
 * file kept only the resolved place and not the address, which was the right
 * call when the click id was the only identifier we sent and the wrong one now
 * that the server leg is the primary report for a trial.
 *
 * `x-forwarded-for` is a list; the first entry is the client and the rest are
 * proxies. Vercel sets `x-real-ip` to the same value, used as the fallback.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  const ip = first || headers.get('x-real-ip')?.trim() || null;
  // A header a client can set freely. Anything that is not plausibly an
  // address is dropped rather than forwarded to Meta as one.
  if (!ip || ip.length > 45 || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}

/**
 * Build the `acq_*`, `attr_*` and browser-id metadata for a checkout.
 *
 * Takes `Headers` rather than a request so both Stripe routes and the tests
 * can call it with the same argument.
 */
export function acquisitionMetadata(headers: Headers): Record<string, string> {
  const cookieHeader = headers.get('cookie') ?? '';
  const wall = readWall(cookieHeader);
  const paid = readPaid(cookieHeader);
  const entry = readEntry(cookieHeader);

  const out: Record<string, string> = {};

  if (wall) {
    out.attr_feature = meta(wall.feature);
    out.attr_from = meta(wall.from);
  }

  // Meta's two browser ids, for the server-side upload (src/lib/attribution.ts).
  // `_fbp` identifies the browser; `_fbc` is the click, already assembled by
  // fbevents.js in the exact form Meta wants and therefore better than
  // anything we can rebuild from a bare fbclid.
  const fbp = readFbp(cookieHeader);
  if (fbp) out.acq_fbp = meta(fbp);
  const fbc = readFbc(cookieHeader);
  if (fbc) out.acq_fbc = meta(fbc);

  const touch: CampaignParams | null = paid ?? entry;
  if (touch) {
    out.acq_model = paid ? 'paid' : 'first';
    // Click id is NOT clamped by the normaliser upstream and must not be
    // altered here either: it is an opaque network token and a truncated one
    // matches nothing at upload time. 400 chars is far beyond any real id.
    if (touch.click_id) out.acq_click_id = meta(touch.click_id);
    if (touch.click_type) out.acq_click_type = touch.click_type;
    if (touch.utm_source) out.acq_source = meta(touch.utm_source);
    if (touch.utm_medium) out.acq_medium = meta(touch.utm_medium);
    if (touch.utm_campaign) out.acq_campaign = meta(touch.utm_campaign);
    if (touch.utm_content) out.acq_content = meta(touch.utm_content);
    if (touch.utm_term) out.acq_term = meta(touch.utm_term);
    if (paid?.landing_path) out.acq_landing = meta(paid.landing_path);
    // When the CLICK happened, not when checkout did. Meta builds fbc as
    // fb.1.<click_time_ms>.<fbclid> and match quality drops if this is
    // guessed at; Google likewise reports against click time.
    if (paid?.ts) out.acq_click_at = meta(paid.ts);
    // The long tail as one value rather than eleven keys: Stripe allows 50 and
    // they are read as a unit, never filtered on.
    const params = touch.params ?? {};
    if (Object.keys(params).length > 0) {
      out.acq_params = meta(JSON.stringify(params));
    }
  }

  // Entry path is worth keeping even when the paid touch won, because it says
  // which landing page variant started the relationship.
  if (entry?.entry_path) out.acq_entry_path = meta(entry.entry_path);

  // Device and coarse location of THIS request, so the campaign report can
  // carry its device and location split all the way through to the sale
  // instead of stopping at the click. Read from headers rather than a cookie:
  // these describe the machine the purchase is being made on, which is the
  // only device Stripe will ever be able to tell us about.
  //
  // Honest about what it is not. This is the checkout device, not the ad-click
  // device. Someone who taps an ad on a phone and buys on a laptop is recorded
  // as a laptop here, and correctly as a phone in campaign_events_daily. The
  // two columns answer different questions and the report labels them as such.
  const userAgent = headers.get('user-agent');
  const ua = classifyUserAgent(userAgent);
  if (ua.device !== 'unknown') out.acq_device = ua.device;
  if (ua.os !== 'unknown') out.acq_os = ua.os;

  // The raw string and the address, for Meta's matching rather than for any
  // report of ours. Both describe the checkout request, which is the closest
  // thing to a browser the day-7 purchase will ever have.
  if (userAgent) out.acq_ua = meta(userAgent);
  const ip = clientIp(headers);
  if (ip) out.acq_ip = ip;

  const geo = readEdgeGeo(headers);
  if (geo.country) out.acq_country = meta(geo.country);
  if (geo.region) out.acq_region = meta(geo.region);
  if (geo.city) out.acq_city = meta(geo.city);

  return out;
}

/**
 * The acquisition keys, lifted off one Stripe object's metadata to be stamped
 * onto another.
 *
 * The wallet flow is two requests: the first confirms a SetupIntent while the
 * browser's cookies are readable, the second creates the subscription from a
 * bare intent id. The webhook only ever reads `subscription.metadata`, so the
 * keys have to be carried across by hand.
 *
 * Prefix-matched rather than listed, so a key added to `acquisitionMetadata`
 * above is forwarded without a second edit here — the failure mode of a hand
 * kept list is a field that is captured, dropped in transit, and never
 * missed.
 */
export function forwardedAcquisition(
  source: Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!source) return out;
  for (const [key, value] of Object.entries(source)) {
    if (!value) continue;
    if (key.startsWith('acq_') || key.startsWith('attr_')) out[key] = value;
  }
  return out;
}
