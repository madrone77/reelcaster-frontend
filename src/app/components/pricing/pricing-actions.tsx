'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

interface Props {
  defaultRegion: string | null; // pre-filled from server-side IP geo
  monthlyDollarsNow: number;
}

const REGIONS = [
  { value: 'BC', label: 'British Columbia' },
  { value: 'WA', label: 'Washington' },
  { value: 'OR', label: 'Oregon' },
  { value: 'Other', label: 'Somewhere else' },
];

export default function PricingActions({ defaultRegion, monthlyDollarsNow }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const initialRegion = useMemo(() => {
    const fromUrl = searchParams.get('region');
    if (fromUrl && REGIONS.some((r) => r.value === fromUrl)) return fromUrl;
    if (defaultRegion && REGIONS.some((r) => r.value === defaultRegion)) return defaultRegion;
    return 'BC';
  }, [searchParams, defaultRegion]);

  const [open, setOpen] = useState<null | 'monthly' | 'annual'>(null);
  const [region, setRegion] = useState(initialRegion);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromQuery = searchParams.get('from') ?? undefined;
  const successFlag = searchParams.get('success');
  const canceledFlag = searchParams.get('canceled');

  // Show the success banner once and clean up the URL.
  useEffect(() => {
    if (successFlag) {
      // Brief delay so the banner renders before we strip query params.
      const id = window.setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('success');
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url.toString());
      }, 1500);
      return () => window.clearTimeout(id);
    }
  }, [successFlag]);

  async function startCheckout() {
    if (!open) return;
    setSubmitting(true);
    setError(null);

    if (!user) {
      // Send unsigned-in users to login, then bring them back.
      const ret = `/pricing?from=${encodeURIComponent(fromQuery ?? 'pricing')}&region=${encodeURIComponent(region)}&plan=${open}`;
      router.push(`/login?next=${encodeURIComponent(ret)}`);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('No session token. Please sign in again.');
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan: open, region, from: fromQuery }),
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error ?? 'Checkout failed');
      }

      if (body.redirect) {
        // "Other" region → waitlist flow.
        router.push(body.redirect);
        return;
      }

      if (body.url) {
        window.location.href = body.url;
        return;
      }

      throw new Error('Unexpected checkout response');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start checkout';
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <>
      {successFlag && (
        <div className="mt-6">
          <div className="bg-rc-good-bg border border-rc-good-border rounded-lg p-4 text-sm text-rc-good-ink">
            Welcome to Pro Intel — your account is unlocked. It may take a few seconds for the badge to appear.
          </div>
        </div>
      )}
      {canceledFlag && (
        <div className="mt-6">
          <div className="bg-rc-fair-bg border border-rc-fair-border rounded-lg p-4 text-sm text-rc-fair-ink">
            Checkout canceled. No charge was made.
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <button
          type="button"
          onClick={() => setOpen('annual')}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center px-5 py-3 bg-rc-brand text-white text-sm font-bold rounded-md hover:bg-rc-brand-hover transition-colors disabled:opacity-60"
        >
          Get Season Pass — $79/yr
        </button>
        <button
          type="button"
          onClick={() => setOpen('monthly')}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center px-5 py-3 border border-rc-brand bg-rc-panel text-rc-brand text-sm font-bold rounded-md hover:bg-rc-brand-soft transition-colors disabled:opacity-60"
        >
          Go Monthly — ${monthlyDollarsNow}/mo this month
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-rc-ink/50 flex items-center justify-center p-4"
          onClick={() => !submitting && setOpen(null)}
        >
          <div
            className="bg-rc-panel border border-rc-rule rounded-xl shadow-rc-panel max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-rc-ink mb-1">
              {open === 'annual' ? 'Season Pass — $79/yr' : `Monthly — $${monthlyDollarsNow}/mo`}
            </h2>
            <p className="text-sm text-rc-ink-mute mb-5">
              Where do you mostly fish? We&apos;re live in BC, WA, and OR.
            </p>

            <label className="block text-xs font-medium text-rc-ink-mute uppercase tracking-wide mb-1.5">
              Primary region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={submitting}
              className="w-full bg-rc-surface border border-rc-rule rounded-lg px-3 py-2.5 text-sm text-rc-ink mb-4 focus:outline-none focus:ring-2 focus:ring-rc-brand"
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            {region === 'Other' && (
              <p className="text-xs text-rc-fair-ink bg-rc-fair-bg border border-rc-fair-border rounded-md p-3 mb-4">
                Pro Intel isn&apos;t live in your region yet. We&apos;ll redirect you to drop a waitlist pin.
              </p>
            )}

            {error && (
              <p className="text-xs text-rc-poor-ink bg-rc-poor-bg border border-rc-poor/30 rounded-md p-3 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(null)}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-rc-panel border border-rc-rule rounded-lg text-sm font-medium text-rc-ink hover:border-rc-brand/40 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startCheckout}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-rc-brand hover:bg-rc-brand-hover rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-60"
              >
                {submitting
                  ? 'Starting…'
                  : region === 'Other'
                    ? 'Drop a waitlist pin'
                    : 'Continue to checkout →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
