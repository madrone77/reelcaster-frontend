/**
 * GET /api/nudges  → { hasCatch }
 *
 * What the spot page nudge needs to know beyond `dismissed_nags`, which the
 * subscription store already has. See src/lib/nudges.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nudgeAdmin, nudgeUserId } from '@/lib/nudge-server';
import type { NudgeEligibility } from '@/lib/nudges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = await nudgeUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Drafts count: a person who has started a catch log does not need asked.
  const { count, error } = await nudgeAdmin
    .from('catch_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) {
    console.error('[nudges] catch count failed', error);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }

  const body: NudgeEligibility = { hasCatch: (count ?? 0) > 0 };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
}
