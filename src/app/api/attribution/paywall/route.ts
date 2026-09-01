/**
 * POST /api/attribution/paywall  → { ok: true }
 *
 * Every paywall in the app reports here, and the report lands in two places.
 *
 * `paywall_impressions` is the original day-grain counter and is unchanged:
 * one row per day x feature x surface x viewer tier holding two integers, no
 * visitor id, no timestamp finer than the date. It is the denominator for the
 * conversion panels in bluecaster /admin/reelcaster/analytics and the whole of
 * /admin/reelcaster/paywalls, it has history back to 2026-08-13, and nothing
 * here is allowed to change its meaning. Only 'impression' and 'cta_click'
 * reach it, because two integer columns is all it has.
 *
 * `paywall_events` is the log added alongside it: one row per event, carrying
 * the campaign, device, region and session the request itself reveals. It
 * exists because the counter can answer "how often was this wall seen" and can
 * never answer "of the people a Meta ad sent to this wall, how many bought" —
 * the numerator has had campaign, device and city on it for weeks
 * (marketing_conversions) and the denominator had nothing to divide by.
 *
 * SERVER-DERIVED, NOT CLIENT-REPORTED. The body describes the WALL: which
 * feature, which surface, which tier, which spot, what the reader had been
 * doing. Everything describing the VISIT — campaign, click type, device, os,
 * country, region, city, session id, price arm — is read here off the
 * request's own headers and cookies and is never accepted from the body. The
 * headers are already on the request and a visitor cannot edit them; a body
 * field saying "I am an iPhone in Seattle from campaign X" would be a lie
 * surface bought for nothing.
 *
 * NO IP, AND NO CLICK ID IN `paywall_events`. The edge resolves the address to
 * a city before this code runs and only the city is kept. gclid and fbclid stay
 * out of the event log entirely: they are network-issued identifiers for a
 * person, and the log is read by dashboards that have no business holding one.
 *
 * THAT LAST RULE USED TO END "and an impression has nothing to upload". It does
 * now. A paid visitor opening the paywall is reported back to the network that
 * sold the click, once per session, as a fourth `marketing_conversions` event —
 * because trials and signups are both too rare for Meta's bidding to learn from
 * and this one is not. The click id lives on THAT row, in the table that has
 * always carried them and is the only thing the offline upload can work with.
 * The event log itself is unchanged. See src/lib/paywall-conversion.ts for why
 * an event this far from money is worth reporting, and what it costs.
 *
 * UNAUTHENTICATED BY DESIGN — most walls are shown to signed-out visitors, who
 * are exactly the ones we most want to count. The cost of that is that anyone
 * can post to it, so the feature and tier are validated against the real
 * enums, every client field is clamped or dropped, and the worst case is a
 * wrong number on an internal dashboard rather than a write amplification.
 *
 * NO USER ID IS RESOLVED HERE, deliberately. Verifying a bearer token means a
 * round trip to Supabase auth on a path that fires on every wall open, and the
 * caller is often a component about to navigate. `viewer_tier` already says
 * whether they were signed in, and the exact per-account link is made where it
 * belongs: the signup route and the Stripe checkout both read the rc_wall
 * cookie and stamp the wall onto the conversion row.
 *
 * Fire-and-forget from the client. It must never block or break a paywall,
 * which is why every failure below is logged and answered 200.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { NAG_FEATURES } from '@/lib/plan-features';
import { pacificDay } from '@/lib/pacific-day';
import { paywallEventRow } from '@/lib/paywall-event';
import { readPaid, readEntry } from '@/lib/attribution';
import { readSessionId } from '@/lib/paywall-session';
import { acquisitionFromRequest, recordPaywallViewConversion } from '@/lib/conversions';
import { paywallViewDedupeKey } from '@/lib/paywall-conversion';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * 'dismiss' is new and only ever reaches the event log. The counter has an
 * impressions column and a cta_clicks column and adding a third would change
 * the meaning of a table two admin pages already read.
 */
