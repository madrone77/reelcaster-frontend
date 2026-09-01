/**
 * Run with: npx tsx src/lib/paywall-event.test.ts
 *
 * This is the half of a paywall row that a visitor is NOT allowed to write,
 * and the tests are about exactly that boundary: campaign, device, geo and
 * session all have to come off the request, and the paid touch has to beat the
 * first touch, because every conversion rate this table is divided into
 * depends on the denominator being filtered by the same campaign the numerator
 * was.
 */

import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { paywallEventRow } from './paywall-event';
import { ENTRY_COOKIE, PAID_COOKIE } from './attribution';
import { SESSION_COOKIE } from './paywall-session';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Enough of a NextRequest for the row builder, which only reads headers. */
function request(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

function cookies(jar: Record<string, unknown>): string {
  return Object.entries(jar)
    .map(([k, v]) =>
      `${k}=${encodeURIComponent(typeof v === 'string' ? v : JSON.stringify(v))}`,
    )
    .join('; ');
}

const ENTRY = {
  utm_source: 'google',
  utm_medium: 'organic',
  utm_campaign: '',
  utm_content: '',
  utm_term: '',
  click_id: '',
  click_type: '',
  params: {},
  entry_path: '/fishing/bc/victoria-bc',
  referrer: 'https://www.google.com/',
  raw_query: '',
  ts: '2026-08-01T00:00:00.000Z',
};

const PAID = {
  utm_source: 'meta',
  utm_medium: 'paid_social',
  utm_campaign: '120247719351170452',
  utm_content: 'reel-a',
  utm_term: '',
  click_id: 'FBCLID_VALUE',
  click_type: 'fbclid',
  params: { city: 'seattle' },
  landing_path: '/lp/1/seattle',
  ts: '2026-09-01T00:00:00.000Z',
};

// ── The visit is read from the request, not from any body ─────────────
{
  const row = paywallEventRow(
    request({
      'user-agent': IPHONE,
      'x-vercel-ip-country': 'US',
      'x-vercel-ip-country-region': 'WA',
      'x-vercel-ip-city': 'Seattle',
      cookie: cookies({
        [ENTRY_COOKIE]: ENTRY,
        [PAID_COOKIE]: PAID,
        [SESSION_COOKIE]: `abc12345.${Date.now()}`,
      }),
    }),
    {
      kind: 'impression',
      feature: 'forecast-14d',
      surface: 'explore-topbar',
      viewerTier: 'anon',
      spotSlug: 'oak-bay-flats',
    },
  );

  assert.equal(row.device, 'mobile');
  assert.equal(row.os, 'ios');
  assert.equal(row.geo_country, 'US');
  assert.equal(row.geo_region, 'WA');
  assert.equal(row.geo_city, 'Seattle');
  assert.equal(row.session_id, 'abc12345');
  assert.equal(row.spot_slug, 'oak-bay-flats');

  // The paid touch wins over first touch, and says so.
  assert.equal(row.attribution_model, 'paid');
  assert.equal(row.utm_source, 'meta');
  assert.equal(row.utm_campaign, '120247719351170452');
  assert.equal(row.click_type, 'fbclid');
  assert.equal(row.landing_path, '/lp/1/seattle');

  // First touch still contributes the page the relationship started on.
  assert.equal(row.entry_path, '/fishing/bc/victoria-bc');

  // The click id is a network identifier for a person and has no business in
  // an impression row. If this ever starts passing something, it is a leak.
  assert.ok(!('click_id' in row), 'no click id on a paywall event');
}

// ── Organic: first touch is the fallback, and is labelled as such ──────
{
  const row = paywallEventRow(
    request({ 'user-agent': IPHONE, cookie: cookies({ [ENTRY_COOKIE]: ENTRY }) }),
    { kind: 'impression', feature: 'alerts', surface: 'spot-page', viewerTier: 'free' },
  );
  assert.equal(row.attribution_model, 'first');
  assert.equal(row.utm_source, 'google');
  assert.equal(row.landing_path, null, 'no paid landing on an organic visit');
}

// ── Nothing known at all ──────────────────────────────────────────────
{
  const row = paywallEventRow(request({}), {
    kind: 'impression',
    feature: 'alerts',
    surface: '',
    viewerTier: 'anon',
  });
  assert.equal(row.attribution_model, null);
  assert.equal(row.session_id, null, 'a cookie-blocked browser has no session');
  assert.equal(row.device, null, 'unknown stays unknown rather than becoming desktop');
  assert.equal(row.surface, 'unknown', 'an empty surface is named, not blank');
  assert.equal(row.split_tests, null, 'no running test is null, not {}');
}

// ── dwell_ms belongs to dismissals only ───────────────────────────────
{
  const clicked = paywallEventRow(request({}), {
    kind: 'cta_click',
    feature: 'alerts',
    surface: 'spot-page',
    viewerTier: 'anon',
    dwellMs: 4000,
  });
  assert.equal(clicked.dwell_ms, null, 'time-to-click is not dwell and is dropped');

  const dismissed = paywallEventRow(request({}), {
    kind: 'dismiss',
    feature: 'alerts',
    surface: 'spot-page',
    viewerTier: 'anon',
    dwellMs: 4000,
  });
  assert.equal(dismissed.dwell_ms, 4000);
}

console.log('paywall-event: ok');
