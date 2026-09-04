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
import TrialCta from '@/app/components/paywall/trial-cta';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import {
  currencyForRegion,
  TRIAL_DAYS,
  dollars,
} from '@/lib/pricing';
import { usePricingIn } from '@/app/components/split-test/use-pricing';
import { useSplitExposure } from '@/app/components/split-test/report';

/** Pay-first checkout — see src/app/components/paywall/trial-cta.tsx. */
const PAY_FIRST = process.env.NEXT_PUBLIC_PAY_FIRST_CHECKOUT === '1';

const REGIONS = [
  { value: 'BC', label: 'British Columbia' },
  { value: 'WA', label: 'Washington' },
  // Oregon deliberately absent: no published cities, so it belongs behind
  // "Somewhere else", which routes to the waitlist instead of taking money.
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
  'Cancel anytime, your Member account stays',
];

interface CheckoutStatus {
  is_active: boolean;
  tier: string;
  status: string;
  trial_available: boolean;
  trial_days: number;
  annual_available: boolean;
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

  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [region, setRegion] = useState(
    () => searchParams.get('region') ?? defaultRegion ?? 'BC',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromQuery = searchParams.get('from') ?? 'plans-checkout';


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
    trackEvent('Checkout Started', {
      surface: 'plans',
      region,
      from: fromQuery,
      trial_available: status?.trial_available,
      trial_days: status?.trial_days,
      signed_in: true,
    });
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
        body: JSON.stringify({ region, from: fromQuery }),
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(
          body.error === 'plan_unavailable'
            ? 'Pro isn’t available to buy right now. Please try again shortly.'
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
  }, [region, fromQuery, router, status]);

  // The trial is granted per checkout session by the checkout route, not baked
  // into the Stripe Price — see /support, which documents it that way.
  const trialOn = Boolean(status?.trial_available);
  const trialDays = status?.trial_days ?? 7;

  // Follows the region dropdown, because the arms are not the same amount in
  // both currencies any more: a reader who switches from Washington to British
  // Columbia is switching from one price to another, not merely relabelling
  // the same one. Every number below reads off this, so the summary, the total
  // and the button cannot disagree.
  const pricing = usePricingIn(currencyForRegion(region));
  const priceCents = pricing.cents;
  const perMonthCents = pricing.perMonthCents;
  const periodWord = 'year';

  // The order summary is the last surface before Stripe, so its exposure is
  // the denominator closest to the decision.
  useSplitExposure(pricing, 'checkout');
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
    // Carry the whole query back: `next=/plans/checkout` alone silently reset
    // a Monthly buyer to the annual default on the way back from signing in.
    const qs = searchParams.toString();
    const returnTo = `/plans/checkout${qs ? `?${qs}` : ''}`;

    // Pay-first: no account needed. Checkout collects the email and the card,
    // and the account is provisioned from it afterwards. Signing in is the
    // secondary path, for someone who already has one.
    if (PAY_FIRST) {
      return (
        <div className="rounded-xl border border-rc-rule bg-rc-panel p-6 shadow-rc-panel md:p-8">
          <h2 className="text-xl font-bold text-rc-ink">
            Start your {TRIAL_DAYS}-day free trial
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
            No account needed to start. We&apos;ll set one up from the email
            you check out with, and sign you in when you land back here.
          </p>

          <div className="mt-6">
            {/* region matters here: this is the anonymous pay-first path that
                cold ad traffic lands on, and without it the Stripe session is
                priced from IP geo alone and falls back to CAD. The value is
                already resolved above from ?region= or the edge geo header. */}
            <TrialCta from={fromQuery} region={region} theme="light" />
          </div>

          <p className="mt-5 text-sm text-rc-ink-mute">
            Already have an account?{' '}
            <Link
              href={`/login?next=${encodeURIComponent(returnTo)}`}
              className="font-semibold text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
            >
              Sign in
            </Link>
            .
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-rc-rule bg-rc-panel p-6 shadow-rc-panel md:p-8">
        <h2 className="text-xl font-bold text-rc-ink">Sign in to continue</h2>
        <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
          Your trial and subscription are tied to your ReelCaster account, so
          we need you signed in before checkout.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(returnTo)}`}
          className="mt-5 inline-flex items-center justify-center rounded-md bg-rc-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
        >
          Sign in
        </Link>
        <p className="mt-3 text-sm text-rc-ink-mute">
          No account?{' '}
          <Link
            href={`/signup?next=${encodeURIComponent(returnTo)}`}
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
            ? 'Your trial is running, nothing more to do right now.'
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

  // The one plan depends on STRIPE_ANNUAL_PRICE_ID; without it there is
  // nothing to sell, so the button goes down with it.
  const annualDown = status ? !status.annual_available : false;

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
              Full Pro from the moment you finish: every feature, no limits
              for {trialDays} days.
            </>
          ) : (
            <>
              Every Pro feature, billed yearly at {dollars(priceCents)},{' '}
              {dollars(perMonthCents)} a month.
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
          Your spots, your catch log, and your 7-day forecast stay free forever;
          you just lose the Pro extras.
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
              ReelCaster Pro, yearly
            </span>
            <span className="text-sm font-semibold text-rc-ink">
              {dollars(priceCents)}/yr
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-3 text-sm text-rc-ink-mute">
            <span>Works out to {dollars(perMonthCents)} a month</span>
            <span>Renews yearly until you cancel</span>
          </div>

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
              Free for {trialDays} days, then {dollars(priceCents)} a{' '}
              {periodWord}.
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
              Pro is temporarily unavailable to buy. Please check back shortly.
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
                  : `Subscribe · ${dollars(priceCents)}/yr`}
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
            Card entered securely on Stripe, and we never see it
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
                    {dollars(priceCents)}
                  </strong>{' '}
                  for one {periodWord}, and renews yearly at that price until
                  you cancel. Cancel anytime before then from your account and
                  you won’t be charged. We’ll email you 3 days before the trial
                  ends.
                </>
              ) : (
                <>
                  Your card is charged{' '}
                  <strong className="text-rc-ink-soft">
                    {dollars(priceCents)}
                  </strong>{' '}
                  today for one {periodWord} of Pro, and renews yearly at that
                  price until you cancel. Cancel anytime from your account.
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
          One plan, {dollars(priceCents)} a year. Every city we cover,
          nothing else to choose.
        </p>
      </div>
    </div>
  );
}