const KINDS = new Set(['impression', 'cta_click', 'dismiss']);
const COUNTED_KINDS = new Set(['impression', 'cta_click']);
const TIERS = new Set(['anon', 'free', 'pro']);

/** Matches the cookie field cap in src/lib/attribution.ts. */
const MAX_SURFACE = 200;

/** Slugs are lowercase kebab in this codebase, everywhere, without exception. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Mirrors NagAction in src/lib/upgrade-nag.ts. Re-declared rather than
 *  imported because that module reads sessionStorage on import and this is a
 *  server route; the list is short and a stray kind is dropped, not fatal. */
const JOURNAL_KINDS = new Set([
  'spot_open',
  'spot_preview',
  'search_spot',
  'search_species',
  'species_filter',
  'score_filter',
  'station_pick',
  'day_pick',
  'spot_page',
  'wall',
]);

const JOURNAL_MAX = 12;
const CONTEXT_MAX_KEYS = 10;
const CONTEXT_KEY = /^[a-z][a-z0-9_]{0,23}$/;
const CONTEXT_VALUE_MAX = 64;

/** A day is 86.4M ms; a modal open longer than an hour is a tab left behind. */
const DWELL_MAX_MS = 60 * 60 * 1000;
const ENGAGEMENT_MAX = 1000;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const kind = String(body.kind ?? '');
  const feature = String(body.feature ?? '');
  const viewerTier = String(body.viewer_tier ?? 'anon');
  const surface = String(body.surface ?? '').slice(0, MAX_SURFACE);

  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }
  // Validated against the live enum rather than a copy, so a new wall added to
  // plan-features.ts starts counting without anyone remembering to edit here.
  if (!(feature in NAG_FEATURES)) {
    return NextResponse.json({ error: 'unknown_feature' }, { status: 400 });
  }
  if (!TIERS.has(viewerTier)) {
    return NextResponse.json({ error: 'invalid_tier' }, { status: 400 });
  }

  const day = pacificDay();

  // The counter first, and independently of the log below. It is the older
  // surface, two admin pages read it, and a failure in the richer write must
  // not cost a count that has been landing since August.
  if (COUNTED_KINDS.has(kind)) {
    const { error } = await admin.rpc('bump_paywall_counter', {
      p_day: day,
      p_feature: feature,
      p_surface: surface,
      p_viewer_tier: viewerTier,
      p_kind: kind,
    });
    if (error) {
      // Logged, not surfaced. A dropped count is not worth a visible failure
      // on the paywall this was fired from.
      console.error('[attribution] paywall counter failed', error);
    }
  }

  await recordEvent(request, { kind, feature, surface, viewerTier, body });

  // Last, and after the two writes above have had their turn. A conversion is
  // the newest and least load-bearing of the three, and the counter that has
  // been landing since August must not be at the mercy of it.
  if (kind === 'impression') {
    await recordPaidView(request, { day, feature, surface });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Report a bought click reaching the wall, once per session.
 *
 * ONLY WITH A PAID TOUCH. `rc_paid` is written from the request in middleware
 * whenever a visit carries campaign tags or a click id, so its presence is the
 * whole test for "we paid for this person". An organic reader opening the same
 * wall is counted in `paywall_events` and nowhere else, which is correct: an ad
 * network should not be shown a conversion for somebody it never sent.
 *
 * Deliberately NOT falling back to first touch, unlike every other consumer of
 * these cookies. Elsewhere the fallback keeps organic campaign tags from
 * vanishing; here it would report a months-old paid click as a conversion today
 * because the reader came back through Google, and the whole value of this
 * event is that it is frequent and recent.
 *
 * Never throws and never blocks the response. This runs on the request that
 * shows somebody a paywall.
 */
async function recordPaidView(
  request: NextRequest,
  input: { day: string; feature: string; surface: string },
): Promise<void> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const paid = readPaid(cookieHeader);
  if (!paid) return;

  const dedupeKey = paywallViewDedupeKey({
    sessionId: readSessionId(cookieHeader),
    clickId: paid.click_id || null,
    day: input.day,
  });
  // Neither a session cookie nor a click id: nothing stable to count once by.
  // See the argument in paywall-conversion.ts for why that is skipped rather
  // than guessed at.
  if (!dedupeKey) return;

  try {
    await recordPaywallViewConversion(admin, {
      dedupeKey,
      occurredAt: new Date().toISOString(),
      acquisition: acquisitionFromRequest({
        headers: request.headers,
        entry: readEntry(cookieHeader),
        paid,
        // Already checked against the live enum by the caller, and clamped
        // there too, so the wall this credits cannot be invented by a body.
        paywallFeature: input.feature,
        paywallSurface: input.surface || null,
      }),
    });
  } catch (err) {
    console.error('[attribution] paywall view conversion failed', err);
  }
}

