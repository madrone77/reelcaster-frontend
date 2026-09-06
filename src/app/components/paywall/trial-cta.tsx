'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { trackEvent } from '@/lib/analytics';
import { useUpgradeFlow } from '@/hooks/use-upgrade-flow';
import { cn } from '@/lib/utils';
import ExpressCheckout from './express-checkout';
import { TRIAL_DAYS, dollars } from '@/lib/pricing';
import { usePricing } from '@/app/components/split-test/use-pricing';
import { reportSplitCta } from '@/app/components/split-test/report';

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

/**
 * How long the button waits for the auth context to settle before it draws
 * itself anyway. Uncontended, the session read behind `useAuth().loading`
 * answers in milliseconds, so this never fires for a healthy page.
 */
const AUTH_WAIT_MS = 1500;
/** How long the eligibility read may take before the button stops waiting. */
const STATUS_TIMEOUT_MS = 15_000;

/**
 * The session the Supabase client persisted, read straight from storage.
 *
 * Only for the stalled case. The client serialises every session read across
 * tabs with a Web Lock, and on Android Chrome a frozen background tab can hold
 * that lock for as long as it lives; then `useAuth()` never settles and nothing
 * that asks the client for a session gets an answer. Storage has no lock. A
 * live token here means the reader is signed in even though the context could
 * not say so, and it is the token the eligibility read and checkout need.
 * Blocked storage throws on access, so the whole read is guarded.
 */
function peekStoredAccessToken(): string | undefined {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const ref = url.replace(/^https?:\/\//, '').split('.')[0];
    if (!ref) return undefined;
    const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { access_token?: string; expires_at?: number };
    if (!parsed.access_token) return undefined;
    // A dead token would only be refused; without the client to refresh it,
    // signed out is the honest answer.
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now() + 30_000) {
      return undefined;
    }
    return parsed.access_token;
  } catch {
    return undefined;
  }
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
  /** Billing region for this checkout; see TrialCtaState.region. */
  region?: string;
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
  /**
   * Billing region ('BC' | 'WA' | ...) for this checkout.
   *
   * Not cosmetic: /api/stripe/checkout prices the session with
   * currencyForRegion(), where BC bills CAD and WA bills USD, and with no
   * region it falls back to the request's IP country and then to CAD. The
   * anon POST used to omit this entirely, so every cold ad visitor's currency
   * was decided by geo alone and defaulted to Canadian dollars whenever geo
   * came up empty. A US landing page cannot leave that to inference.
   */
  region: string;
  onActivate?: (method: TrialCtaMethod) => void;
  // buy
  email: string;
  setEmail: (v: string) => void;
  /** Fires 'Email Entered' once, when the field is left holding an address. */
  reportEmail: (v: string) => void;
  /** Fires 'Start Trial Clicked' for the buy button (both signed-in and out). */
  reportStartClick: () => void;
  submitting: boolean;
  errorText: string | null;
  startAnonCheckout: () => void;
  startCheckout: () => void;
}

const Ctx = createContext<TrialCtaState | null>(null);

/**
 * The checkout state this provider resolved: trial eligibility, the price for
 * this reader, the date the card is charged.
 *
 * Exported so a surface can place one of those facts in its own layout rather
 * than accept `TrialTerms` as a block. The phone sheet does exactly that with
 * `chargeDate`, which is the one thing in the disclosure that a timeline of
 * days cannot say for itself.
 */
export function useTrialCta(): TrialCtaState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('TrialCta parts must be rendered inside <TrialCtaProvider>');
  }
  return ctx;
}

