'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useUpgradeFlow } from '@/hooks/use-upgrade-flow';
import { cn } from '@/lib/utils';
import {
  ANNUAL_PRICE_CENTS,
  MONTHLY_PRICE_CENTS,
  TRIAL_DAYS,
  annualDiscount,
  type PricingPlan,
} from '@/lib/pricing';

/**
 * Cadence choice + the button that opens Stripe, shared by every in-app
 * paywall (the /explore plan-matrix modal and the UnlockWithProCard used by
 * spot cards, the spot drawer, /alerts and /support).
 *
 * These surfaces used to link to /plans, so the terms lived on
 * /plans/checkout. Going straight to Stripe means the disclosure has to travel
 * with the button: the renewal amount and the date the card is charged are
 * stated HERE, right above the CTA, for the cadence actually selected. A
 * card-required trial that auto-charges has to say so before the click
 * (Canadian consumer-protection rules, US FTC negative-option rule) — that is
 * why this component fetches eligibility rather than assuming a trial.
 *
 * Trial eligibility is resolved server-side before the button is drawn, so a
 * repeat customer is shown paid terms instead of a trial the checkout would
 * refuse. On any failure it falls back to paid terms: understating the offer
 * is the safe direction to fail.
 */

interface CheckoutStatus {
  is_active: boolean;
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
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface TrialCtaProps {
  /** Analytics origin passed to Stripe metadata ('explore', 'paywall', …). */
  from: string;
  /**
   * Sells an ACCOUNT rather than a subscription (a signed-out visitor blocked
   * by something a free account unlocks). Renders one plain link to this href
   * with no cadence choice — charging for what's free would be a lie.
   */
  signupHref?: string;
  /** Label for the `signupHref` link. */
  signupLabel?: string;
  /** Light panel (modals, /support) vs the dark Explore surfaces. */
  theme?: 'light' | 'dark';
  className?: string;
  /** Fires on any CTA activation, for the caller's own analytics. */
  onActivate?: (plan: PricingPlan | null) => void;
}

export default function TrialCta({
  from,
  signupHref,
  signupLabel,
  theme = 'light',
  className,
  onActivate,
}: TrialCtaProps) {
  const { user, loading: authLoading } = useAuth();
  const { openCheckout, loading: submitting, error } = useUpgradeFlow();
  const { pct } = annualDiscount();

  const [plan, setPlan] = useState<PricingPlan>('annual');
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

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
        // Paid terms are the safe fallback — never promise an unconfirmed trial.
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const isLight = theme === 'light';
  const yearly = plan === 'annual';
  // Signed out: Stripe needs a Supabase user, so the cadence choice carries
  // into /plans/checkout (which signs them in and hands off) instead of
  // POSTing. That page re-resolves eligibility, so an optimistic trial here is
  // corrected before any card is taken.
  const anon = !authLoading && !user;
  const trialOn = anon || Boolean(status?.trial_available);
  const trialDays = status?.trial_days ?? TRIAL_DAYS;
  const priceCents = yearly ? ANNUAL_PRICE_CENTS : MONTHLY_PRICE_CENTS;
  const periodWord = yearly ? 'year' : 'month';
  const chargeDate = useMemo(
    () => longDate(trialOn ? addDays(trialDays) : new Date()),
    [trialOn, trialDays],
  );

  const subtle = isLight ? 'text-rc-ink-mute' : 'text-rc-text-muted';
  const linkClass = isLight
    ? 'text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover'
    : 'text-white underline underline-offset-2';

  // Selling an account, not a subscription — one link, no cadence, no terms.
  if (signupHref) {
    return (
      <Link
        href={signupHref}
        data-testid="trial-cta-anon"
        onClick={() => onActivate?.(null)}
        className={cn(
          'inline-flex w-full items-center justify-center rounded-lg bg-rc-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2',
          className,
        )}
      >
        {signupLabel ?? 'Create free account'}
      </Link>
    );
  }

  // Already paying — don't sell Pro to a Pro member.
  if (status?.is_active) {
    return (
      <Link
        href="/profile"
        className={cn(
          'inline-flex w-full items-center justify-center rounded-lg border border-rc-rule px-4 py-2.5 text-sm font-semibold transition-colors',
          isLight ? 'text-rc-ink hover:bg-rc-surface' : 'text-rc-text',
          className,
        )}
      >
        Manage subscription
      </Link>
    );
  }

  const busy = authLoading || (!anon && statusLoading);
  const ctaClass =
    'inline-flex w-full items-center justify-center rounded-lg bg-rc-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';
  const checkoutHref = `/plans/checkout?plan=${plan}&from=${encodeURIComponent(from)}`;
  const ctaLabel = trialOn
    ? `Start ${trialDays}-day free trial`
    : `Get Pro · ${dollars(priceCents)}/${periodWord}`;
  // Only yearly depends on STRIPE_ANNUAL_PRICE_ID; a missing annual price must
  // not take monthly checkout down with it.
  const annualDown = Boolean(status && !status.annual_available);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Cadence choice. One selection drives one disclosure — two independent
          buy buttons could not state which price is about to be charged. */}
      <div
        role="group"
        aria-label="Billing cadence"
        className={cn(
          'inline-flex self-start rounded-full border p-1',
          isLight ? 'border-rc-rule bg-rc-surface' : 'border-rc-bg-light bg-rc-bg-darkest',
        )}
      >
        <button
          type="button"
          aria-pressed={yearly}
          disabled={annualDown}
          onClick={() => setPlan('annual')}
          data-testid="cadence-annual"
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40',
            yearly
              ? 'bg-rc-brand text-white shadow-sm'
              : isLight
                ? 'text-rc-ink-soft hover:text-rc-ink'
                : 'text-rc-text-muted hover:text-rc-text',
          )}
        >
          Yearly
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 font-rc-mono text-[10px] font-bold leading-none',
              yearly ? 'bg-white/20 text-white' : 'bg-rc-good-bg text-rc-good-ink',
            )}
          >
            −{pct}%
          </span>
        </button>
        <button
          type="button"
          aria-pressed={!yearly}
          onClick={() => setPlan('monthly')}
          data-testid="cadence-monthly"
          className={cn(
            'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
            !yearly
              ? 'bg-rc-brand text-white shadow-sm'
              : isLight
                ? 'text-rc-ink-soft hover:text-rc-ink'
                : 'text-rc-text-muted hover:text-rc-text',
          )}
        >
          Monthly
        </button>
      </div>

      {anon ? (
        <Link
          href={checkoutHref}
          data-testid="trial-cta"
          data-plan={plan}
          onClick={() => onActivate?.(plan)}
          className={ctaClass}
        >
          {ctaLabel}
        </Link>
      ) : (
        <button
          type="button"
          disabled={busy || submitting}
          data-testid="trial-cta"
          data-plan={plan}
          onClick={() => {
            onActivate?.(plan);
            openCheckout({ plan, from }).catch(() => {
              /* surfaced through `error` below */
            });
          }}
          className={ctaClass}
        >
          {submitting ? 'Starting…' : busy ? 'Loading…' : ctaLabel}
        </button>
      )}

      {/* Auto-renewal disclosure. Required, and deliberately not buried. */}
      {!busy && (
        <p className={cn('text-[11px] leading-relaxed', subtle)}>
          {trialOn ? (
            <>
              You won’t be charged today. On <strong>{chargeDate}</strong> your
              card is charged <strong>{dollars(priceCents)}</strong> for one{' '}
              {periodWord}, renewing at that price until you cancel. Cancel
              anytime before then from your account and you won’t be charged.
            </>
          ) : (
            <>
              Your card is charged <strong>{dollars(priceCents)}</strong> today
              for one {periodWord} of Pro, and renews {yearly ? 'yearly' : 'monthly'}{' '}
              at that price until you cancel. Cancel anytime from your account.
            </>
          )}{' '}
          <Link href="/terms" className={linkClass}>
            Terms
          </Link>
          {' · '}
          <Link href="/privacy" className={linkClass}>
            Privacy
          </Link>
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-rc-poor/30 bg-rc-poor-bg p-2.5 text-xs text-rc-poor-ink"
        >
          We couldn’t start checkout. Please try again in a moment.
        </p>
      )}
    </div>
  );
}
