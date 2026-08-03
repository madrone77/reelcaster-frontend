'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
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
 * The buy control shared by every in-app paywall.
 *
 * Composed by default (`<TrialCta>` = cadence, buy, terms in one block), but
 * the pieces are exported separately because the plan-matrix modal spreads
 * them out: buy button up top, cadence next to the plan table, terms down at
 * the foot beside the free-signup offer. They share one provider so the
 * cadence a customer picks drives the price on the button AND the amount in
 * the terms, wherever those happen to be rendered.
 *
 * Two things here are load-bearing:
 *
 * 1. **The terms travel with the button.** Skipping /plans/checkout means the
 *    renewal amount and charge date have to be stated before the click
 *    (Canadian consumer-protection rules, US FTC negative-option rule). Short,
 *    but never absent.
 * 2. **Eligibility is resolved server-side before the button is drawn**, so a
 *    repeat customer sees paid terms rather than a trial the checkout would
 *    refuse. Any failure falls back to paid terms — understating the offer is
 *    the safe direction to fail.
 */

interface CheckoutStatus {
  is_active: boolean;
  trial_available: boolean;
  trial_days: number;
  annual_available: boolean;
}

/**
 * Pay-first checkout: a signed-out buyer goes straight to Stripe and the
 * account is created afterwards from the email Stripe billed.
 */
const PAY_FIRST = process.env.NEXT_PUBLIC_PAY_FIRST_CHECKOUT === '1';

function dollars(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** "Aug 10" — the terms line is tight, so no weekday and no year. */
function shortDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
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

interface TrialCtaState {
  plan: PricingPlan;
  setPlan: (p: PricingPlan) => void;
  status: CheckoutStatus | null;
  busy: boolean;
  anon: boolean;
  trialOn: boolean;
  trialDays: number;
  yearly: boolean;
  priceCents: number;
  periodWord: string;
  chargeDate: string;
  pct: number;
  annualDown: boolean;
  isLight: boolean;
  from: string;
  onActivate?: (plan: PricingPlan | null) => void;
  // buy
  email: string;
  setEmail: (v: string) => void;
  submitting: boolean;
  errorText: string | null;
  startAnonCheckout: () => void;
  startCheckout: () => void;
}

const Ctx = createContext<TrialCtaState | null>(null);

function useTrialCta(): TrialCtaState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('TrialCta parts must be rendered inside <TrialCtaProvider>');
  }
  return ctx;
}