export function TrialCtaProvider({
  from,
  region = '',
  theme = 'light',
  onActivate,
  children,
}: {
  from: string;
  /** Billing region; see TrialCtaState.region for why this matters. */
  region?: string;
  theme?: 'light' | 'dark';
  onActivate?: (method: TrialCtaMethod) => void;
  children: React.ReactNode;
}) {
  const { user, session, loading: authLoading } = useAuth();
  const { isPaid } = useSubscription();
  const { openCheckout, loading: submitting, error } = useUpgradeFlow();

  // The token comes from the auth context, never from a fresh
  // `supabase.auth.getSession()` here. That call waits on the client's
  // cross-tab lock, and a stuck lock (see peekStoredAccessToken) left this
  // effect waiting forever: the button read "Loading…" for the whole visit.
  // Seen on Chrome for Android with fifteen tabs open, 2026-09-06.
  //
  // If the context itself has not settled after AUTH_WAIT_MS, the button
  // stops waiting for it: storage says whether there is a session, and the
  // read runs with that token or as signed out. Should the context settle
  // later, the deps below pick its answer up.
  const [authStalled, setAuthStalled] = useState(false);
  useEffect(() => {
    if (!authLoading) return;
    const timer = window.setTimeout(() => setAuthStalled(true), AUTH_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [authLoading]);
  const authSettled = !authLoading || authStalled;
  const accessToken =
    session?.access_token ??
    (authLoading && authStalled ? peekStoredAccessToken() : undefined);
  const signedIn = Boolean(user) || Boolean(accessToken);

  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [email, setEmail] = useState('');
  // 'Email Entered' fires once per paywall, not on every keystroke or blur.
  const emailReported = useRef(false);
  function reportEmail(value: string) {
    if (emailReported.current) return;
    const v = value.trim();
    if (!v.includes('@')) return;
    emailReported.current = true;
    trackEvent('Email Entered', {
      surface: 'paywall',
      from,
      region,
      domain: v.slice(v.lastIndexOf('@') + 1).toLowerCase(),
    });
  }
  const [anonSubmitting, setAnonSubmitting] = useState(false);
  const [anonError, setAnonError] = useState<string | null>(null);

  useEffect(() => {
    if (!authSettled) return;
    if (!accessToken) {
      // Signed out, or signed in with no token to send: either way there is
      // no eligibility to read, and the button must not wait on one.
      setStatusLoading(false);
      return;
    }

    let cancelled = false;
    // Bounded, so a stalled connection ends in paid terms rather than a
    // button that never enables. Understating the offer is the safe failure.
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
    (async () => {
      try {
        const res = await fetch('/api/stripe/checkout', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('status fetch failed');
        const body = (await res.json()) as CheckoutStatus;
        if (!cancelled) setStatus(body);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        window.clearTimeout(timer);
        if (!cancelled) setStatusLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [accessToken, authSettled]);

  // Every number this provider hands down comes from one resolved price, so
  // the button label, the disclosure under it and the summary above it cannot
  // disagree about what the card is about to be charged.
  const pricing = usePricing(region);

  const anon = authSettled && !signedIn;
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
    reportEmail(email);
    reportSplitCta(pricing, 'paywall');
    trackEvent('Checkout Started', {
      surface: 'paywall',
      from,
      region,
      signed_in: false,
      trial: trialOn,
      pricing: pricing.variant ?? 'control',
    });
    setAnonSubmitting(true);
    setAnonError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, region, email: email.trim() }),
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
    busy: !authSettled || (!anon && statusLoading),
    anon,
    trialOn,
    trialDays,
    priceCents: pricing.cents,
    periodWord: 'year',
    chargeDate,
    planDown: Boolean(status && !status.annual_available),
    isLight: theme === 'light',
    from,
    region,
    onActivate,
    email,
    setEmail,
    reportEmail,
    reportStartClick: () => {
      trackEvent('Start Trial Clicked', {
        surface: 'paywall',
        from,
        region,
        signed_in: !anon,
        trial: trialOn,
        trial_days: trialDays,
        price_cents: pricing.cents,
        pricing: pricing.variant ?? 'control',
      });
    },
    submitting: submitting || anonSubmitting,
    errorText:
      anonError ??
      (error ? 'We couldn’t start checkout. Please try again in a moment.' : null),
    startAnonCheckout,
    startCheckout: () => {
      reportSplitCta(pricing, 'paywall');
      trackEvent('Checkout Started', {
        surface: 'paywall',
        from,
        region,
        signed_in: true,
        tier: isPaid ? 'pro' : 'free',
      });
      // The same token the eligibility read used, so the POST does not go
      // back to the client for a session and wait on the same lock.
      openCheckout({ from, region, accessToken }).catch(() => {
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
  /** Overrides the provider's region. Left for callers that render this
   *  outside a checkout page; the provider value is the default so the
   *  wallet buttons cannot silently bill in a different currency from the
   *  card form beside them. */
  region?: string;
  className?: string;
}) {
  const s = useTrialCta();
  const effectiveRegion = region ?? s.region;
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
        region={effectiveRegion}
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
  buttonClassName,
  hideLabel = false,
  collectEmail = true,
}: {
  signupHref?: string;
  signupLabel?: string;
  /**
   * Replaces the button's own classes, for a surface that draws the button to
   * someone else's spec (the phone sheet draws it the way Stripe Checkout
   * draws its pay button, so the two screens read as one flow). The default
   * stays what every other surface renders.
   */
  buttonClassName?: string;
  /**
   * Whether a signed-out buyer types an email here before Stripe. Off, the
   * button goes straight to checkout and Stripe's own form takes the email
   * with the card, which is how the phone sheet works: one screen fewer, and
   * the address is typed once. The trial-eligibility pre-check needs the
   * address, so a surface that turns this off is trusting the webhook's
   * guards to catch a repeat trial instead.
   */
  collectEmail?: boolean;
  /**
   * Keeps the email label for screen readers but takes it off the screen.
   *
   * For a surface that has already made the ask in its own headline — the
   * phone sheet, where "Enter your email to begin" set in black at 18px was a
   * second heading competing with the one at the top of the sheet. Everywhere
   * that renders this form on its own leaves it visible: a bare field with no
   * label is worse than a heading too many.
   */
  hideLabel?: boolean;
  /**
   * Overridable so a surface that renders this more than once doesn't hand a
   * selector two matches. Every copy shares the provider's email state, so
   * whichever one is typed into, the others are already filled.
   */
  testId?: string;
  className?: string;
}) {
  const s = useTrialCta();
  const emailFieldId = useId();

  const ctaClass =
    buttonClassName ??
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
        {signupLabel ?? 'Become a Member'}
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
      {s.anon && PAY_FIRST && !collectEmail ? (
        // Pay first, sign up never, and Stripe asks for the email itself.
        <button
          type="button"
          data-testid={testId}
          data-plan="annual"
          disabled={s.submitting}
          onClick={() => {
            s.reportStartClick();
            s.onActivate?.('annual');
            s.startAnonCheckout();
          }}
          className={ctaClass}
        >
          {s.submitting ? 'Starting…' : ctaLabel}
        </button>
      ) : s.anon && PAY_FIRST ? (
        // Pay first, sign up never: one email field, no password, no account.
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            s.reportStartClick();
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

              A bouncing arrow used to point from this label down at the field.
              The label already sits directly on top of the box it names, so the
              arrow was moving decoration on a form that asks for one thing. */}
          <label
            htmlFor={emailFieldId}
            className={cn(
              hideLabel
                ? 'sr-only'
                : cn(
                    'block text-balance text-base sm:text-lg font-black tracking-[-0.01em]',
                    s.isLight ? 'text-rc-ink' : 'text-rc-text',
                  ),
            )}
          >
            Enter your email to begin
          </label>
          <input
            id={emailFieldId}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={s.email}
            onChange={(e) => s.setEmail(e.target.value)}
            onBlur={(e) => s.reportEmail(e.target.value)}
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
          onClick={() => {
            s.reportStartClick();
            s.onActivate?.('annual');
          }}
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
            s.reportStartClick();
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
  region,
  signupHref,
  signupLabel,
  theme = 'light',
  className,
  onActivate,
}: TrialCtaProps) {
  return (
    <TrialCtaProvider from={from} region={region} theme={theme} onActivate={onActivate}>
      <div className={cn('flex flex-col gap-3', className)}>
        {!signupHref && <TrialExpress />}
        <TrialBuy signupHref={signupHref} signupLabel={signupLabel} />
        {!signupHref && <TrialTerms />}
      </div>
    </TrialCtaProvider>
  );
}
