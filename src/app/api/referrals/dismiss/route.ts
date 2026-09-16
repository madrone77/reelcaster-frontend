/**
 * POST /api/referrals/dismiss  { surface: 'spot' | 'dashboard' | 'catch' | 'feedback' }  → { ok: true }
 *
 * Stamps the nag as dismissed on the account's `user_settings.dismissed_nags`.
 * The surface is checked against the enum because the body is client-written
 * and this lands in a jsonb column: an unchecked key would let a browser put
 * arbitrary keys of arbitrary size in the row.
 *
 * The spot page nudges (src/lib/nudges.ts) retire through here too: `spot`
 * is the share nudge, `catch` and `feedback` are the other two.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isReferralNagSurface } from '@/lib/referral-nag';
import { NUDGE_DISMISS_KEY } from '@/lib/nudges';
import { nudgeUserId, stampDismissedNag } from '@/lib/nudge-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUDGE_KEYS: readonly unknown[] = Object.values(NUDGE_DISMISS_KEY);

export async function POST(request: NextRequest) {
  const userId = await nudgeUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let surface: unknown;
  try {
    surface = ((await request.json()) as { surface?: unknown }).surface;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!isReferralNagSurface(surface) && !NUDGE_KEYS.includes(surface)) {
    return NextResponse.json({ error: 'unknown_surface' }, { status: 400 });
  }

  if (!(await stampDismissedNag(userId, surface as string))) {
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
