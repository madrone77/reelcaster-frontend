'use client';

/**
 * /plans/checkout — the order summary that hands off to Stripe Checkout.
 *
 * Card details are never collected here. Stripe's hosted Checkout takes the
 * card; this page's job is to state the terms plainly before the customer
 * leaves, because a card-required trial that auto-charges needs the date and
 * the amount disclosed up front (Canadian consumer-protection rules, US FTC
 * negative-option rule).
 *
 * Trial eligibility is resolved server-side BEFORE the button is drawn. A
 * repeat customer sees paid terms rather than a trial promise the checkout
 * would then quietly break — and is never told why, since the whole point of
 * the pre-checkout guards is that they're silent.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

/**
 * Live features only. This is a payment page — anything listed here has to
 * work the moment the charge clears.
 */
const HEADLINE_FEATURES = [
  'Plan the full two weeks',
  'Add your own private spots',
  'Get alerted when it’s on',
  'Get that alert by text',
];

const MORE_FEATURES = [
  'Save every spot you fish',
  'Every covered city, one price',
  'Cancel anytime — your free account stays',
];

interface CheckoutStatus {
  is_active: boolean;
  tier: string;
  status: string;
  trial_available: boolean;
  trial_days: number;
  annual_available: boolean;
}

function dollars(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function longDate(d: Date): string {
  return d.toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-0.5 h-4 w-4 flex-shrink-0 text-rc-brand"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

export default function CheckoutPanel({
  defaultRegion,
}: {
  defaultRegion: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const { pct } = annualDiscount();

  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [region, setRegion] = useState(
    () => searchParams.get('region') ?? defaultRegion ?? 'BC',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromQuery = searchParams.get('from') ?? 'plans-checkout';

  // Yearly is the default and the one the trial rides on. `?plan=monthly` is
  // the deep link the old /pricing page used to own — monthly is instant-charge
  // with no trial, and this page is the only place it can be bought now.
  const plan: PricingPlan =
    searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual';
  const yearly = plan === 'annual';

  // Resolve trial eligibility + current subscription before drawing terms.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatusLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('no session');

        const res = await fetch('/api/stripe/checkout', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('status fetch failed');
        const body = (await res.json()) as CheckoutStatus;
        if (!cancelled) setStatus(body);
      } catch {
        // Fall back to paid-terms copy. Understating the offer is the safe
        // direction to fail — never promise a trial we haven't confirmed.
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const startCheckout = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Your session expired. Please sign in again.');

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, region, from: fromQuery }),
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(
          body.error === 'plan_unavailable'
            ? `The ${yearly ? 'yearly' : 'monthly'} plan isn’t available right now. Please try again shortly.`
            : (body.message ?? body.error ?? 'Could not start checkout'),
        );
      }

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
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setSubmitting(false);
    }
  }, [plan, yearly, region, fromQuery, router]);

  // Monthly is instant-charge: the trial exists only on the yearly plan.
  const trialOn = yearly && Boolean(status?.trial_available);
  const trialDays = status?.trial_days ?? 7;
  const priceCents = yearly ? ANNUAL_PRICE_CENTS : MONTHLY_PRICE_CENTS;
  const periodWord = yearly ? 'year' : 'month';
  const chargeDate = useMemo(
    () => longDate(trialOn ? addDays(trialDays) : new Date()),
    [trialOn, trialDays],
  );

  // ── Gate states ────────────────────────────────────────────────────

  if (authLoading || (user && statusLoading)) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true">
        <div className="h-8 w-2/3 rounded bg-rc-surface" />
        <div className="h-4 w-full rounded bg-rc-surface" />
        <div className="h-4 w-5/6 rounded bg-rc-surface" />
        <div className="h-32 w-full rounded-xl bg-rc-surface" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-rc-rule bg-rc-panel p-6 shadow-rc-panel md:p-8">
        <h2 className="text-xl font-bold text-rc-ink">Sign in to continue</h2>
        <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
          Your trial and subscription are tied to your ReelCaster account, so
          we need you signed in before checkout.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent('/plans/checkout')}`}
          className="mt-5 inline-flex items-center justify-center rounded-md bg-rc-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
        >
          Sign in
        </Link>
        <p className="mt-3 text-sm text-rc-ink-mute">
          No account?{' '}
          <Link
            href={`/signup?next=${encodeURIComponent('/plans/checkout')}`}
            className="font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
          >
            Create one free
          </Link>
          .
        </p>
      </div>
    );
  }

  if (status?.is_active) {
    return (
      <div className="rounded-xl border border-rc-good-border bg-rc-good-bg p-6 shadow-rc-panel md:p-8">
        <h2 className="text-xl font-bold text-rc-ink">You’re already on Pro</h2>
        <p className="mt-2 text-sm leading-relaxed text-rc-good-ink">
          {status.status === 'trialing'
            ? 'Your trial is running — nothing more to do right now.'
            : 'Your subscription is active. Nothing to buy here.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-md bg-rc-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
          >
            Manage subscription
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-md border border-rc-rule bg-rc-panel px-5 py-3 text-sm font-semibold text-rc-ink transition-colors hover:border-rc-brand/40"
          >
            Go fishing
          </Link>
        </div>
      </div>
    );
  }

  // Only the yearly plan depends on STRIPE_ANNUAL_PRICE_ID — a missing
  // annual price must not disable monthly checkout.
  const annualDown = yearly && status ? !status.annual_available : false;

  // ── Main order summary ─────────────────────────────────────────────

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_minmax(320px,380px)] md:gap-10">
      {/* What you get */}
      <div>
        <h2 className="text-2xl font-black tracking-[-0.02em] text-rc-ink md:text-3xl">
          {trialOn
            ? `Start your ${trialDays}-day free trial`
            : 'Get ReelCaster Pro'}
        </h2>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-rc-ink-soft md:text-base">
          {trialOn ? (
            <>
              Full Pro from the moment you finish — every feature, no limits
              for {trialDays} days.
            </>
          ) : (
            <>
              Every Pro feature, billed {yearly ? 'yearly' : 'monthly'} at{' '}
              {dollars(priceCents)}.
            </>
          )}
        </p>

        <ul className="mt-6 space-y-3 text-sm text-rc-ink-soft md:text-base">
          {HEADLINE_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <Check />
              <span>{f}</span>
            </li>
          ))}
          {showAll &&
            MORE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <Check />
                <span>{f}</span>
              </li>
            ))}
        </ul>

        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-rc-ink-soft transition-colors hover:text-rc-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 6l4.5 4.5L12.5 6" />
          </svg>
          {showAll ? 'Show less' : 'Show more'}
        </button>

        {/* The differentiator worth stating at the point of payment. */}
        <div className="mt-8 rounded-lg border border-rc-rule bg-rc-surface p-4 text-sm leading-relaxed text-rc-ink-soft">
          <strong className="text-rc-ink">Cancel and nothing disappears.</strong>{' '}
          Your spots, your catch log, and your 7-day forecast stay free forever
          — you just lose the Pro extras.
        </div>
      </div>

      {/* Order summary */}
      <div className="md:sticky md:top-6 md:self-start">
        <div className="rounded-xl border border-rc-rule bg-rc-panel p-6 shadow-rc-panel">
          <h3 className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute">
            Order summary
          </h3>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <span className="text-sm text-rc-ink-soft">
              ReelCaster Pro, {yearly ? 'yearly' : 'monthly'}
            </span>
            <span className="text-sm font-semibold text-rc-ink">
              {dollars(priceCents)}/{yearly ? 'yr' : 'mo'}
            </span>
          </div>

          {yearly ? (
            <div className="mt-2 flex items-baseline justify-between gap-3 text-sm text-rc-ink-mute">
              <span>Versus {dollars(MONTHLY_PRICE_CENTS)}/mo billed monthly</span>
              <span className="font-rc-mono text-[11px] font-bold text-rc-good-ink">
                −{pct}%
              </span>
            </div>
          ) : (
            <div className="mt-2 text-sm text-rc-ink-mute">
              Renews monthly until you cancel.
            </div>
          )}

          <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-rc-rule pt-5">
            <span className="text-base font-bold text-rc-ink">Billed today</span>
            <span
              className="text-2xl font-black tracking-[-0.02em] text-rc-ink"
              aria-live="polite"
            >
              {trialOn ? '$0' : dollars(priceCents)}
            </span>
          </div>

          {trialOn && (
            <p className="mt-1.5 text-sm text-rc-ink-soft">
              Free for {trialDays} days, then {dollars(ANNUAL_PRICE_CENTS)} a
              year.
            </p>
          )}

          {/* Region — the API refuses uncovered regions rather than taking
              money for water we can't forecast. */}
          <label
            htmlFor="rc-region"
            className="mt-6 block font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute"
          >
            Where you mostly fish
          </label>
          <select
            id="rc-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-rc-rule bg-rc-surface px-3 py-2.5 text-sm text-rc-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          {region === 'Other' && (
            <p className="mt-3 rounded-md border border-rc-fair-border bg-rc-fair-bg p-3 text-xs leading-relaxed text-rc-fair-ink">
              Pro isn’t live where you fish yet, so we won’t charge you. We’ll
              take you to drop a waitlist pin instead.
            </p>
          )}

          {annualDown && (
            <p className="mt-3 rounded-md border border-rc-fair-border bg-rc-fair-bg p-3 text-xs leading-relaxed text-rc-fair-ink">
              The yearly plan is temporarily unavailable. Please check back
              shortly.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-rc-poor/30 bg-rc-poor-bg p-3 text-xs leading-relaxed text-rc-poor-ink"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={startCheckout}
            disabled={submitting || annualDown}
            className="mt-5 flex w-full items-center justify-center rounded-md bg-rc-brand px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {submitting
              ? 'Starting…'
              : region === 'Other'
                ? 'Drop a waitlist pin'
                : trialOn
                  ? `Start ${trialDays}-day free trial`
                  : `Subscribe — ${dollars(priceCents)}/${yearly ? 'yr' : 'mo'}`}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-rc-ink-mute">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <rect x="3" y="7" width="10" height="7" rx="1.5" />
              <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
            </svg>
            Card entered securely on Stripe — we never see it
          </p>

          {/* Auto-renewal disclosure. Required, and deliberately not buried. */}
          {region !== 'Other' && (
            <p className="mt-4 border-t border-rc-rule pt-4 text-xs leading-relaxed text-rc-ink-mute">
              {trialOn ? (
                <>
                  You won’t be charged today. On{' '}
                  <strong className="text-rc-ink-soft">{chargeDate}</strong>{' '}
                  your card is charged{' '}
                  <strong className="text-rc-ink-soft">
                    {dollars(ANNUAL_PRICE_CENTS)}
                  </strong>{' '}
                  for one year, and renews yearly at that price until you
                  cancel. Cancel anytime before then from your account and you
                  won’t be charged. We’ll email you 3 days before the trial
                  ends.
                </>
              ) : (
                <>
                  Your card is charged{' '}
                  <strong className="text-rc-ink-soft">
                    {dollars(priceCents)}
                  </strong>{' '}
                  today for one {periodWord} of Pro, and renews{' '}
                  {yearly ? 'yearly' : 'monthly'} at that price until you
                  cancel. Cancel anytime from your account.
                </>
              )}{' '}
              <Link
                href="/terms"
                className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
              >
                Terms
              </Link>
              {' · '}
              <Link
                href="/privacy"
                className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
              >
                Privacy
              </Link>
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-rc-ink-mute">
          {yearly ? (
            <>
              Prefer to pay monthly?{' '}
              <Link
                href="/plans/checkout?plan=monthly"
                className="font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
              >
                {dollars(MONTHLY_PRICE_CENTS)}/mo, no trial
              </Link>
            </>
          ) : (
            <>
              Pay yearly instead and save {pct}%?{' '}
              <Link
                href="/plans/checkout"
                className="font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
              >
                {dollars(ANNUAL_PRICE_CENTS)}/yr
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
