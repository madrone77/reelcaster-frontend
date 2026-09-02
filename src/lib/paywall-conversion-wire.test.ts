/**
 * Run with: npx tsx src/lib/paywall-conversion-wire.test.ts
 *
 * The join between the cookies middleware writes and the conversion row the
 * paywall route builds from them.
 *
 * The failure this guards against is silent in both directions and expensive in
 * both. If the paid touch does not decode, every wall a bought click opens is
 * recorded as organic and reported to nobody, and the campaign reads as though
 * it sent traffic that never engaged. If it decodes but the click id is dropped
 * on the way to the row, the conversion is written, looks healthy in the admin,
 * rests at `skipped`, and Meta is never told — which looks identical to an ad
 * that is not working.
 *
 * So the real cookie writers are used here rather than hand-built strings, and
 * the assertions are on the values the route actually passes to Supabase.
 */

import assert from 'node:assert/strict';
import { NextResponse } from 'next/server';
import {
  PAID_COOKIE,
  PAID_MAX_AGE,
  buildPaid,
  buildEntry,
  ENTRY_COOKIE,
  readEntry,
  readPaid,
} from './attribution';
import { SESSION_COOKIE, serializeSession } from './paywall-session';
import { acquisitionFromRequest } from './conversions';
import { PAYWALL_VIEW_META_EVENT, paywallViewDedupeKey } from './paywall-conversion';
import { readSessionId } from './paywall-session';
import {
  conversionEventId,
  conversionValue,
  metaEventName,
  type ConversionRow,
} from './conversion-upload';

const SESSION = '3a7c9e11-5d22-4b8f-9012-77aa33bb55cc';
const FBCLID = 'IwY2xjawTx2yExampleId';
const LANDING = '/lp/1/victoria-bc';
const SEARCH = `?utm_source=ig&utm_medium=paid&utm_campaign=120247627380030452&fbclid=${FBCLID}`;

