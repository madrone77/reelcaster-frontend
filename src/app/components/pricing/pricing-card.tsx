'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import {
  ANNUAL_PRICE_CENTS,
  MONTHLY_PRICE_CENTS,
  annualDiscount,
  type PricingPlan,
} from '@/lib/pricing';

const REGIONS = [
  { value: 'BC', label: 'British Columbia' },
  { value: 'WA', label: 'Washington' },
  { value: 'OR', label: 'Oregon' },
  { value: 'Other', label: 'Somewhere else' },
];

const FEATURES = [
  '14-day hourly forecasts',
  'Up to 10 custom alerts (email + SMS)',
  'Custom spot profiles with full enrichment',
  'Priority during emerging hot bites',
  'Cancel anytime',
];

// $5, $33, $2.75 — drop the cents when they're zero.
function dollars(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

export default function PricingCard({
  defaultRegion,
}: {
  defaultRegion: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const { fullCents, saveCents, pct, perMonthCents } = annualDiscount();

  const initialRegion = useMemo(() => {
    const fromUrl = searchParams.get('region');
    if (fromUrl && REGIONS.some((r) => r.value === fromUrl)) return fromUrl;
    if (defaultRegion && REGIONS.some((r) => r.value === defaultRegion))
      return defaultRegion;
    return 'BC';
  }, [searchParams, defaultRegion]);

  // Deep links can preselect the cadence (?plan=annual). Default to yearly —
  // it's the better deal and the one we want to lead with.
  const initialPlan: PricingPlan =
    searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual';

  const [plan, setPlan] = useState<PricingPlan>(initialPlan);
  const [modalOpen, setModalOpen] = useState(false);
  const [region, setRegion] = useState(initialRegion);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromQuery = searchParams.get('from') ?? undefined;
  const successFlag = searchParams.get('success');
  const canceledFlag = searchParams.get('canceled');

  useEffect(() => {
    if (successFlag) {
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
    setSubmitting(true);
    setError(null);

    if (!user) {
      const ret = `/pricing?from=${encodeURIComponent(
        fromQuery ?? 'pricing',
      )}&region=${encodeURIComponent(region)}&plan=${plan}`;
      router.push(`/login?next=${encodeURIComponent(ret)}`);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('No session token. Please sign in again.');

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan, region, from: fromQuery }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Checkout failed');

      if (body.redirect) {
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

  const yearly = plan === 'annual';

  return (
    <div className="mt-8 max-w-md">
      {successFlag && (
        <div className="mb-5 rounded-lg border border-rc-good-border bg-rc-good-bg p-4 text-sm text-rc-good-ink">
          Welcome to Pro — your account is unlocked. It may take a few seconds
          for the badge to appear.
        </div>
      )}
      {canceledFlag && (
        <div className="mb-5 rounded-lg border border-rc-fair-border bg-rc-fair-bg p-4 text-sm text-rc-fair-ink">
          Checkout canceled. No charge was made.
        </div>
      )}

      <div className="relative rounded-xl border border-rc-rule bg-rc-panel p-6 shadow-rc-panel md:p-8">
        {/* Cadence toggle */}
        <div
          role="tablist"
          aria-label="Billing cadence"
          className="inline-flex rounded-full border border-rc-rule bg-rc-surface p-1"
        >
          <button
            role="tab"
            aria-selected={!yearly}
            onClick={() => setPlan('monthly')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              !yearly
                ? 'bg-rc-brand text-white shadow-sm'
                : 'text-rc-ink-mute hover:text-rc-ink'
            }`}
          >
            Monthly
          </button>
          <button
            role="tab"
            aria-selected={yearly}
            onClick={() => setPlan('annual')}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              yearly
                ? 'bg-rc-brand text-white shadow-sm'
                : 'text-rc-ink-mute hover:text-rc-ink'
            }`}
          >
            Yearly
            <span
              className={`rounded-full px-1.5 py-0.5 font-rc-mono text-[10px] font-bold leading-none tracking-tight ${
                yearly
                  ? 'bg-white/20 text-white'
                  : 'bg-rc-good-bg text-rc-good-ink'
              }`}
            >
              −{pct}%
            </span>
          </button>
        </div>

        {/* Price */}
        <div className="mt-6">
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-black tracking-[-0.03em] text-rc-ink">
              {dollars(yearly ? ANNUAL_PRICE_CENTS : MONTHLY_PRICE_CENTS)}
            </span>
            <span className="text-base font-medium text-rc-ink-mute">
              / {yearly ? 'year' : 'month'}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-rc-ink-soft">
            {yearly ? (
              <>
                That&apos;s just{' '}
                <strong className="text-rc-ink">{dollars(perMonthCents)}/mo</strong>,
                billed annually.
              </>
            ) : (
              <>
                Or pay yearly —{' '}
                <button
                  type="button"
                  onClick={() => setPlan('annual')}
                  className="font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
                >
                  {dollars(ANNUAL_PRICE_CENTS)}/year
                </button>{' '}
                and save {pct}%.
              </>
            )}
          </p>
        </div>

        {/* The math — 12 months would be $60; you pay $33; save $27 (45%). */}
        <div
          className={`mt-5 rounded-lg border p-3.5 transition-colors ${
            yearly
              ? 'border-rc-good-border bg-rc-good-bg'
              : 'border-rc-rule bg-rc-surface'
          }`}
        >
          <span
            className={`inline-block rounded px-2 py-0.5 font-rc-mono text-[11px] font-bold tracking-tight ${
              yearly ? 'bg-rc-good text-white' : 'bg-rc-good-bg text-rc-good-ink'
            }`}
          >
            SAVE {dollars(saveCents)} · {pct}% OFF
          </span>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="text-rc-ink-mute line-through">
              {dollars(fullCents)}/yr
            </span>
            <span aria-hidden className="text-rc-ink-mute">
              →
            </span>
            <span className="font-bold text-rc-ink">
              {dollars(ANNUAL_PRICE_CENTS)}/yr
            </span>
          </div>
          <p className="mt-1.5 font-rc-mono text-[11px] text-rc-ink-mute">
            Twelve months at {dollars(MONTHLY_PRICE_CENTS)} would be{' '}
            {dollars(fullCents)} — the yearly plan is {pct}% off.
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center rounded-md bg-rc-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover disabled:opacity-60"
        >
          {yearly
            ? `Get Pro yearly — ${dollars(ANNUAL_PRICE_CENTS)}/yr`
            : `Get Pro monthly — ${dollars(MONTHLY_PRICE_CENTS)}/mo`}
        </button>

        {/* Features */}
        <ul className="mt-6 space-y-2 border-t border-rc-rule pt-6 text-sm text-rc-ink-soft">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="mt-0.5 text-rc-good">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Region modal → checkout */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rc-ink/50 p-4"
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-rc-rule bg-rc-panel p-6 shadow-rc-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-xl font-bold text-rc-ink">
              {yearly
                ? `ReelCaster Pro — ${dollars(ANNUAL_PRICE_CENTS)}/yr`
                : `ReelCaster Pro — ${dollars(MONTHLY_PRICE_CENTS)}/mo`}
            </h2>
            <p className="mb-5 text-sm text-rc-ink-mute">
              Where do you mostly fish? We&apos;re live in BC, WA, and OR.
            </p>

            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-rc-ink-mute">
              Primary region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={submitting}
              className="mb-4 w-full rounded-lg border border-rc-rule bg-rc-surface px-3 py-2.5 text-sm text-rc-ink focus:outline-none focus:ring-2 focus:ring-rc-brand"
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            {region === 'Other' && (
              <p className="mb-4 rounded-md border border-rc-fair-border bg-rc-fair-bg p-3 text-xs text-rc-fair-ink">
                Pro isn&apos;t live in your region yet. We&apos;ll redirect you
                to drop a waitlist pin.
              </p>
            )}

            {error && (
              <p className="mb-4 rounded-md border border-rc-poor/30 bg-rc-poor-bg p-3 text-xs text-rc-poor-ink">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-rc-rule bg-rc-panel px-4 py-2.5 text-sm font-medium text-rc-ink transition-colors hover:border-rc-brand/40 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startCheckout}
                disabled={submitting}
                className="flex-1 rounded-lg bg-rc-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover disabled:opacity-60"
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
    </div>
  );
}
