/**
 * POST /api/attribution/signup
 *   → { ok: true, written: boolean, offer_claimed: boolean, geo_written: boolean }
 *
 * Stamps "which wall earned this account, and how did they find us" onto
 * `user_settings`, reading the rc_wall / rc_entry cookies off the request.
 * Also records an offer claim from rc_offer (src/lib/offers.ts) — same
 * placement, same cookies-across-the-boundary problem, different lifetime
 * rules, which are argued at the write itself below.
 *
 * Called when a user becomes authenticated for the first time in a browser,
 * NOT from the signup form's success branch. Two reasons:
 *
 *   1. When email confirmation is on, `signUp()` returns no session, so the
 *      form has no token to write with. The account arrives minutes later,
 *      from a link, on a page that never saw the form.
 *   2. OAuth and magic-link signups never touch the form at all.
 *
 * The cost of that placement is that this also fires when an EXISTING user
 * signs in on a new browser, and their cookies would happily claim credit for
 * a signup that happened months ago. Two guards stop that: the write is
 * skipped unless `attr_signup_at` is null (write-once) and the account itself
 * is younger than ACCOUNT_AGE_GRACE. Backfilling attribution onto old accounts
 * is worse than having none, because it looks like data.
 *
 * This route also stamps the account's coarse LOCATION (`geo_*`), which plays
 * by different rules and is written separately below — see writeGeo().
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  CLICK_TYPES,
  EXTRA_PARAMS,
  readEntry,
  readPaid,
  readWall,
  type CampaignParams,
} from '@/lib/attribution';
import { readOffer } from '@/lib/offers';
import { NAG_FEATURES } from '@/lib/plan-features';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * How new an account has to be for its cookies to be believed. Generous
 * enough to cover a confirmation email left unopened overnight, short enough
 * that a returning user signing in on a new laptop is never mistaken for a
 * fresh conversion.
 */
const ACCOUNT_AGE_GRACE_MS = 1000 * 60 * 60 * 24 * 2; // 2 days

/**
 * Everything below re-checks a cookie the client could have written by hand.
 *
 * The existing `feature` check does this because the dashboard groups on that
 * column; the same argument applies to every column added here, and more so to
 * the jsonb bags, where an unchecked write means arbitrary keys of arbitrary
 * size land in the row.
 */

/** Only a click type we know how to upload against is worth recording. */
function clickType(c: CampaignParams): string | null {
  return (CLICK_TYPES as readonly string[]).includes(c.click_type) ? c.click_type : null;
}

/**
 * A click id is only meaningful next to a type that says which network issued
 * it, so an id with an unrecognised type is dropped rather than stored as a
 * value nothing can ever resolve.
 */
function clickId(c: CampaignParams): string | null {
  if (!clickType(c)) return null;
  return c.click_id ? c.click_id.slice(0, MAX_VALUE) : null;
}

