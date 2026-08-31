/**
 * POST /api/attribution/paywall  → { ok: true }
 *
 * The denominator for the conversion panels in bluecaster
 * /admin/reelcaster/analytics. "12 signups came from the catch-reports wall"
 * means nothing until you know whether 40 people saw that wall or 4,000.
 *
 * Rolls up into `paywall_impressions` at day grain. This is NOT an event log:
 * no visitor id, no user id, no path, no timestamp beyond the date. Counting
 * is the whole job, and a counter has nothing in it to leak or to purge.
 *
 * Unauthenticated by design — most walls are shown to signed-out visitors, who
 * are exactly the ones we most want to count. The cost of that is that anyone
 * can inflate a counter, so the feature and tier are validated against the
 * real enums and the surface is length-capped; the worst case is a wrong
 * number on an internal dashboard, not a write amplification.
 *
 * Fire-and-forget from the client. It must never block or break a paywall.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { NAG_FEATURES } from '@/lib/plan-features';
import { pacificDay } from '@/lib/pacific-day';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const KINDS = new Set(['impression', 'cta_click']);
const TIERS = new Set(['anon', 'free', 'pro']);

/** Matches the cookie field cap in src/lib/attribution.ts. */
const MAX_SURFACE = 200;

export async function POST(request: NextRequest) {
  let body: {
    kind?: string;
    feature?: string;
    surface?: string;
    viewer_tier?: string;
  };
  try {
    body = await request.json();
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

  const { error } = await admin.rpc('bump_paywall_counter', {
    p_day: pacificDay(),
    p_feature: feature,
    p_surface: surface,
    p_viewer_tier: viewerTier,
    p_kind: kind,
  });

  if (error) {
    // Logged, not surfaced. A dropped count is not worth a visible failure on
    // the paywall this was fired from.
    console.error('[attribution] paywall counter failed', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
