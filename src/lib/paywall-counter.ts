/**
 * The paywall reporter, in one place.
 *
 * Every upgrade wall we show should answer three questions now: how often was
 * it seen, how often did somebody act on it, and how often did somebody look
 * at it and say no. The answer lands in two tables through one request to
 * POST /api/attribution/paywall:
 *
 *   paywall_impressions  the day-grain counter, unchanged, read by
 *                        /admin/reelcaster/paywalls. Only 'impression' and
 *                        'cta_click' reach it; it has two integer columns and
 *                        nowhere to put anything else.
 *   paywall_events       one row per event, with the campaign, device and city
 *                        the request itself carries. This is the denominator
 *                        marketing_conversions never had.
 *
 * This lived inside `<ProTrialModal>` as a private callback, which is why the
 * two walls that do not route through that modal, the `<UpgradeRequiredModal>`
 * on /alerts and the `<UnlockWithProCard>` on /support, were counted nowhere.
 * They fired Mixpanel events and stopped there, so on the admin they read as
 * walls nobody had ever seen rather than as walls with no data. A shared
 * function is the fix: a new wall has one obvious thing to call.
 *
 * WHAT THE CLIENT IS TRUSTED WITH, AND WHAT IT IS NOT. Everything in
 * `PaywallReport` below is client-supplied and describes the wall: which one,
 * where, who was looking, what they had been doing. Everything about the
 * VISIT — campaign, click type, device, os, country, region, city, session —
 * is read on the server off the request's own headers and cookies and is never
 * accepted from a body. A report a visitor can write is not a report, and the
 * headers are already on the request, so asking the browser to describe itself
 * would add a lie surface for nothing.
 *
 * WHAT THE SERVER WILL ACCEPT. `feature` is validated against the live
 * `NAG_FEATURES` enum and rejected with a 400 if it is not a member, so a wall
 * with a made-up feature id counts nothing, quietly. That is why the argument
 * is typed as `NagFeatureId` here rather than as a string: the enum is the
 * contract, and a new wall belongs in plan-features.ts first.
 *
 * FIRE AND FORGET, ALWAYS. A counter must never block a paywall or fail one.
 * Nothing here throws and nothing is awaited. The response is read now, which
 * it never used to be, and only for one thing: an `event_id` meaning the route
 * just recorded this open as a conversion, which is the cue to report it to
 * Meta and Google from the browser. See `reportToNetworks` for why the server
 * is the one deciding that. A failure to read it costs a tag and nothing else.
 * `keepalive` is the one detail that matters: a CTA click navigates away, to
 * /signup, to /plans, or out to Stripe, and an in-flight fetch on a tearing
 * down document is dropped without it. That would lose exactly the clicks that
 * went on to convert — and, now, every dismissal, which is fired from a
 * handler that is often followed by a navigation of its own.
 */

import { readJournal, readNag } from './upgrade-nag';
import { readPaywallContext } from './paywall-context';
import { googleTrackPaywallView } from './google-ads';
import { metaTrack } from './meta-pixel';
import { PAYWALL_VIEW_META_EVENT } from './paywall-conversion';
import type { NagFeatureId, PlanTierId } from './plan-features';

/**
 * 'checkout_start' is absent on purpose: it is written by the checkout route,
 * server side, off the wall cookie. A browser that has just been redirected to
 * Stripe is the worst possible reporter of the fact that it got there.
 */
export type PaywallCountKind = 'impression' | 'cta_click' | 'dismiss';

export interface PaywallCountTarget {
  /** What the visitor was denied. Must be a live NAG_FEATURES key. */
  feature: NagFeatureId;
  /**
   * Where the wall was met: "explore-topbar", "alerts-page", "support-portal".
   * Free text, capped at 200 characters by the route. Name the place, not the
   * component, because this is read as a list of surfaces on the admin.
   */
  surface: string;
  /** Who was looking. Decides nothing here; it is a column on the report. */
  viewerTier: PlanTierId;
  /**
   * The spot in front of them. Defaults to whatever the page last published to
   * `paywall-context`, so most walls never pass this.
   */
  spotSlug?: string;
  /** How long the wall was open. Only meaningful on 'dismiss'. */
  dwellMs?: number;
  /**
   * Wall-specific extras: which locked day was tapped, which limit was hit.
   * Small scalars only, whitelisted again on the server.
   */
  context?: Record<string, string | number | boolean>;
}

