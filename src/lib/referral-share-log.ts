'use client';

/**
 * Record one referral share tap on the account, beside the Mixpanel event.
 *
 * Fire and forget. It is never awaited before the thing the tap does, because
 * navigator.share needs the tap's own activation and a copy should not wait on
 * a network round-trip. `keepalive` lets the request finish when a share sheet
 * or a navigation takes the page away. A failure is a missing row, nothing more.
 */

import { supabase } from '@/lib/supabase';
import type { ReferralShareKind, ReferralShareSurface } from '@/lib/referral-share-event';

export function logReferralShare(kind: ReferralShareKind, surface: ReferralShareSurface): void {
  void (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/referrals/event', {
        method: 'POST',
        keepalive: true,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kind, surface }),
      });
    } catch {
      // A missing row in an admin count. Not worth a console line per tap.
    }
  })();
}