export function TrialCtaProvider({
  from,
  theme = 'light',
  onActivate,
  children,
}: {
  from: string;
  theme?: 'light' | 'dark';
  onActivate?: (plan: PricingPlan | null) => void;
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { openCheckout, loading: submitting, error } = useUpgradeFlow();
  const { pct } = annualDiscount();

  const [plan, setPlan] = useState<PricingPlan>('annual');
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [anonSubmitting, setAnonSubmitting] = useState(false);
  const [anonError, setAnonError] = useState<string | null>(null);

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
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const anon = !authLoading && !user;
  // Eligibility for a signed-out buyer is checked server-side against the
  // email they type, so an optimistic `true` here never survives into the
  // session for someone who has already had a trial.
  const trialOn = anon || Boolean(status?.trial_available);
  const trialDays = status?.trial_days ?? TRIAL_DAYS;
  const yearly = plan === 'annual';
  const priceCents = yearly ? ANNUAL_PRICE_CENTS : MONTHLY_PRICE_CENTS;
  const chargeDate = useMemo(
    () => shortDate(trialOn ? addDays(trialDays) : new Date()),
    [trialOn, trialDays],
  );

  async function startAnonCheckout() {
    setAnonSubmitting(true);
    setAnonError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, from, email: email.trim() }),
      });
      let payload: { url?: string; redirect?: string; error?: string } = {};
      try {
        payload = await res.json();
      } catch {
        /* non-JSON error body */
      }
      if (!res.ok) throw new Error(payload.error ?? 'checkout_failed');
      if (payload.redirect) {
        window.location.href = payload.redirect;
        return;
      }
      if (!payload.url) throw new Error('no_url');
      window.location.href = payload.url;
    } catch {
      setAnonError('We couldn’t start checkout. Please try again in a moment.');
      setAnonSubmitting(false);
    }
  }

  const value: TrialCtaState = {
    plan,
    setPlan,
    status,
    busy: authLoading || (!anon && statusLoading),
    anon,
    trialOn,
    trialDays,
    yearly,
    priceCents,
    periodWord: yearly ? 'year' : 'month',
    chargeDate,
    pct,
    annualDown: Boolean(status && !status.annual_available),
    isLight: theme === 'light',
    from,
    onActivate,
    email,
    setEmail,
    submitting: submitting || anonSubmitting,
    errorText:
      anonError ??
      (error ? 'We couldn’t start checkout. Please try again in a moment.' : null),
    startAnonCheckout,
    startCheckout: () => {
      openCheckout({ plan, from }).catch(() => {
        /* surfaced through errorText */
      });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Yearly / Monthly. One selection drives the button price and the terms. */
export function TrialCadence({ className }: { className?: string }) {
  const s = useTrialCta();
  if (s.status?.is_active) return null;

  return (
    <div
      role="group"
      aria-label="Billing cadence"
      className={cn(
        'inline-flex rounded-full border p-1',
        s.isLight
          ? 'border-rc-rule bg-rc-surface'
          : 'border-rc-bg-light bg-rc-bg-darkest',
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={s.yearly}
        disabled={s.annualDown}
        onClick={() => s.setPlan('annual')}
        data-testid="cadence-annual"
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40',
          s.yearly
            ? 'bg-rc-brand text-white shadow-sm'
            : s.isLight
              ? 'text-rc-ink-soft hover:text-rc-ink'
              : 'text-rc-text-muted hover:text-rc-text',
        )}
      >
        Yearly
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 font-rc-mono text-[10px] font-bold leading-none',
            s.yearly ? 'bg-white/20 text-white' : 'bg-rc-good-bg text-rc-good-ink',
          )}
        >
          −{s.pct}%
        </span>
      </button>
      <button
        type="button"
        aria-pressed={!s.yearly}
        onClick={() => s.setPlan('monthly')}
        data-testid="cadence-monthly"
        className={cn(
          'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
          !s.yearly
            ? 'bg-rc-brand text-white shadow-sm'
            : s.isLight
              ? 'text-rc-ink-soft hover:text-rc-ink'
              : 'text-rc-text-muted hover:text-rc-text',
        )}
      >
        Monthly
      </button>
    </div>
  );
}

