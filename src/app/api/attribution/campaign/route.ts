/**
 * POST /api/attribution/campaign  → { ok: true }
 *
 * The denominator the paid-campaign report is built on. Conversions were
 * already recorded (marketing_conversions) and spend has a home
 * (marketing_ad_spend), but the two steps in between, "someone arrived" and
 * "someone reached for the button", happened inside our own site and were
 * counted nowhere. Without them a landing page that nobody visits and a
 * landing page that everybody bounces off are the same empty row.
 *
 * Rolls up into `campaign_events_daily` at day grain. Like
 * /api/attribution/paywall, this is NOT an event log: no visitor id, no user
 * id, no path, no timestamp finer than the date. Counting is the whole job.
 *
 * THE CLIENT DESCRIBES THE CAMPAIGN, THE SERVER DESCRIBES THE VISITOR. The
 * body carries only what is already public in the URL the visitor was sent:
 * which landing page, which pitch, which city, which UTM tags, which network
 * stamped the click. Location and device come from request headers here and
 * are never accepted from the body, because a value the client can set is a
 * value the client can fake, and the whole report is only worth reading if the
 * device split is real.
 *
 * Unauthenticated by design: every visitor worth counting is signed out.
 * The cost is that anyone can inflate a counter, so every field is validated
 * against a real vocabulary and the worst case is a wrong number on an
 * internal dashboard rather than a write amplification.
 *
 * The click id is deliberately NOT accepted, only its type. An id identifies
 * one person; storing it here would turn a counter into the event log this is
 * built not to be. Attribution keeps it, in a cookie, where it is disclosed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ANGLES } from '@/app/lp/_shared/lp-angles';
import { AD_WALLS } from '@/app/explore/spot/[slug]/ad-mode';
import { CLICK_TYPES } from '@/lib/attribution';
import { classifyUserAgent, isBotUserAgent } from '@/lib/device';
import { readEdgeGeo } from '@/lib/edge-geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const KINDS = new Set(['hit', 'cta_click']);

/**
 * Where on the page the button was. Position rather than label, because the
 * label is exactly what the angles vary and folding them together is what
 * makes "does the hero work" a question with an answer.
 */
const CTAS = new Set(['hero', 'final', 'sticky', 'nav', 'secondary']);

/** Angle ids, read from the live list so a new pitch counts without an edit. */
const ANGLE_IDS = new Set(ANGLES.map((a) => a.id));

const CLICK_TYPE_SET = new Set<string>(CLICK_TYPES);

/**
 * Landing pages are `lp1`, `lp2`, ... A shape test rather than a list, for the
 * same reason the paywall route validates against the live enum: a variant
 * that ships on Friday should be in Monday's report without anyone
 * remembering this file exists.
 *
 * `spot` is the other kind: the product's own spot page in an ad frame
 * (/explore/spot/<slug>?ad=…). One key for all of them rather than one per
 * spot, because WHICH spot is a column of its own — see `target_spot`. Folding
 * it into the landing key instead would make every spot look like a separate
 * landing page in a report whose whole top-level question is which KIND of
 * page works.
 */
const LANDING_SHAPE = /^(lp[0-9]{1,2}|spot)$/;

/** Which paywall the ad frame was running. Read from the live list. */
const WALL_SET = new Set<string>(AD_WALLS);

/** City slugs are lowercase kebab, e.g. "victoria-bc". */
const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Cap on a free-text dimension. UTM values are tags, not prose. */
const MAX_TAG = 80;

function tag(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .slice(0, MAX_TAG);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const kind = String(body.kind ?? '');
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  const landing = tag(body.landing);
  if (!LANDING_SHAPE.test(landing)) {
    return NextResponse.json({ error: 'invalid_landing' }, { status: 400 });
  }

  // A click has to say which button, and a hit has to say no button at all.
  // Letting a hit carry one would put the same visit in two buckets and make
  // the CTR read against a denominator it does not belong to.
  const cta = tag(body.cta);
  if (kind === 'cta_click' && !CTAS.has(cta)) {
    return NextResponse.json({ error: 'invalid_cta' }, { status: 400 });
  }

  // Everything below is best-effort: an unrecognised value becomes empty
  // rather than a 400, because losing a real hit to a stale vocabulary is
  // worse than filing it under a blank dimension.
  const angleRaw = tag(body.angle);
  const angle = ANGLE_IDS.has(angleRaw) ? angleRaw : '';

  const cityRaw = tag(body.target_city);
  const targetCity = SLUG_SHAPE.test(cityRaw) ? cityRaw : '';

  // Spot slugs are the same lowercase-kebab shape as city slugs, with a short
  // hex suffix ("constance-bank-7615cc"). Only ad-framed spot pages send one.
  const spotRaw = tag(body.target_spot);
  const targetSpot = SLUG_SHAPE.test(spotRaw) ? spotRaw : '';

  const wallRaw = tag(body.wall);
  const wall = WALL_SET.has(wallRaw) ? wallRaw : '';

  const clickTypeRaw = tag(body.click_type);
  const clickType = CLICK_TYPE_SET.has(clickTypeRaw) ? clickTypeRaw : '';

  // ── The half the client does not get a say in ──────────────────────────
  const userAgent = request.headers.get('user-agent');

  // Self-declaring bots are dropped rather than counted. They can never press
  // a button, so counting them deflates every CTR on the page, and unevenly:
  // whichever variant happens to get crawled more looks like the one nobody
  // clicks. 200 rather than an error, because there is nothing for the caller
  // to do about it.
  if (isBotUserAgent(userAgent)) {
    return NextResponse.json({ ok: true, counted: false });
  }

  const { device, os } = classifyUserAgent(userAgent);
  const geo = readEdgeGeo(request.headers);

  const { error } = await admin.rpc('bump_campaign_counter', {
    p_day: new Date().toISOString().slice(0, 10),
    p_landing: landing,
    p_angle: angle,
    p_target_city: targetCity,
    p_utm_source: tag(body.utm_source),
    p_utm_medium: tag(body.utm_medium),
    p_utm_campaign: tag(body.utm_campaign),
    p_click_type: clickType,
    p_geo_country: geo.country ?? '',
    p_geo_region: geo.region ?? '',
    p_geo_city: geo.city ?? '',
    p_device: device,
    p_os: os,
    p_cta: kind === 'cta_click' ? cta : '',
    p_kind: kind,
    p_target_spot: targetSpot,
    p_wall: wall,
  });

  if (error) {
    // Logged, not surfaced. A dropped count is never worth a visible failure
    // on a page someone is trying to buy from.
    console.error('[attribution] campaign counter failed', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true, counted: true });
}
