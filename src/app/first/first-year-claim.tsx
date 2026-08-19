'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { captureOffer } from '@/lib/offers';

/**
 * The state-dependent half of /first: set the claim cookie, then say where the
 * visitor stands.
 *
 * Three answers, and the honest one matters most. Someone who signs up through
 * this link is a free account until an admin approves them, which can be hours.
 * Saying nothing would leave them staring at a paywall convinced the link was
 * broken, so the pending state is explicit and promises the email that follows.
 */
export default function FirstYearClaim() {
  const { user, loading: authLoading } = useAuth();
  const { isPaid, loading: subLoading } = useSubscription();

  // On mount, not on click. The visitor may leave through the header, a
  // bookmark, or the app itself rather than the button below, and the claim
  // should follow them either way.
  useEffect(() => {
    captureOffer('first');
  }, []);

  if (authLoading) {
    return <div className="mt-8 h-[52px] w-full max-w-sm animate-pulse rounded-md bg-rc-panel" />;
  }

  if (!user) {
    return (
      <div className="mt-8">
        <Link
          href="/signup?next=/first"
          className="inline-flex items-center justify-center rounded-md bg-rc-brand px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
        >
          Create your free account
        </Link>
        <p className="mt-4 text-sm text-rc-ink-mute">
          Already have an account?{' '}
          <Link
            href="/login?next=/first"
            className="font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
          >
            Sign in
          </Link>{' '}
          and we&apos;ll add the year to it.
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
        <p className="text-sm font-bold text-rc-ink">Your free year is live.</p>
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
      <p className="text-sm font-bold text-rc-ink">You&apos;re on the list.</p>
      <p className="mt-1.5 text-sm text-rc-ink-soft">
        We switch these on by hand, so it isn&apos;t instant. You&apos;ll get an
        email the moment your free year is live. Your account works in the
        meantime, the map, today&apos;s scores, and your catch log are all
        open.
      </p>
      <Link
        href="/explore"
        className="mt-4 inline-flex items-center justify-center rounded-md border border-rc-rule px-5 py-3 text-sm font-semibold text-rc-ink transition-colors hover:border-rc-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
      >
        Look around while you wait
      </Link>
    </div>
  );
}
