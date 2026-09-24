/**
 * An alert on a spot stars that spot.
 *
 * Somebody who asks to be messaged when a spot turns on obviously wants to keep
 * it, and until now the alert lived only on the Notifications page: the spot
 * never reached the dashboard, and the day-4 trial email told an angler with an
 * alert already firing that they had "not saved a spot yet".
 *
 * Same table and same free-tier cap as POST /api/saved-spots. A Member already
 * at the cap keeps their alert and simply does not get the star; the alert is
 * what they asked for, and this must not become a way past the cap.
 *
 * Never throws. A failed star costs a dashboard card, not the alert.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveEntitlement } from '@/lib/entitlement';
import { FREE_FAVORITE_SPOTS } from '@/lib/plan-features';

export async function starAlertSpot(
  admin: SupabaseClient,
  userId: string,
  slug: string | null | undefined,
): Promise<void> {
  if (!slug) return;
  try {
    const [{ isPro }, { data: existing, error: readErr }] = await Promise.all([
      resolveEntitlement(admin, userId),
      admin.from('user_favorite_spots').select('spot_slug').eq('user_id', userId),
    ]);
    if (readErr) throw readErr;

    const slugs = (existing ?? []).map((r) => r.spot_slug as string);
    if (slugs.includes(slug)) return;
    if (!isPro && slugs.length >= FREE_FAVORITE_SPOTS) return;

    const { error } = await admin
      .from('user_favorite_spots')
      .insert({ user_id: userId, spot_slug: slug, spot_id: null });
    // 23505: starred by a racing request, which is the outcome we wanted.
    if (error && error.code !== '23505') throw error;
  } catch (err) {
    console.error(`[alerts] could not star ${slug} for ${userId}:`, err);
  }
}
