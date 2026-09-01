/**
 * One row for `paywall_events`, assembled from the request.
 *
 * Two callers, and they have nothing else in common, which is exactly why this
 * is a module rather than a private function in either of them:
 *
 *   POST /api/attribution/paywall   impressions, CTA clicks and dismissals,
 *                                   reported by the wall itself.
 *   POST /api/stripe/checkout       'checkout_start', recorded where the
 *                                   Stripe session is actually created.
 *
 * The second is the reason the split matters. Everything up to the CTA click
 * is reported by a browser that is about to navigate, and the step after it —
 * did a checkout session actually open — is the one step a browser is worst
 * placed to report, because by then it is on Stripe's domain. So it is
 * recorded by the route that does the work, off the same wall cookie the
 * subscription metadata is built from. A wall's funnel is then shown, seen to
 * clicked to checkout to paid, without a single number in it depending on a
 * beacon surviving a redirect.
 *
 * EVERY FIELD HERE IS READ FROM THE REQUEST, never from a body. See the long
 * argument in the route.
 */

import type { NextRequest } from 'next/server';
import { readEntry, readPaid } from './attribution';
import { readSessionId } from './paywall-session';
import { classifyUserAgent } from './device';
import { readEdgeGeo } from './edge-geo';
import { armsFromCookieHeader } from './split-tests';
import { pacificDay } from './pacific-day';

export type PaywallEventKind = 'impression' | 'cta_click' | 'dismiss' | 'checkout_start';

/** The half of a row that describes the wall rather than the visit. */
export interface PaywallEventFields {
  kind: PaywallEventKind;
  feature: string;
  surface: string;
  viewerTier: string;
  spotSlug?: string | null;
  engagement?: number | null;
  journal?: unknown;
  dwellMs?: number | null;
  context?: Record<string, string | number | boolean> | null;
}

export function paywallEventRow(
  request: NextRequest,
  fields: PaywallEventFields,
): Record<string, unknown> {
  const cookieHeader = request.headers.get('cookie') ?? '';

  // The paid touch wins when there is one, because that is the click somebody
  // was paid for and the one an ad report has to be able to find. First touch
  // is the fallback so organic campaign tags still land somewhere.
  // `attribution_model` records which of the two it was, exactly as the
  // checkout route's `acq_model` does, so the two tables can be filtered the
  // same way and divided by each other.
  const paid = readPaid(cookieHeader);
  const entry = readEntry(cookieHeader);
  const touch = paid ?? entry;

  const ua = classifyUserAgent(request.headers.get('user-agent'));
  const geo = readEdgeGeo(request.headers);
  const arms = armsFromCookieHeader(cookieHeader);

  return {
    day: pacificDay(),
    kind: fields.kind,
    feature: fields.feature,
    surface: fields.surface || 'unknown',
    viewer_tier: fields.viewerTier,

    spot_slug: fields.spotSlug ?? null,
    engagement: fields.engagement ?? null,
    journal: fields.journal ?? null,
    // Only a dismissal has a dwell worth the column: on every other kind the
    // number would be the time until they acted, which is a different quantity
    // wearing the same name.
    dwell_ms: fields.kind === 'dismiss' ? (fields.dwellMs ?? null) : null,
    context: fields.context ?? null,

    session_id: readSessionId(cookieHeader),

    attribution_model: touch ? (paid ? 'paid' : 'first') : null,
    click_type: touch?.click_type || null,
    utm_source: touch?.utm_source || null,
    utm_medium: touch?.utm_medium || null,
    utm_campaign: touch?.utm_campaign || null,
    utm_content: touch?.utm_content || null,
    utm_term: touch?.utm_term || null,
    landing_path: paid?.landing_path || null,
    entry_path: entry?.entry_path || null,

    device: ua.device === 'unknown' ? null : ua.device,
    os: ua.os === 'unknown' ? null : ua.os,
    geo_country: geo.country,
    geo_region: geo.region,
    geo_city: geo.city,

    // Null rather than `{}` when no test is running, which is most of the
    // time: an empty object in every row reads as "arms were recorded and were
    // empty" and makes `where split_tests is null` useless.
    split_tests: Object.keys(arms).length > 0 ? arms : null,
  };
}
