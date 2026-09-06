'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { captureReferral, referralPath } from '@/lib/referrals';

/**
 * The state-dependent half of /r/<code>: set the cookie, then say where the
 * visitor stands.
 *
 * Signed out: the button to /signup, with next= pointing back here so the
 * new account lands on the "it's live" state rather than a blank map.
 *
 * Signed in and Pro: it worked, go fish. This is also what a brand new
 * account sees a moment after confirming, because the grant runs before the
 * subscription store reads.
 *
 * Signed in and not Pro: the link is for new accounts only, said plainly.
 * Granting to existing accounts is how a forwarded link becomes a free tier,
 * so the honest answer here is the whole guard.
 */
export default function ReferralClaim({ code, who }: { code: string; who: string }) {
  const { user, loading: authLoading } = useAuth();
  const { isPaid, loading: subLoading, refresh } = useSubscription();

  // On mount, not on click: the visitor may leave through the header or the
  // map and the cookie should follow them either way.
  useEffect(() => {
    captureReferral(code);
  }, [code]);

  // A new account arriving back here has just been comped by the attribution
  // route. The store may have read before that write; ask again once.
  useEffect(() => {
    if (user && !isPaid && !subLoading) {
      const t = setTimeout(refresh, 1500);
      return () => clearTimeout(t);
    }
  }, [user, isPaid, subLoading, refresh]);

  const next = encodeURIComponent(referralPath(code));

  if (authLoading) {
    return <div className="mt-8 h-[52px] w-full max-w-sm animate-pulse rounded-md bg-rc-panel" />;
  }

  if (!user) {
    return (
      <div className="mt-8">
        <Link
          href={`/signup?next=${next}`}
          className="inline-flex items-center justify-center rounded-md bg-rc-brand px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
        >
          Claim your month
        </Link>
        <p className="mt-4 text-sm text-rc-ink-mute">
          New accounts only. If you already have one, {who} still gets their
          month when you send the link on to somebody who does not.
        </p>
      </div>
    );
  }

  if (subLoading) {
    return <div className="mt-8 h-[52px] w-full max-w-sm animate-pulse rounded-md bg-rc-panel" />;
  }

  if (isPaid) {
    return (
      <div className="mt-8 rounded-lg border border-rc-brand/30 bg-rc-panel p-5">
        <p className="text-sm font-bold text-rc-ink">Pro is on.</p>
        <p className="mt-1.5 text-sm text-rc-ink-soft">
          Everything Pro is switched on for this account. Go pick a day.
        </p>
        <Link
          href="/explore"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-rc-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
        >
          Open the map
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-rc-rule bg-rc-panel p-5">
      <p className="text-sm font-bold text-rc-ink">This link is for new accounts.</p>
      <p className="mt-1.5 text-sm text-rc-ink-soft">
        You already have a ReelCaster account, so the free month does not apply
        here. You can hand out a month of your own from your account page.
      </p>
      <Link
        href="/settings/account"
        className="mt-4 inline-flex items-center justify-center rounded-md border border-rc-rule px-5 py-3 text-sm font-semibold text-rc-ink transition-colors hover:border-rc-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
      >
        Get your own link
      </Link>
    </div>
  );
}
