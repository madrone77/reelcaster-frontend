'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useStartCheckout } from '@/hooks/use-start-checkout';
import {
  ANNUAL_PRICE_CENTS,
  MONTHLY_PRICE_CENTS,
  TRIAL_DAYS,
  annualDiscount,
  type PricingPlan,
} from '@/lib/pricing';

// Regions Pro is sold in. There is no longer a picker — the CTA goes straight
// to Stripe — so this is only the allow-list for a region arriving by `?region=`
// or IP geo. Anything else (including 'Other') is handled server-side: the
// checkout route bounces uncovered regions to the waitlist and falls back to
// the request's IP country for currency.
const REGION_VALUES = ['BC', 'WA', 'OR', 'Other'];

const FEATURES = [
  '14-day hourly forecasts',
  'Custom alerts (email + SMS)',
  'Custom spot profiles with full enrichment',
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
  const searchParams = useSearchParams();
  const { loading } = useAuth();
  const { startCheckout, submitting, error } = useStartCheckout();

  const { fullCents, saveCents, pct, perMonthCents } = annualDiscount();

  const region = useMemo(() => {
    const fromUrl = searchParams.get('region');
    if (fromUrl && REGION_VALUES.includes(fromUrl)) return fromUrl;
    if (defaultRegion && REGION_VALUES.includes(defaultRegion))
      return defaultRegion;
    return 'BC';
  }, [searchParams, defaultRegion]);

  // Deep links can preselect the cadence (?plan=annual). Default to yearly —
  // it's the better deal and the one we want to lead with.
  const initialPlan: PricingPlan =
    searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual';

  const [plan, setPlan] = useState<PricingPlan>(initialPlan);

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

  // Signed-out visitors come back to this exact card (cadence + region intact)
  // after logging in, then continue to Stripe.
  const signedOutHref = `/login?next=${encodeURIComponent(
    `/pricing?from=${encodeURIComponent(fromQuery ?? 'pricing')}&region=${encodeURIComponent(region)}&plan=${plan}`,
  )}`;

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
        {/* Cadence toggle — a two-state segmented control (group + aria-pressed),
            not a tablist: there is no tabpanel and no arrow-key nav to honor. */}
        <div
          role="group"
          aria-label="Billing cadence"
          className="inline-flex rounded-full border border-rc-rule bg-rc-surface p-1"
        >
          <button
            type="button"
            aria-pressed={!yearly}
            onClick={() => setPlan('monthly')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 ${
              !yearly
                ? 'bg-rc-brand text-white shadow-sm'
                : 'text-rc-ink-soft hover:text-rc-ink'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={yearly}
            onClick={() => setPlan('annual')}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 ${
              yearly
                ? 'bg-rc-brand text-white shadow-sm'
                : 'text-rc-ink-soft hover:text-rc-ink'
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

        {/* Price — aria-live so toggling announces the new cadence + price.
            Scoped to price + subline only; the celebration box below is left
            out, keeping Monthly math-free for assistive tech too. */}
        <div className="mt-6" aria-live="polite" aria-atomic="true">
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-black tracking-[-0.03em] text-rc-ink">
              {dollars(yearly ? ANNUAL_PRICE_CENTS : MONTHLY_PRICE_CENTS)}
            </span>
            <span className="text-base font-medium text-rc-ink-mute">
              / {yearly ? 'year' : 'month'}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-rc-ink-soft">
            <strong className="text-rc-ink">
              First {TRIAL_DAYS} days free
            </strong>{' '}
            — then{' '}
            {dollars(yearly ? ANNUAL_PRICE_CENTS : MONTHLY_PRICE_CENTS)}/
            {yearly ? 'year' : 'month'}. Cancel anytime.
          </p>
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
                  aria-label={`Switch to yearly billing — ${dollars(
                    ANNUAL_PRICE_CENTS,
                  )} per year`}
                  className="rounded-sm font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
                >
                  {dollars(ANNUAL_PRICE_CENTS)}/year
                </button>{' '}
                and save {pct}%.
              </>
            )}
          </p>
        </div>

        {/* Savings celebration — YEARLY only. It collapses (not unmounts) on
            toggle so the CTA never snaps; on Monthly it's zero-height +
            aria-hidden, so the discount math is neither seen nor announced and
            the card rests calm on $5/mo. The only monthly nudge is the
            "$33/year" subline above and the toggle's −45% pill. */}
        <div
          aria-hidden={!yearly}
          className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
            yearly
              ? 'mt-5 grid-rows-[1fr] opacity-100'
              : 'mt-0 grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded-lg border border-rc-good-border bg-rc-good-bg p-3.5">
              {/* Payoff — the single loudest mark; rc-good-ink for 7:1 contrast */}
              <span className="inline-block rounded bg-rc-good-ink px-2 py-0.5 font-rc-mono text-[11px] font-bold tracking-tight text-white">
                SAVE {dollars(saveCents)} · {pct}% OFF
              </span>
              {/* Before → now: hierarchy on weight + strikethrough, not color */}
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="text-rc-good-ink line-through">
                  {dollars(fullCents)}/yr
                </span>
                <span aria-hidden className="text-rc-good-ink/70">
                  →
                </span>
                <span className="font-bold text-rc-ink">
                  {dollars(ANNUAL_PRICE_CENTS)}/yr
                </span>
              </div>
              <p className="mt-1.5 font-rc-mono text-[11px] text-rc-good-ink">
                Twelve months at {dollars(MONTHLY_PRICE_CENTS)} would be{' '}
                {dollars(fullCents)} — the yearly plan is {pct}% off.
              </p>
            </div>
          </div>
        </div>

        {/* CTA — straight to Stripe. There is no region step in between: the
            region comes from `?region=` or IP geo, and checkout resolves the
            currency (and the uncovered-region waitlist bounce) server-side. */}
        <button
          type="button"
          onClick={() =>
            startCheckout({ plan, region, from: fromQuery, signedOutHref })
          }
          disabled={loading || submitting}
          className="mt-6 flex w-full items-center justify-center rounded-md bg-rc-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {submitting ? 'Starting…' : `Start ${TRIAL_DAYS}-day free trial`}
        </button>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-rc-poor/30 bg-rc-poor-bg p-3 text-xs text-rc-poor-ink"
          >
            {error}
          </p>
        )}

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
    </div>
  );
}
