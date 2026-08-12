'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { ArrowDown } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useUpgradeFlow } from '@/hooks/use-upgrade-flow';
import { cn } from '@/lib/utils';
import ExpressCheckout from './express-checkout';
import { ANNUAL_PRICE_CENTS, TRIAL_DAYS, dollars } from '@/lib/pricing';

/**
 * The buy control shared by every in-app paywall.
 *
 * Composed by default (`<TrialCta>` = wallets, buy, terms in one block), but
 * the pieces are exported separately because the plan-matrix modal spreads
 * them out: wallet buttons and the buy form up top, terms down at the foot
 * beside the free-signup offer. They share one provider so the state resolved
 * once — trial eligibility, whether the plan is sellable at all — drives every
 * piece wherever it happens to be rendered.
 *
 * There is one plan and one price now (see src/lib/pricing.ts), so there is no
 * cadence to choose. What used to be a Yearly/Monthly toggle is dead weight the
 * buyer had to clear before they could pay; the price says $2.75 a month and
 * bills $33 a year, and that's the whole offer.
 *
 * Three things here are load-bearing:
 *
 * 1. **The terms travel with the button.** Skipping /plans/checkout means the
 *    renewal amount and charge date have to be stated before the click
 *    (Canadian consumer-protection rules, US FTC negative-option rule). Short,
 *    but never absent — including in the wallet sheet, which carries its own
 *    copy of them.
 * 2. **Eligibility is resolved server-side before the button is drawn**, so a
 *    repeat customer sees paid terms rather than a trial the checkout would
 *    refuse. Any failure falls back to paid terms — understating the offer is
 *    the safe direction to fail.
 * 3. **The wallet path is additive.** If Apple Pay / Google Pay aren't
 *    available, `<TrialExpress>` renders nothing at all and the email-and-card
 *    form below is exactly what it was.
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

/** How the purchase was started, for the caller's analytics. */
export type TrialCtaMethod = 'annual' | 'wallet' | 'signup';

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
   * and no purchase controls — charging for what's free would be a lie.
   */
  signupHref?: string;
  /** Label for the `signupHref` link. */
  signupLabel?: string;
  /** Light panel (modals, /support) vs the dark Explore surfaces. */
  theme?: 'light' | 'dark';
  className?: string;
  /** Fires on any CTA activation, for the caller's own analytics. */
  onActivate?: (method: TrialCtaMethod) => void;
}