/** Email (signed out) + the button that opens Stripe. */
export function TrialBuy({
  signupHref,
  signupLabel,
  className,
}: {
  signupHref?: string;
  signupLabel?: string;
  className?: string;
}) {
  const s = useTrialCta();
  const emailFieldId = useId();

  const ctaClass =
    'inline-flex w-full items-center justify-center rounded-lg bg-rc-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';
  const ctaLabel = s.trialOn
    ? `Start ${s.trialDays}-day free trial`
    : `Get Pro · ${dollars(s.priceCents)}/${s.periodWord}`;

  // Selling an account, not a subscription.
  if (signupHref) {
    return (
      <Link
        href={signupHref}
        data-testid="trial-cta-anon"
        onClick={() => s.onActivate?.(null)}
        className={cn(ctaClass, className)}
      >
        {signupLabel ?? 'Create free account'}
      </Link>
    );
  }

  // Already paying — don't sell Pro to a Pro member.
  if (s.status?.is_active) {
    return (
      <Link
        href="/profile"
        className={cn(
          'inline-flex w-full items-center justify-center rounded-lg border border-rc-rule px-4 py-2.5 text-sm font-semibold transition-colors',
          s.isLight ? 'text-rc-ink hover:bg-rc-surface' : 'text-rc-text',
          className,
        )}
      >
        Manage subscription
      </Link>
    );
  }

  const subtle = s.isLight ? 'text-rc-ink-mute' : 'text-rc-text-muted';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {s.anon && PAY_FIRST ? (
        // Pay first, sign up never: one email field, no password, no account.
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            s.onActivate?.(s.plan);
            s.startAnonCheckout();
          }}
        >
          <label htmlFor={emailFieldId} className={cn('text-xs', subtle)}>
            Your email — we’ll set up your account after checkout, no password
            needed.
          </label>
          <input
            id={emailFieldId}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={s.email}
            onChange={(e) => s.setEmail(e.target.value)}
            placeholder="angler@example.com"
            disabled={s.submitting}
            className={cn(
              'w-full rounded-lg border px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60',
              s.isLight
                ? 'border-rc-rule bg-rc-surface text-rc-ink placeholder:text-rc-ink-mute'
                : 'border-rc-bg-light bg-rc-bg-light text-rc-text placeholder:text-rc-text-muted',
            )}
          />
          <button
            type="submit"
            data-testid="trial-cta"
            data-plan={s.plan}
            disabled={s.submitting}
            className={ctaClass}
          >
            {s.submitting ? 'Starting…' : ctaLabel}
          </button>
        </form>
      ) : s.anon ? (
        <Link
          href={`/plans/checkout?plan=${s.plan}&from=${encodeURIComponent(s.from)}`}
          data-testid="trial-cta"
          data-plan={s.plan}
          onClick={() => s.onActivate?.(s.plan)}
          className={ctaClass}
        >
          {ctaLabel}
        </Link>
      ) : (
        <button
          type="button"
          disabled={s.busy || s.submitting}
          data-testid="trial-cta"
          data-plan={s.plan}
          onClick={() => {
            s.onActivate?.(s.plan);
            s.startCheckout();
          }}
          className={ctaClass}
        >
          {s.submitting ? 'Starting…' : s.busy ? 'Loading…' : ctaLabel}
        </button>
      )}

      {s.errorText && (
        <p
          role="alert"
          className="rounded-md border border-rc-poor/30 bg-rc-poor-bg p-2.5 text-xs text-rc-poor-ink"
        >
          {s.errorText}
        </p>
      )}
    </div>
  );
}

/**
 * The auto-renewal disclosure. Required, and deliberately not buried — but
 * kept to one line: the date, the amount, and that it renews until cancelled.
 */
export function TrialTerms({ className }: { className?: string }) {
  const s = useTrialCta();
  if (s.busy || s.status?.is_active) return null;

  const subtle = s.isLight ? 'text-rc-ink-mute' : 'text-rc-text-muted';
  const linkClass = s.isLight
    ? 'text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover'
    : 'text-white underline underline-offset-2';

  return (
    <p className={cn('text-[11px] leading-relaxed', subtle, className)}>
      {s.trialOn ? (
        <>
          Free until {s.chargeDate}, then {dollars(s.priceCents)}/
          {s.periodWord} until you cancel. Cancel anytime before then and you
          pay nothing.
        </>
      ) : (
        <>
          {dollars(s.priceCents)} charged today, then every {s.periodWord} until
          you cancel.
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
  );
}

/** Cadence + buy + terms in one block, for surfaces that don't split them. */
export default function TrialCta({
  from,
  signupHref,
  signupLabel,
  theme = 'light',
  className,
  onActivate,
}: TrialCtaProps) {
  return (
    <TrialCtaProvider from={from} theme={theme} onActivate={onActivate}>
      <div className={cn('flex flex-col gap-3', className)}>
        {!signupHref && <TrialCadence className="self-start" />}
        <TrialBuy signupHref={signupHref} signupLabel={signupLabel} />
        {!signupHref && <TrialTerms />}
      </div>
    </TrialCtaProvider>
  );
}