async function recordEvent(
  request: NextRequest,
  input: {
    kind: string;
    feature: string;
    surface: string;
    viewerTier: string;
    body: Record<string, unknown>;
  },
): Promise<void> {
  // Everything about the VISIT is assembled by paywallEventRow off the request
  // itself. Everything this function passes in describes the WALL, and every
  // one of those values has just come out of a body a visitor could have
  // written, so each is clamped or dropped below.
  const row = paywallEventRow(request, {
    kind: input.kind as 'impression' | 'cta_click' | 'dismiss',
    feature: input.feature,
    surface: input.surface,
    viewerTier: input.viewerTier,
    spotSlug: slug(input.body.spot_slug),
    engagement: bounded(input.body.engagement, ENGAGEMENT_MAX),
    dwellMs: bounded(input.body.dwell_ms, DWELL_MAX_MS),
    journal: journal(input.body.journal),
    context: context(input.body.context),
  });

  const { error } = await admin.from('paywall_events').insert(row);

  if (error) {
    console.error('[attribution] paywall event insert failed', error);
  }
}

/* -------------------------------------------------------------------------
 * Everything below re-checks a value the client wrote. None of it throws:
 * a field that fails its check is stored as null, because a wall event
 * missing its spot is still worth having and a 400 would teach a browser to
 * retry a beacon it should forget.
 * ---------------------------------------------------------------------- */

function slug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return SLUG.test(value) ? value : null;
}

function bounded(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 0) return null;
  return Math.min(n, max);
}

function journal(value: unknown): { k: string; t: number }[] | null {
  if (!Array.isArray(value)) return null;
  const out: { k: string; t: number }[] = [];
  for (const entry of value.slice(-JOURNAL_MAX)) {
    if (!entry || typeof entry !== 'object') continue;
    const k = (entry as { k?: unknown }).k;
    const t = (entry as { t?: unknown }).t;
    if (typeof k !== 'string' || !JOURNAL_KINDS.has(k)) continue;
    out.push({ k, t: typeof t === 'number' && Number.isFinite(t) ? Math.round(t) : 0 });
  }
  return out.length > 0 ? out : null;
}

/**
 * A small flat bag of scalars. Keys are whitelisted by SHAPE rather than by
 * name — the point of this column is that a new wall can record the one extra
 * thing that explains it without a migration — but the shape is strict: a
 * snake_case key, and a value that is a short string, a finite number or a
 * boolean. Nested objects and arrays are dropped rather than stringified.
 */
function context(value: unknown): Record<string, string | number | boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= CONTEXT_MAX_KEYS) break;
    if (!CONTEXT_KEY.test(key)) continue;
    if (typeof raw === 'string') {
      if (raw) out[key] = raw.slice(0, CONTEXT_VALUE_MAX);
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[key] = raw;
    } else if (typeof raw === 'boolean') {
      out[key] = raw;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