/** The jar a browser sends back after middleware has stamped a paid arrival. */
function jarForPaidArrival(): string {
  const paid = buildPaid({ pathname: LANDING, search: SEARCH });
  assert.ok(paid, 'a utm-tagged click with an fbclid must be a paid touch');
  const entry = buildEntry({
    pathname: LANDING,
    search: SEARCH,
    referrer: 'https://l.instagram.com/',
    host: 'www.reelcaster.com',
  });
  assert.ok(entry);

  const res = NextResponse.next();
  res.cookies.set(PAID_COOKIE, JSON.stringify(paid), {
    path: '/',
    sameSite: 'lax',
    secure: true,
    maxAge: PAID_MAX_AGE,
  });
  res.cookies.set(ENTRY_COOKIE, JSON.stringify(entry), { path: '/', sameSite: 'lax' });
  res.cookies.set(
    SESSION_COOKIE,
    serializeSession({ id: SESSION, mintedAt: Date.parse('2026-09-01T17:00:00.000Z') }),
    { path: '/', sameSite: 'lax' },
  );

  // Set-Cookie carries one header per cookie; a browser sends back the
  // name=value pairs joined by "; ".
  const raw = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

const jar = jarForPaidArrival();

// ── What the route reads back ────────────────────────────────────────

const paid = readPaid(jar);
assert.ok(paid, 'the paid touch must survive the round trip, or nothing is reported');
assert.equal(readSessionId(jar), SESSION);

const dedupeKey = paywallViewDedupeKey({
  sessionId: readSessionId(jar),
  clickId: paid.click_id || null,
  day: '2026-09-01',
});
assert.equal(dedupeKey, `pv:s:${SESSION}`);

// ── The row it builds ────────────────────────────────────────────────

const headers = new Headers({
  cookie: jar,
  'user-agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'x-vercel-ip-country': 'CA',
  'x-vercel-ip-country-region': 'BC',
  'x-vercel-ip-city': 'Victoria',
});

const acq = acquisitionFromRequest({
  headers,
  entry: readEntry(jar),
  paid,
  paywallFeature: 'catch-reports',
  paywallSurface: 'explore-forecast',
});

// The click id is the whole point: without it the row is unuploadable and Meta
// never hears about the campaign it belongs to.
assert.equal(acq.click_id, FBCLID);
assert.equal(acq.click_type, 'fbclid');

// The PAID touch wins, and says so. A first-touch fallback here would credit
// today's wall to whatever brought them the first time.
assert.equal(acq.attribution_model, 'paid');
assert.equal(acq.utm_source, 'ig');
assert.equal(acq.utm_campaign, '120247627380030452');
assert.equal(acq.landing_path, LANDING);

// click_at is the CLICK, not now. Meta builds fbc from it and a wrong timestamp
// matches nothing while still returning 200.
assert.ok(acq.click_at, 'a paid touch must carry the click time');
assert.equal(acq.click_at, paid.ts);

// The device is where the wall was shown, read from the request rather than
// accepted from a body.
assert.equal(acq.device, 'mobile');
assert.equal(acq.geo_city, 'Victoria');
assert.equal(acq.geo_region, 'BC');

// The wall that earned it, in the same vocabulary paywall_events uses, so the
// two halves of a rate can be filtered the same way.
assert.equal(acq.paywall_feature, 'catch-reports');
assert.equal(acq.paywall_surface, 'explore-forecast');

// Nothing was bought, so nothing paid for it.
assert.equal(acq.pay_method, null);

// ── The organic visitor, who must NOT be reported ────────────────────

const organicRes = NextResponse.next();
organicRes.cookies.set(
  ENTRY_COOKIE,
  JSON.stringify(
    buildEntry({
      pathname: '/fishing/bc/victoria-bc',
      search: '',
      referrer: 'https://www.google.com/',
      host: 'www.reelcaster.com',
    })!,
  ),
  { path: '/', sameSite: 'lax' },
);
const organicRaw =
  organicRes.headers.getSetCookie?.() ?? [organicRes.headers.get('set-cookie') ?? ''];
const organicJar = organicRaw.map((c) => c.split(';')[0]).join('; ');

// The route's whole gate: no rc_paid, no conversion. A search visitor opening
// the same wall must not become a conversion any ad network can claim.
assert.equal(readPaid(organicJar), null);

// ── The browser tags and the upload must name the same event ─────────

/**
 * The id the route hands back is the id the Conversions API will send for the
 * same open, and this is the assertion that keeps them one number.
 *
 * Both halves of this event can fire for one visit: the pixel reports every
 * paid wall open, the upload reports the ones carrying an fbclid, and this
 * visitor has one. Meta deduplicates them on `eventID` matching `event_id`,
 * Google on `transaction_id`. If the two ever key on different strings nothing
 * errors and nothing looks wrong — the count simply doubles, and the bid is
 * placed on twice the truth.
 */
assert.ok(dedupeKey, 'a session cookie must produce a key');

// What the upload will put in Meta's `event_id`, off the row the route wrote.
assert.equal(
  conversionEventId({
    event_type: 'paywall_view',
    dedupe_key: dedupeKey,
    stripe_subscription_id: null,
    user_id: null,
  } as ConversionRow),
  dedupeKey,
  'the upload must key a paywall view on the same string the route returns',
);

// And the event name, which has to match on both sides too: a pixel firing
// under one name and an upload under another is two events, not one
// deduplicated event, however well the ids line up.
assert.equal(metaEventName('paywall_view'), PAYWALL_VIEW_META_EVENT);

// A wall open is worth nothing on either side. A value on one half and not the
// other is the other way two deduplicated events can disagree.
assert.equal(
  conversionValue({
    event_type: 'paywall_view',
    value_cents: 0,
    modeled_value_cents: 0,
    currency: 'cad',
  } as ConversionRow),
  null,
);

console.log('paywall-conversion-wire: ok');
