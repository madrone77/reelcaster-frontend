'use client';

/**
 * Client side of the nudges: the funnel log, the eligibility read, and the
 * feedback writes. Every call carries the session's bearer token.
 *
 * The funnel log is fire and forget, like logReferralShare: never awaited
 * before the thing the tap does, `keepalive` so it survives a share sheet or
 * a navigation. A failure is a missing row in an admin count.
 */

import { supabase } from '@/lib/supabase';
import type { NudgeEligibility, Nudge, NudgeEventKind, NudgeSurface } from '@/lib/nudges';

async function authHeaders(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export function logNudge(
  nudge: Nudge,
  kind: NudgeEventKind,
  surface: NudgeSurface,
  extra: { spotSlug?: string | null; rating?: number } = {},
): void {
  void (async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      await fetch('/api/nudges/event', {
        method: 'POST',
        keepalive: true,
        headers,
        body: JSON.stringify({ nudge, kind, surface, ...extra }),
      });
    } catch {
      // A missing row in an admin count. Not worth a console line per tap.
    }
  })();
}

// One read per user per page load: every spot page in a session asks the
// same question, and the answer only changes when this tab logs a catch.
let eligibilityFor: string | null = null;
let eligibilityPromise: Promise<NudgeEligibility | null> | null = null;

export function fetchNudgeEligibility(userId: string): Promise<NudgeEligibility | null> {
  if (eligibilityFor === userId && eligibilityPromise) return eligibilityPromise;
  eligibilityFor = userId;
  eligibilityPromise = (async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return null;
      const res = await fetch('/api/nudges', { headers });
      if (!res.ok) return null;
      return (await res.json()) as NudgeEligibility;
    } catch {
      return null;
    }
  })();
  // A failed read is retried on the next page rather than cached.
  eligibilityPromise.then((r) => {
    if (!r) eligibilityPromise = null;
  });
  return eligibilityPromise;
}

/** Forget the cached answer, e.g. after this tab logs a catch. */
export function forgetNudgeEligibility(): void {
  eligibilityPromise = null;
}

/** Save a star rating. Returns the feedback row id for the note that may follow. */
export async function saveFeedbackRating(
  rating: number,
  surface: NudgeSurface,
  spotSlug: string | null,
): Promise<string | null> {
  try {
    const headers = await authHeaders();
    if (!headers) return null;
    const res = await fetch('/api/nudges/feedback', {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating, surface, spotSlug }),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { id?: string }).id ?? null;
  } catch {
    return null;
  }
}

/** Attach the note (and a changed rating) to a saved row. */
export async function saveFeedbackNote(id: string, rating: number, note: string): Promise<boolean> {
  try {
    const headers = await authHeaders();
    if (!headers) return false;
    const res = await fetch('/api/nudges/feedback', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ id, rating, note }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Retire a nudge on the account. Swallowed on failure: it just asks again. */
export async function saveNudgeDismissal(key: string): Promise<void> {
  try {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch('/api/referrals/dismiss', {
      method: 'POST',
      headers,
      body: JSON.stringify({ surface: key }),
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch (err) {
    console.warn('[nudges] dismiss did not save', err);
  }
}
