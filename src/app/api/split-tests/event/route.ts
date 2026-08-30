/**
 * POST /api/split-tests/event → { ok: true }
 *
 * The denominator. Without it a split test can say which arm bought and not
 * how many people each arm was offered to, which is a numerator with nothing
 * under it: arm B selling four subscriptions is a triumph or a disaster
 * depending on whether it was shown to forty people or four thousand.
 *
 * Rolls up into `split_test_events_daily` at day grain, and like the campaign
 * counter next door this is NOT an event log: no visitor id, no user id, no
 * path, no timestamp finer than the date.
 *
 * THE CLIENT DESCRIBES THE TEST, THE SERVER DESCRIBES THE VISITOR. The body
 * carries the arm, the surface and the currency being quoted, all of which the
 * page already knows and none of which identifies anybody. Location and device
 * come from request headers and are never accepted from the body, because a
 * value the client can set is a value the client can fake, and a device split
 * is only worth reading if it is real.
 *
 * Unauthenticated by design: the visitors worth counting are signed out. The
 * cost is that anyone can inflate a counter, so the arm is validated against
 * the live registry and the worst case is a wrong number on an internal
 * dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyUserAgent, isBotUserAgent } from '@/lib/device';
import { readEdgeGeo } from '@/lib/edge-geo';
import { loadSplitTests } from '@/lib/split-tests-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const KINDS = new Set(['exposure', 'cta_click']);

/**
 * Where the arm was seen. A shape rather than a list, for the same reason the
 * campaign counter validates landing keys by shape: a surface that ships on
 * Friday should be in Monday's report without anyone remembering this file
 * exists. Anchored and capped, so an inflated counter is the worst outcome.
 */
const SURFACE_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

const CURRENCIES = new Set(['cad', 'usd', '']);

interface EventBody {
  kind?: string;
  test?: string;
  variant?: string;
  surface?: string;
  currency?: string;
}

export async function POST(request: NextRequest) {
  const ua = request.headers.get('user-agent');
  // Self-declaring bots are dropped before they are counted. A crawler that
  // renders a page is not somebody deciding whether to buy.
  if (isBotUserAgent(ua)) return NextResponse.json({ ok: true });

  let body: EventBody;
  try {
    body = (await request.json()) as EventBody;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const kind = (body.kind ?? '').trim();
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  const testKey = (body.test ?? '').trim();
  const variant = (body.variant ?? '').trim();

  // Validated against the live registry rather than a shape, because unlike a
  // landing-page key this one is a foreign key in every report that joins
  // exposures to conversions. A counter for an arm that does not exist is not
  // a harmless extra row; it is a row that shows up as a mystery arm on the
  // dashboard and takes someone an afternoon to trace back to a stale tab.
  const tests = await loadSplitTests();
  const test = tests.find((t) => t.key === testKey);
  if (!test || !test.variants.some((v) => v.variant === variant)) {
    return NextResponse.json({ error: 'unknown_arm' }, { status: 400 });
  }

  const surface = (body.surface ?? '').trim().toLowerCase();
  if (surface && !SURFACE_RE.test(surface)) {
    return NextResponse.json({ error: 'invalid_surface' }, { status: 400 });
  }

  const currency = (body.currency ?? '').trim().toLowerCase();
  if (!CURRENCIES.has(currency)) {
    return NextResponse.json({ error: 'invalid_currency' }, { status: 400 });
  }

  const device = classifyUserAgent(ua);
  const geo = readEdgeGeo(request.headers);

  const { error } = await admin.rpc('bump_split_test_counter', {
    p_day: new Date().toISOString().slice(0, 10),
    p_test_key: testKey,
    p_variant: variant,
    p_surface: surface,
    p_currency: currency,
    p_geo_country: geo.country ?? '',
    p_geo_region: geo.region ?? '',
    p_device: device.device === 'unknown' ? '' : device.device,
    p_kind: kind,
  });

  if (error) {
    console.warn('[split-tests] counter bump failed', error);
    // Still 200. A failed count must never be visible to someone trying to
    // buy something, and the caller fires this with sendBeacon anyway.
  }

  return NextResponse.json({ ok: true });
}
