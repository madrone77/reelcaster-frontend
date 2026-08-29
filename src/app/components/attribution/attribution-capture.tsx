'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { captureEntry, capturePaidTouch } from '@/lib/attribution';
import { registerAcquisition } from '@/lib/analytics';
import SignupConversion from '@/app/components/analytics/signup-conversion';

/** What POST /api/attribution/signup answers, narrowed to what is used here. */
interface SignupAttributionResponse {
  new_account?: boolean;
  signup_path?: 'free' | 'checkout';
}

/**
 * Renders nothing of its own. Does three things, all invisible:
 *
 *   1. Records first touch (landing path, referrer, UTM, click id) into the
 *      rc_entry cookie. Write-once, so only the real landing page is kept.
 *      Alongside it, records the most recent click we PAID for into rc_paid,
 *      which overwrites, because first touch alone credits an ad that closed
 *      a months-old organic visitor as organic. See src/lib/attribution.ts.
 *   2. When a user turns up, hands rc_entry and rc_wall to the server so the
 *      account carries "which wall earned it" for the dashboard.
 *   3. When that server call reports the account is NEW, renders
 *      <SignupConversion>, which is what turns a free signup into a conversion
 *      event in Plausible and on the Meta pixel. The decision is the server's
 *      because only it can tell a new account from a returning customer signing
 *      in on a new browser.
 *
 * Mounted OUTSIDE `<AuthGate>` on purpose. The gate holds a loading state, and
 * public marketing and city pages are where most acquisition actually lands,
 * so capture has to run before and regardless of any auth decision.
 */
export default function AttributionCapture() {
  const { user, session, loading } = useAuth();
  const pathname = usePathname();
  const postedForRef = useRef<string | null>(null);
  const [newAccount, setNewAccount] = useState<{
    userId: string;
    path: 'free' | 'checkout';
  } | null>(null);

  // Every route change, not just the first mount: `captureEntry` returns early
  // once the cookie exists, and a visitor whose very first page is a client
  // navigation (a prefetched link off a shared URL) would otherwise be missed.
  //
  // `capturePaidTouch` runs on the same schedule but for the opposite reason:
  // it has to see every navigation because a paid click can arrive at any
  // point in a session, not only at its start. It no-ops on a URL with no paid
  // markers, so the organic pages in between leave the record alone.
  useEffect(() => {
    captureEntry();
    capturePaidTouch();
    // Registered after the cookies are written, never before: super properties
    // are read back out of them, and the ordering is the difference between
    // the landing event carrying its campaign and carrying nothing.
    registerAcquisition();
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

    // Fire and forget as far as the page is concerned. Nothing downstream waits
    // on attribution, and a failure here must never be visible to someone who
    // just made an account, so every error path ends in "report nothing".
    void fetch('/api/attribution/signup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      // Cookies are the payload; the route reads rc_wall and rc_entry off the
      // request rather than trusting a body the client assembled.
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as SignupAttributionResponse;
        if (!body.new_account) return;
        setNewAccount({ userId, path: body.signup_path ?? 'free' });
      })
      .catch(() => {});
  }, [user?.id, session?.access_token, loading]);

  // Mounted rather than called so the reporting lives in one readable place and
  // this component keeps its single job of moving cookies to the server.
  return newAccount ? (
    <SignupConversion userId={newAccount.userId} path={newAccount.path} />
  ) : null;
}
