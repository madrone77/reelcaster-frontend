'use client';

/**
 * Decides which welcome, if any, a signed-in user is owed, and mounts it.
 *
 * Mounted once at the root because there is no single post-login destination:
 * a new account can arrive on any route, and someone who bought Pro lands back
 * on /explore. Renders null for everyone who is owed nothing, which is almost
 * everyone almost always.
 *
 * Two modals compete for this slot. The three-step tour explains the product;
 * the Pro wizard sets up an account that just went Pro. Before this gate they
 * would each have fetched on every signed-in page load and could both have
 * decided to render on the same one. Now one call to /api/welcome settles it,
 * and `next` lets the Pro wizard follow the tour in the same session rather
 * than waiting for a reload.
 *
 * The Pro wizard still owns its own state fetch. It needs variant copy the
 * gate has no use for (comped, trialing, renewal date), and leaving that call
 * where it is means this gate did not have to reach inside a working wizard.
 */

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import ProWelcomeModal from '@/app/components/pro/pro-welcome-modal';
import NewUserWelcomeModal from './new-user-welcome-modal';

type Kind = 'new' | 'pro' | null;

interface GateState {
  kind: Kind;
  next: Kind;
  pro?: boolean;
}

export default function WelcomeGate() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();

  const [state, setState] = useState<GateState>({ kind: null, next: null });

  // Never interrupt the purchase flow. Popping a welcome on the pricing page
  // reads as premature mid-checkout, and /billing/success celebrates on its
  // own. Both modals instead catch the user on the page they land on next.
  const suppressed =
    pathname === '/pricing' || (pathname?.startsWith('/billing') ?? false);

  useEffect(() => {
    if (authLoading || !user || suppressed) return;
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const res = await fetch('/api/welcome', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok || cancelled) return;

        const body: GateState = await res.json();
        if (!body.kind || cancelled) return;
        setState(body);
      } catch {
        // A welcome modal is never worth surfacing an error for.
      }
    })();

    return () => {
      cancelled = true;
    };
    // `user?.id` rather than `user`: AuthProvider re-emits a fresh user object
    // on every auth event, and an object dep here would call the gate twice on
    // every page load, site-wide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, suppressed]);

  /** The tour closed. Promote whatever was queued behind it. */
  const onTourClose = useCallback(() => {
    setState((s) => ({ kind: s.next, next: null, pro: s.pro }));
  }, []);

  if (suppressed) return null;

  if (state.kind === 'new') {
    return (
      <NewUserWelcomeModal isPro={!!state.pro} onClose={onTourClose} />
    );
  }

  if (state.kind === 'pro') return <ProWelcomeModal />;

  return null;
}