/** Whitelist keys, clamp values, and store null rather than an empty object. */
function extraParams(c: CampaignParams): Record<string, string> | null {
  const raw = c.params;
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, string> = {};
  for (const key of EXTRA_PARAMS) {
    const value = raw[key];
    if (typeof value === 'string' && value) out[key] = value.slice(0, MAX_VALUE);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Matches MAX_FIELD in src/lib/cookies.ts; re-applied because the cookie lied. */
const MAX_VALUE = 200;

/**
 * The account's location, as Vercel's edge resolved it from the connecting
 * address before any of our code ran.
 *
 * THE IP ITSELF IS NEVER READ OR STORED. These headers are already a coarse
 * place — country, subdivision, nearest city, and the city's centroid — so
 * nothing here can be turned back into an address, and no geo-IP vendor is in
 * the path. Absent outside production (localhost, `next build`), which is why
 * every field is optional and a missing fix simply writes nothing.
 */
interface EdgeGeo {
  country: string | null;
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

/** Header values are percent-encoded ("Port%20Angeles") and can be blank. */
function geoHeader(request: NextRequest, name: string): string | null {
  const raw = request.headers.get(name);
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // A malformed escape is not worth dropping the whole fix over.
  }
  value = value.trim();
  return value ? value.slice(0, MAX_VALUE) : null;
}

/**
 * A blank header is not a coordinate: `Number('')` is 0, which reads as a
 * perfectly valid fix at 0N 0E in the Gulf of Guinea. The explore opening-city
 * snap shipped that bug once already; both halves are checked non-empty here
 * before Number sees them.
 */
function geoCoord(request: NextRequest, name: string): number | null {
  const raw = request.headers.get(name)?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readGeo(request: NextRequest): EdgeGeo | null {
  const geo: EdgeGeo = {
    country: geoHeader(request, 'x-vercel-ip-country'),
    region: geoHeader(request, 'x-vercel-ip-country-region'),
    city: geoHeader(request, 'x-vercel-ip-city'),
    lat: geoCoord(request, 'x-vercel-ip-latitude'),
    lng: geoCoord(request, 'x-vercel-ip-longitude'),
  };
  // A fix with no country and no coordinates says nothing worth a write.
  return geo.country || (geo.lat !== null && geo.lng !== null) ? geo : null;
}

/**
 * Stamp the location, write-once, and deliberately NOT behind the account-age
 * guard that protects attr_*.
 *
 * The two answer different questions. Attribution says "what earned this
 * signup", so believing a months-old account's cookies would be fiction.
 * Location says "where is this account", which is true whenever we first see
 * it — so an account that predates these columns fills in on its owner's next
 * sign-in rather than staying blank forever. `geo_captured_at` records which
 * of the two happened; read it against `created_at` before calling a location
 * an origin.
 *
 * Failure is logged and swallowed: a location is a nice-to-have, and failing
 * the request over it would cost the attribution write that follows.
 */
async function writeGeo(userId: string, geo: EdgeGeo): Promise<boolean> {
  const { data, error } = await admin
    .from('user_settings')
    .update({
      geo_country: geo.country,
      geo_region: geo.region,
      geo_city: geo.city,
      geo_lat: geo.lat,
      geo_lng: geo.lng,
      geo_captured_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .is('geo_captured_at', null)
    .select('user_id');

  if (error) {
    console.error('[attribution] geo write failed', error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cookieHeader = request.headers.get('cookie') ?? '';
  const wall = readWall(cookieHeader);
  const entry = readEntry(cookieHeader);
  const paid = readPaid(cookieHeader);
  const offer = readOffer(cookieHeader);

  // Location rides on the request, not on a cookie, so it survives the cases
  // that leave us with no attribution at all — a browser blocking storage, an
  // in-app browser that dropped the referrer. Those visitors are precisely the
  // ones the roster otherwise cannot place at all.
  const geo = readGeo(request);

  if (!wall && !entry && !paid && !offer && !geo) {
    return NextResponse.json({ ok: true, written: false, reason: 'no_attribution' });
  }

  // The row may not exist yet for an account created seconds ago. DO NOTHING
  // on conflict so this can never blank a column the webhook already wrote.
  const { error: ensureError } = await admin
    .from('user_settings')
    .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });

  if (ensureError) {
    console.error('[attribution] could not ensure user_settings row', ensureError);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  // Before every guard below, because none of them apply to a location.
  const geoWritten = geo ? await writeGeo(user.id, geo) : false;

  // Offer claims are recorded BEFORE the account-age guard, and survive it.
  //
  // Attribution answers "what earned this signup", so believing a months-old
  // account's cookies would be fiction. A claim answers "this person is asking
  // for the deal", and an existing free user who follows an offer link is
  // asking for it just as much as a new one. Dropping them would strand them:
  // they'd sit in a free account waiting on an approval that never appears in
  // anyone's queue.
  //
  // `.is('offer_code_at', null)` is the write-once guard — the first claim
  // wins, so a second offer link cannot rewrite the one an admin is looking at.
  let offerClaimed = false;
  if (offer) {
    const { data: claimed, error: offerError } = await admin
      .from('user_settings')
      .update({ offer_code: offer, offer_code_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('offer_code_at', null)
      .select('user_id');

    if (offerError) {
      console.error('[attribution] offer claim write failed', offerError);
    } else {
      offerClaimed = (claimed?.length ?? 0) > 0;
    }
  }

  const accountAge = Date.now() - new Date(user.created_at).getTime();
  if (accountAge > ACCOUNT_AGE_GRACE_MS) {
    return NextResponse.json({
      ok: true,
      written: false,
      offer_claimed: offerClaimed,
      geo_written: geoWritten,
      reason: 'account_too_old',
    });
  }

  if (!wall && !entry && !paid) {
    return NextResponse.json({
      ok: true,
      written: false,
      offer_claimed: offerClaimed,
      geo_written: geoWritten,
      reason: 'no_attribution',
    });
  }

  // A cookie is client-writable, so the feature is checked against the enum
  // here too rather than trusted into a column the dashboard groups by.
  const feature = wall && wall.feature in NAG_FEATURES ? wall.feature : null;

  const patch: Record<string, unknown> = {
    attr_signup_at: new Date().toISOString(),
  };
  if (feature) {
    patch.attr_signup_feature = feature;
    patch.attr_signup_from = wall?.from || null;
  }
  if (entry) {
    patch.attr_entry_path = entry.entry_path || null;
    patch.attr_referrer = entry.referrer || null;
    patch.attr_utm_source = entry.utm_source || null;
    patch.attr_utm_medium = entry.utm_medium || null;
    patch.attr_utm_campaign = entry.utm_campaign || null;
    patch.attr_utm_content = entry.utm_content || null;
    patch.attr_utm_term = entry.utm_term || null;
    patch.attr_click_id = clickId(entry);
    patch.attr_click_type = clickType(entry);
    patch.attr_params = extraParams(entry);
    patch.attr_raw_query = entry.raw_query || null;
  }
  if (paid) {
    patch.paid_utm_source = paid.utm_source || null;
    patch.paid_utm_medium = paid.utm_medium || null;
    patch.paid_utm_campaign = paid.utm_campaign || null;
    patch.paid_utm_content = paid.utm_content || null;
    patch.paid_utm_term = paid.utm_term || null;
    patch.paid_click_id = clickId(paid);
    patch.paid_click_type = clickType(paid);
    patch.paid_params = extraParams(paid);
    patch.paid_landing_path = paid.landing_path || null;
    patch.paid_at = paid.ts || null;
  }

  // `.is('attr_signup_at', null)` is the write-once guard. Re-posting is a
  // no-op, which is what makes the client side safe to fire on every mount.
  const { data, error } = await admin
    .from('user_settings')
    .update(patch)
    .eq('user_id', user.id)
    .is('attr_signup_at', null)
    .select('user_id');

  if (error) {
    console.error('[attribution] signup write failed', error);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    written: (data?.length ?? 0) > 0,
    offer_claimed: offerClaimed,
    geo_written: geoWritten,
  });
}