interface TrialCtaState {
  status: CheckoutStatus | null;
  busy: boolean;
  anon: boolean;
  trialOn: boolean;
  trialDays: number;
  priceCents: number;
  periodWord: string;
  chargeDate: string;
  planDown: boolean;
  isLight: boolean;
  from: string;
  onActivate?: (method: TrialCtaMethod) => void;
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
  onActivate?: (method: TrialCtaMethod) => void;
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { openCheckout, loading: submitting, error } = useUpgradeFlow();

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
  // email they give — typed, or handed over by the wallet — so an optimistic
  // `true` here never survives into the session for someone who has already
  // had a trial.
  const trialOn = anon || Boolean(status?.trial_available);
  const trialDays = status?.trial_days ?? TRIAL_DAYS;
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
        body: JSON.stringify({ from, email: email.trim() }),
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
    status,
    busy: authLoading || (!anon && statusLoading),
    anon,
    trialOn,
    trialDays,
    priceCents: ANNUAL_PRICE_CENTS,
    periodWord: 'year',
    chargeDate,
    planDown: Boolean(status && !status.annual_available),
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
      openCheckout({ from }).catch(() => {
        /* surfaced through errorText */
      });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Apple Pay / Google Pay, plus the rule that separates them from the card
 * form. Renders nothing when no wallet is available — including the rule, so
 * an "or" never floats above empty space.
 */
export function TrialExpress({
  region,
  className,
}: {
  region?: string;
  className?: string;
}) {
  const s = useTrialCta();
  // Optimistic: the element itself reports back on ready, and hiding until
  // then would make the buttons pop in under the buyer's cursor.
  const [available, setAvailable] = useState(true);

  const handleAvailability = useCallback((v: boolean) => setAvailable(v), []);
  const handleActivate = useCallback(
    () => s.onActivate?.('wallet'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.onActivate],
  );

  if (s.status?.is_active || s.planDown) return null;

  return (
    <div className={cn(available ? 'block' : 'hidden', className)}>
      <ExpressCheckout
        from={s.from}
        region={region}
        onAvailabilityChange={handleAvailability}
        onActivate={handleActivate}
      />
      <div className="mt-3 flex items-center gap-3" aria-hidden>
        <span
          className={cn(
            'h-px flex-1',
            s.isLight ? 'bg-rc-rule' : 'bg-rc-bg-light',
          )}
        />
        <span
          className={cn(
            'font-rc-mono text-[10px] uppercase tracking-[0.14em]',
            s.isLight ? 'text-rc-ink-mute' : 'text-rc-text-muted',
          )}
        >
          or pay by card
        </span>
        <span
          className={cn(
            'h-px flex-1',
            s.isLight ? 'bg-rc-rule' : 'bg-rc-bg-light',
          )}
        />
      </div>
    </div>
  );
}

/** Email (signed out) + the button that opens Stripe. */
export function TrialBuy({
  signupHref,
  signupLabel,
  testId = 'trial-cta',
  className,
}: {
  signupHref?: string;
  signupLabel?: string;
  /**
   * A surface may render this twice — once above the plan table and once
   * below it — so the id has to be overridable or a selector matches both.
   * Both copies share the provider's email state, so whichever one is typed
   * into, the other is already filled.
   */
  testId?: string;
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
        onClick={() => s.onActivate?.('signup')}
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

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {s.anon && PAY_FIRST ? (
        // Pay first, sign up never: one email field, no password, no account.
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            s.onActivate?.('annual');
            s.startAnonCheckout();
          }}
        >
          {/* The ask, at the size of an ask. This used to be fine print
              explaining the mechanics of pay-first checkout; nobody needed the
              mechanics before typing an address, they needed to know what to
              do. "To begin" rather than "to claim your free trial" because it
              is also true for a repeat customer who has no trial left — one
              string that never has to promise something checkout would refuse.

              items-end keeps the arrow on the last line of a wrapped label, so
              it stays next to the field it's pointing at. */}
          <label
            htmlFor={emailFieldId}
            className={cn(
              'flex items-end gap-2 text-base sm:text-lg font-black tracking-[-0.01em]',
              s.isLight ? 'text-rc-ink' : 'text-rc-text',
            )}
          >
            <span className="text-balance">Enter your email to begin</span>
            <ArrowDown
              aria-hidden
              className="mb-0.5 h-5 w-5 shrink-0 animate-bounce text-rc-good motion-reduce:animate-none"
            />
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
            data-testid={testId}
            data-plan="annual"
            disabled={s.submitting}
            className={ctaClass}
          >
            {s.submitting ? 'Starting…' : ctaLabel}
          </button>
        </form>
      ) : s.anon ? (
        <Link
          href={`/plans/checkout?from=${encodeURIComponent(s.from)}`}
          data-testid={testId}
          data-plan="annual"
          onClick={() => s.onActivate?.('annual')}
          className={ctaClass}
        >
          {ctaLabel}
        </Link>
      ) : (
        <button
          type="button"
          disabled={s.busy || s.submitting}
          data-testid={testId}
          data-plan="annual"
          onClick={() => {
            s.onActivate?.('annual');
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

/** Wallets + buy + terms in one block, for surfaces that don't split them. */
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
        {!signupHref && <TrialExpress />}
        <TrialBuy signupHref={signupHref} signupLabel={signupLabel} />
        {!signupHref && <TrialTerms />}
      </div>
    </TrialCtaProvider>
  );
}
