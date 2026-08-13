'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { captureEntry } from '@/lib/attribution';

/**
 * Renders nothing. Does two things, both invisible:
 *
 *   1. Records first touch (landing path, referrer, UTM) into the rc_entry
 *      cookie. Write-once, so only the real landing page is kept.
 *   2. When a user turns up, hands rc_entry and rc_wall to the server so the
 *      account carries "which wall earned it" for the dashboard.
 *
 * Mounted OUTSIDE `<AuthGate>` on purpose. The gate holds a loading state, and
 * public marketing and city pages are where most acquisition actually lands,
 * so capture has to run before and regardless of any auth decision.
 */
export default function AttributionCapture() {
  const { user, session, loading } = useAuth();
  const pathname = usePathname();
  const postedForRef = useRef<string | null>(null);

  // Every route change, not just the first mount: `captureEntry` returns early
  // once the cookie exists, and a visitor whose very first page is a client
  // navigation (a prefetched link off a shared URL) would otherwise be missed.
  useEffect(() => {
    captureEntry();
  }, [pathname]);

  useEffect(() => {
    if (loading) return;
    const token = session?.access_token;
    const userId = user?.id;
    if (!token || !userId) return;
    // Once per account per page-load. The server is write-once anyway, so this
    // is about not making a pointless request on every auth refresh.
    if (postedForRef.current === userId) return;
    postedForRef.current = userId;

    // Fire and forget. Nothing downstream waits on attribution, and a failure
    // here must never be visible to someone who just made an account.
    void fetch('/api/attribution/signup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      // Cookies are the payload; the route reads rc_wall and rc_entry off the
      // request rather than trusting a body the client assembled.
      credentials: 'same-origin',
    }).catch(() => {});
  }, [user?.id, session?.access_token, loading]);

  return null;
}
