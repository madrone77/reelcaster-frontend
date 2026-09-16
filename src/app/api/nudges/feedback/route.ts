/**
 * POST  /api/nudges/feedback  { rating, surface, spotSlug? }  → { id }
 * PATCH /api/nudges/feedback  { id, rating, note }            → { ok: true }
 *
 * The feedback nudge in two steps. A star tap saves the rating on its own, so
 * a rating counts even when nobody writes a word, and retires the nudge on
 * the account. The note that may follow is attached to the same row; the
 * rating travels with it because the stars stay tappable above the box.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pacificDay } from '@/lib/pacific-day';
import { nudgeAdmin, nudgeUserId, requestDevice, stampDismissedNag } from '@/lib/nudge-server';
import {
  FEEDBACK_NOTE_MAX,
  NUDGE_DISMISS_KEY,
  cleanSpotSlug,
  isNudgeSurface,
  isRating,
} from '@/lib/nudges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const userId = await nudgeUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await readBody(request);
  if (!body || !isRating(body.rating) || !isNudgeSurface(body.surface)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { data, error } = await nudgeAdmin
    .from('app_feedback')
    .insert({
      day: pacificDay(),
      user_id: userId,
      rating: body.rating,
      surface: body.surface,
      spot_slug: cleanSpotSlug(body.spotSlug),
      device: requestDevice(request),
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[nudges] feedback insert failed', error);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  // Asked once. A failed stamp only means the nudge may come round again.
  await stampDismissedNag(userId, NUDGE_DISMISS_KEY.feedback);

  return NextResponse.json({ id: data.id });
}

export async function PATCH(request: NextRequest) {
  const userId = await nudgeUserId(request);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await readBody(request);
  if (
    !body ||
    typeof body.id !== 'string' ||
    !isRating(body.rating) ||
    typeof body.note !== 'string'
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const note = body.note.trim().slice(0, FEEDBACK_NOTE_MAX);

  // Scoped to the caller: an id alone must not reach someone else's row.
  const { data, error } = await nudgeAdmin
    .from('app_feedback')
    .update({ rating: body.rating, note: note || null, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', userId)
    .select('id');
  if (error) {
    console.error('[nudges] feedback note write failed', error);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
