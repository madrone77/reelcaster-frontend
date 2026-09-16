/**
 * POST /api/nudges/event  { nudge, kind, surface, spotSlug?, rating? }  → { ok: true }
 *
 * One row in `nudge_events`. Every field is checked against its enum because
 * the body is client-written. Device comes from the User-Agent, never the body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pacificDay } from '@/lib/pacific-day';
import { nudgeAdmin, nudgeUserId, requestDevice } from '@/lib/nudge-server';
import { cleanSpotSlug, isNudge, isNudgeEventKind, isNudgeSurface, isRating } from '@/lib/nudges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const userId = await nudgeUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!isNudge(body.nudge) || !isNudgeEventKind(body.kind) || !isNudgeSurface(body.surface)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { error } = await nudgeAdmin.from('nudge_events').insert({
    day: pacificDay(),
    user_id: userId,
    nudge: body.nudge,
    kind: body.kind,
    surface: body.surface,
    spot_slug: cleanSpotSlug(body.spotSlug),
    rating: isRating(body.rating) ? body.rating : null,
    device: requestDevice(request),
  });
  if (error) {
    console.error('[nudges] event write failed', error);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
