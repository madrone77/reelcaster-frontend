'use client';

/**
 * One-time "Welcome to Pro" modal.
 *
 * Mounted once at the root so it can catch the user wherever they land after
 * signing in — there is no single post-login destination. It renders nothing
 * until `/api/pro/welcome` says the user is Pro and has never dismissed it,
 * which means signed-out visitors and public crawlers pay one fetch that
 * returns `{show:false}` and nothing more.
 *
 * The dismissal is recorded server-side, not in localStorage: a welcome that
 * reappears on every new device stops reading as a welcome.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarRange,
  Crown,
  Fish,
  Layers,
  MapPin,
  BellRing,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useAnalytics } from '@/hooks/use-analytics';

interface WelcomeState {
  show: boolean;
  comped?: boolean;
  tier?: string;
  trialing?: boolean;
  until?: string | null;
}

const FEATURES = [
  {
    icon: CalendarRange,
    title: '14-day forecast',
    body: 'The full two-week outlook, hour by hour — plan the trip, not just the morning.',
  },
  {
    icon: Fish,
    title: 'Five species at once',
    body: 'Compare the bite score across species on a spot instead of flipping between them.',
  },
  {
    icon: BellRing,
    title: 'Up to 10 alerts, by email or SMS',
    body: 'Get a ping when a spot you care about crosses the score you set.',
  },
  {
    icon: MapPin,
    title: 'Your own spots',
    body: 'Drop a pin anywhere in covered water and get it scored like a published spot. No 5-spot cap on favourites.',
  },
  {
    icon: Layers,
    title: 'Bathymetry',
    body: 'Drop-offs, ledges, and channel structure under the live forecast map.',
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ProWelcomeModal() {
  const { user, loading: authLoading } = useAuth();
  const { trackEvent } = useAnalytics();
  const pathname = usePathname();
  const [state, setState] = useState<WelcomeState>({ show: false });
  const [dismissing, setDismissing] = useState(false);
  const tracked = useRef(false);

  // Never interrupt the purchase flow: popping "Welcome to Pro" on the pricing
  // page reads as premature (mid-checkout, or to someone whose tier flipped
  // elsewhere), and /billing/success celebrates on its own. The modal instead
  // catches the buyer on the page they land on next (/explore after the
  // success redirect) — and comped users anywhere else, as before.
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

        const res = await fetch('/api/pro/welcome', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok || cancelled) return;

        const body: WelcomeState = await res.json();
        if (!body.show || cancelled) return;

        setState(body);
        if (!tracked.current) {
          tracked.current = true;
          trackEvent('Pro Welcome Shown', {
            comped: !!body.comped,
            trialing: !!body.trialing,
            tier: body.tier,
          });
        }
      } catch {
        // A welcome modal is never worth surfacing an error for.
      }
    })();

    return () => {
      cancelled = true;
    };
    // trackEvent is stable for the life of the provider; re-running on it would
    // re-fire the impression event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, suppressed]);

  const dismiss = useCallback(async () => {
    setDismissing(true);
    // Close immediately — the write is bookkeeping, not something to wait on.
    setState({ show: false });
    trackEvent('Pro Welcome Dismissed', {});
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/pro/welcome', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // If this fails the modal simply shows once more next session.
    } finally {
      setDismissing(false);
    }
  }, [trackEvent]);

  useEffect(() => {
    if (!state.show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.show, dismiss]);

  if (!state.show || suppressed) return null;

  const { comped, trialing, until } = state;
  const untilLabel = until ? formatDate(until) : null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-welcome-title"
      data-testid="pro-welcome-modal"
      data-comped={comped ? 'true' : 'false'}
      onClick={() => void dismiss()}
    >
      <div
        // The feature list is taller than a phone viewport, so the panel — not
        // the backdrop — takes the scroll. That keeps the margin visible on
        // every edge instead of the sheet running flush off the top and bottom.
        className="relative w-full sm:max-w-lg max-h-full overflow-y-auto bg-white rounded-2xl border border-rc-rule shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => void dismiss()}
          disabled={dismissing}
          aria-label="Close"
          className="absolute top-3 right-3 p-2 rounded-full text-rc-ink-mute hover:text-rc-ink hover:bg-rc-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-7 pb-5 border-b border-rc-rule">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-9 h-9 rounded-full bg-rc-brand-soft flex items-center justify-center shrink-0">
              <Crown className="w-4.5 h-4.5 text-rc-brand" />
            </span>
            <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
              {comped ? 'Complimentary' : 'ReelCaster Pro'}
            </p>
          </div>

          <h2
            id="pro-welcome-title"
            className="text-2xl sm:text-3xl font-black tracking-[-0.02em] text-rc-ink"
          >
            Welcome to Pro.
          </h2>

          <p className="mt-2 text-sm sm:text-base leading-relaxed text-rc-ink-soft">
            {comped ? (
              <>
                A full year of ReelCaster Pro is on us
                {untilLabel ? <> — yours through {untilLabel}</> : null}. Nothing
                to pay, no card on file. Here&rsquo;s what just opened up.
              </>
            ) : trialing ? (
              <>
                Your free trial is on
                {untilLabel ? (
                  <> — nothing is charged before {untilLabel}</>
                ) : null}
                , and you can cancel anytime before then. Here&rsquo;s what just
                opened up.
              </>
            ) : (
              <>
                Your account is now Pro
                {untilLabel ? <>, renewing {untilLabel}</> : null}. Here&rsquo;s
                what just opened up.
              </>
            )}
          </p>
        </div>

        <ul className="px-6 py-5 space-y-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon className="w-4.5 h-4.5 text-rc-brand mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rc-ink">{title}</p>
                <p className="text-sm text-rc-ink-soft leading-relaxed mt-0.5">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="px-6 pb-6 pt-1 flex flex-col sm:flex-row gap-2">
          <Link
            href="/explore"
            onClick={() => void dismiss()}
            data-testid="pro-welcome-cta"
            className="flex-1 inline-flex items-center justify-center rounded-full bg-rc-brand hover:bg-rc-brand-hover px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Start exploring
          </Link>
          <button
            type="button"
            onClick={() => void dismiss()}
            className="inline-flex items-center justify-center rounded-full border border-rc-rule px-5 py-2.5 text-sm font-medium text-rc-ink hover:bg-rc-surface transition-colors"
          >
            Maybe later
          </button>
        </div>

        {comped && (
          <p className="px-6 pb-6 -mt-2 text-xs text-rc-ink-mute">
            We&rsquo;ll let you know before the year is up. You won&rsquo;t be
            charged unless you choose to subscribe.
          </p>
        )}
      </div>
    </div>
  );
}