export function reportPaywall(
  kind: PaywallCountKind,
  { feature, surface, viewerTier, spotSlug, dwellMs, context }: PaywallCountTarget,
): void {
  if (typeof window === 'undefined') return;

  // Read here rather than in the caller: every wall wants these and none of
  // them should have to remember. Both are cheap synchronous reads off
  // sessionStorage-backed module state.
  const ambient = readPaywallContext();
  const journal = readJournal();

  void fetch('/api/attribution/paywall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      feature,
      surface,
      viewer_tier: viewerTier,
      spot_slug: spotSlug ?? ambient.spotSlug ?? null,
      engagement: readNag().score,
      journal: journal.length > 0 ? journal : null,
      dwell_ms: typeof dwellMs === 'number' ? Math.round(dwellMs) : null,
      context: mergeContext(ambient, context),
    }),
    keepalive: true,
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => reportToNetworks(body))
    .catch(() => {});
}

/**
 * Tell the ad networks, when the server says this open is owed to one.
 *
 * THE BROWSER DECIDES NOTHING. `event_id` comes back only when the route just
 * wrote a `marketing_conversions` row: the visitor carried a paid touch, there
 * was something stable to count once by, and this was the first wall of the
 * session. Every one of those tests reads cookies the page cannot see, so the
 * alternative to being told would be a second copy of the rules here, drifting
 * against the first and reporting conversions for organic readers the day it
 * did. There is no fallback branch on purpose: no id, no tag.
 *
 * WHY A TAG AT ALL when the row is already uploaded server-side. Neither
 * network is fully reached by that upload. `uploadToMeta` skips every row
 * whose click_type is not `fbclid`, and about half of Meta's own traffic
 * arrives with the id stripped; those opens are real paid conversions that the
 * Conversions API is never told about, and the pixel's `_fbp`/`_fbc` reach
 * them. Google is worse than partial — its leg of conversion-upload.ts cannot
 * send anything from this account at all (src/lib/google-ads.ts), so the tag
 * is not a supplement there, it is the whole channel.
 *
 * Both halves carry the same id, so the overlap is deduplicated rather than
 * doubled: Meta on `eventID`, Google on `transaction_id`. They also have to
 * agree on the NAME, which is why both read it from one constant rather than
 * spelling `InitiateCheckout` twice.
 *
 * Nothing here is awaited and nothing throws. This runs off the response to a
 * counter that fired while a paywall was opening, and a missing pixel, a
 * blocked script or an unparseable body must all end the same way — quietly.
 */
function reportToNetworks(body: unknown): void {
  const eventId =
    body && typeof body === 'object' ? (body as { event_id?: unknown }).event_id : null;
  if (typeof eventId !== 'string' || !eventId) return;

  // No value on either, matching the server: an open is worth nothing until
  // somebody pays, and two halves of one conversion must not disagree about
  // what it was worth.
  metaTrack(PAYWALL_VIEW_META_EVENT, { eventId });
  googleTrackPaywallView(eventId);
}

/**
 * The ambient page context plus whatever this wall added, as one flat bag.
 * The spot slug is left out because it is a column of its own; everything else
 * about where they were standing rides in here.
 */
function mergeContext(
  ambient: ReturnType<typeof readPaywallContext>,
  extra: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> | null {
  const out: Record<string, string | number | boolean> = {};
  if (ambient.citySlug) out.city = ambient.citySlug;
  if (ambient.speciesId) out.species = ambient.speciesId;
  if (ambient.page) out.page = ambient.page;
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== null) out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
