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
import { preconnect } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { hashEmailForMeta } from '@/lib/meta-match';
import { metaIdentify } from '@/lib/meta-pixel';
import { useSubscription } from '@/hooks/use-subscription';
import { trackEvent } from '@/lib/analytics';
import { useUpgradeFlow } from '@/hooks/use-upgrade-flow';
import { goToCheckout } from '@/lib/checkout-redirect';
import { cn } from '@/lib/utils';
import ExpressCheckout from './express-checkout';
import {
  CONTROL_MONTHLY_CENTS,
  TRIAL_DAYS,
  currencyForRegion,
  dollars,
  type BillingPlan,
} from '@/lib/pricing';
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
  /** The plan picker's monthly card can be sold in this environment. */
  monthly_available?: boolean;
  /** Hashed email / phone / name for the pixel; see src/lib/meta-identity.ts. */
  meta_identity?: { em?: string; ph?: string; fn?: string; ln?: string } | null;
}

/**
 * Pay-first checkout: a signed-out buyer goes straight to Stripe and the
 * account is created afterwards from the email Stripe billed.
 */
const PAY_FIRST = process.env.NEXT_PUBLIC_PAY_FIRST_CHECKOUT === '1';

/**
 * The signed-out Start tap used to wait on a whole round trip: the account
 * lookup, the trial check, the price and the Stripe session, one after
 * another, 1.2 s median from tap to redirect on prod (Sept 2026, 109 taps).
 * So the sheet builds the session while the buyer is still on it, as soon as
 * the email field holds something that looks like an address and they pause,
 * and the tap only has to leave. Anything that changes what the session says
 * (address, plan, region, paid terms) builds a new one.
 */
const PREFETCH_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const PREFETCH_DEBOUNCE_MS = 600;
/** A prefetched session is good for three hours; stop trusting one well before. */
const PREFETCH_MAX_AGE_MS = 30 * 60 * 1000;

type CheckoutPayload = { url?: string; id?: string; redirect?: string; error?: string };
type CheckoutReply = { status: number; ok: boolean; payload: CheckoutPayload };

function postAnonCheckout(body: Record<string, unknown>): Promise<CheckoutReply> {
  return fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    let payload: CheckoutPayload = {};
    try {
      payload = await res.json();
    } catch {
      /* non-JSON error body */
    }
    return { status: res.status, ok: res.ok, payload };
  });
}

/**
 * The monthly card on the phone sheet's plan picker. NEXT_PUBLIC_ so a
 * signed-out reader, who never gets a status read, can be told whether the
 * second card is for sale; the server holds the price id itself. Unset, the
 * picker is never drawn and the sheet is the single annual button.
 */
export const MONTHLY_ON = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_ON === '1';

/**
 * How the purchase was started, for the caller's analytics. 'annual' and
 * 'monthly' are the buy button with that plan chosen; the phone sheet's
 * plan picker is the only thing that produces 'monthly'.
 */
export type TrialCtaMethod = 'annual' | 'monthly' | 'wallet' | 'signup';

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
  /** The amount per `periodWord`, for the plan in hand. */
  priceCents: number;
  periodWord: string;
  chargeDate: string;
  planDown: boolean;
  /**
   * Which cadence the buy button sells. Annual unless the plan picker on the
   * phone sheet moved it; every surface without a picker never sees monthly.
   * Monthly carries no trial, so `trialOn` reads false while it is chosen.
   */
  plan: BillingPlan;
  setPlan: (plan: BillingPlan) => void;
  /** The annual amount, regardless of `plan`, for the picker's card. */
  annualCents: number;
  /** The monthly amount, regardless of `plan`, for the picker's card. */
  monthlyCents: number;
  /** Whether the monthly card can be sold at all (price wired up). */
  monthlyAvailable: boolean;
  /**
   * Whether the ANNUAL plan would trial for this reader, whichever card is
   * chosen. `trialOn` is that gated by `plan`; the picker's yearly card
   * needs the ungated answer so it keeps saying "7 days free" while the
   * monthly card is selected.
   */
  annualTrial: boolean;
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
  /**
   * Stripe's URL, when the browser was asked to go there and three seconds
   * later had not left. Drawn as a plain link so a swallowed navigation (an
   * in-app browser, a blocked redirect) still has a way through, and reported
   * as 'checkout_stuck' so the funnel shows how often that happens.
   */
  stuckUrl: string | null;
  /**
   * The address a signed-out buyer typed, when it already belongs to an
   * account. Checkout refuses those (`account_exists`), so the buy form gives
   * way to a sign-in offer until the address is changed.
   */
  existingAccountEmail: string | null;
  /** 'sent' once the sign-in link for `existingAccountEmail` has gone out. */
  signInLink: 'idle' | 'sending' | 'sent' | 'error';
  sendSignInLink: () => void;
  /** Back to the email field, for someone who typed the wrong address. */
  clearExistingAccount: () => void;
  /**
   * The typed address has already had its free trial (`trial_used`). The
   * button and terms switch to paid terms, a notice says why, and the next tap
   * goes to checkout on those terms.
   */
  trialWithheld: boolean;
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
  const { user, session, loading: authLoading, signInWithMagicLink } = useAuth();
  const { isPaid } = useSubscription();
  const {
    openCheckout,
    loading: submitting,
    error,
    stuckUrl: signedInStuckUrl,
  } = useUpgradeFlow();

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
  const [email, setEmailValue] = useState('');
  const [existingAccountEmail, setExistingAccountEmail] = useState<string | null>(null);
  const [signInLink, setSignInLink] = useState<TrialCtaState['signInLink']>('idle');
  const [trialWithheld, setTrialWithheld] = useState(false);
  // Both refusals are about one address. A different address has to be asked
  // about afresh, so editing the field forgets them.
  function setEmail(value: string) {
    setEmailValue(value);
    setExistingAccountEmail(null);
    setSignInLink('idle');
    setTrialWithheld(false);
  }

  // Advanced matching for the Meta pixel (src/lib/meta-match.ts). A signed-in
  // reader is identified as soon as the provider knows them, so every event
  // on the page carries it; a signed-out reader is identified from the email
  // field, on blur and again on submit, which is before the Begin checkout
  // tap's InitiateCheckout can fire (that waits on a round trip to the
  // counter route). Hashed before it reaches the pixel.
  const identified = useRef<string | null>(null);
  function identify(address: string | null | undefined, externalId?: string | null) {
    const key = `${address ?? ''}|${externalId ?? ''}`;
    if (identified.current === key) return;
    identified.current = key;
    void hashEmailForMeta(address).then((emailHash) => {
      if (identified.current !== key) return;
      metaIdentify({ emailHash, externalId });
    });
  }
  useEffect(() => {
    if (user?.email) identify(user.email, user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email]);

  // 'Email Entered' fires once per paywall, not on every keystroke or blur.
  const emailReported = useRef(false);
  function reportEmail(value: string) {
    identify(value);
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
  const [anonStuckUrl, setAnonStuckUrl] = useState<string | null>(null);
  const cancelHop = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelHop.current?.(), []);

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
        // The fuller identity the account holds (a verified SMS number, the
        // billing name) on top of the email the mount effect already sent.
        if (!cancelled && body.meta_identity) {
          metaIdentify({
            emailHash: body.meta_identity.em,
            phoneHash: body.meta_identity.ph,
            firstNameHash: body.meta_identity.fn,
            lastNameHash: body.meta_identity.ln,
            externalId: user?.id ?? null,
          });
        }
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
  const [plan, setPlan] = useState<BillingPlan>('annual');
  const monthlyCents = CONTROL_MONTHLY_CENTS[currencyForRegion(region)];
  // Signed out, the picker trusts the build-time switch the sheet reads;
  // signed in, the status read says whether the monthly price is wired up.
  const monthlyAvailable = MONTHLY_ON && (status ? Boolean(status.monthly_available) : true);
  const priceCents = plan === 'monthly' ? monthlyCents : pricing.cents;

  const anon = authSettled && !signedIn;
  // Eligibility for a signed-out buyer is checked server-side against the
  // email they give — typed, or handed over by the wallet. The optimistic
  // `true` here lasts until then: checkout refuses a withheld trial with
  // `trial_used` instead of charging, and this flips to paid terms before the
  // buyer is sent anywhere. It used to survive all the way to Stripe's page,
  // where the first sign of it was a price. Monthly never trials: the picker's
  // monthly card is charged today, and the button and the terms under it say
  // so.
  const annualTrial = (anon && !trialWithheld) || Boolean(status?.trial_available);
  const trialOn = plan === 'annual' && annualTrial;
  const trialDays = status?.trial_days ?? TRIAL_DAYS;
  const chargeDate = useMemo(
    () => shortDate(trialOn ? addDays(trialDays) : new Date()),
    [trialOn, trialDays],
  );

  // Stripe's page is the next thing a signed-out buyer sees; open the
  // connection while they read the sheet.
  useEffect(() => {
    if (anon && PAY_FIRST) preconnect('https://checkout.stripe.com');
  }, [anon]);

  const prefetched = useRef<{ key: string; at: number; reply: Promise<CheckoutReply> } | null>(null);
  const checkoutKey = (address: string) =>
    JSON.stringify([from, region, address.toLowerCase(), plan, trialWithheld]);
  useEffect(() => {
    if (!anon || !PAY_FIRST) return;
    const address = email.trim();
    if (!PREFETCH_EMAIL_RE.test(address)) return;
    const key = checkoutKey(address);
    const warm = prefetched.current;
    if (warm && warm.key === key && Date.now() - warm.at < PREFETCH_MAX_AGE_MS) return;
    const timer = window.setTimeout(() => {
      const reply = postAnonCheckout({
        from,
        region,
        email: address,
        plan,
        accept_paid: trialWithheld,
        prefetch: true,
      });
      reply.catch(() => {});
      prefetched.current = { key, at: Date.now(), reply };
    }, PREFETCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anon, email, plan, region, from, trialWithheld]);

  async function startAnonCheckout() {
    reportEmail(email);
    reportSplitCta(pricing, 'paywall');
    trackEvent('Checkout Started', {
      surface: 'paywall',
      from,
      region,
      signed_in: false,
      trial: trialOn,
      plan,
      pricing: pricing.variant ?? 'control',
    });
    setAnonSubmitting(true);
    setAnonError(null);
    const address = email.trim();
    try {
      // The session the sheet already built for exactly this, when there is
      // one. A failed or stale prefetch falls through to a fresh request.
      const warm = prefetched.current;
      prefetched.current = null;
      let reply: CheckoutReply | null = null;
      if (warm && warm.key === checkoutKey(address) && Date.now() - warm.at < PREFETCH_MAX_AGE_MS) {
        reply = await warm.reply.catch(() => null);
        if (reply && !reply.ok && reply.status !== 409) reply = null;
        if (reply?.payload.id) {
          // The prefetch held its checkout_start back; this is the tap.
          void fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commit: reply.payload.id }),
            keepalive: true,
          }).catch(() => {});
        }
      }
      reply ??= await postAnonCheckout({
        from,
        region,
        email: address,
        plan,
        // Only after the sheet has shown paid terms for this address.
        accept_paid: trialWithheld,
      });
      const res = reply;
      const payload = reply.payload;
      if (res.status === 409 && payload.error === 'account_exists') {
        trackEvent('Checkout Refused', { surface: 'paywall', from, reason: 'account_exists' });
        setExistingAccountEmail(address);
        setAnonSubmitting(false);
        return;
      }
      if (res.status === 409 && payload.error === 'trial_used') {
        trackEvent('Checkout Refused', { surface: 'paywall', from, reason: 'trial_used' });
        setTrialWithheld(true);
        setAnonSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(payload.error ?? 'checkout_failed');
      if (payload.redirect) {
        window.location.href = payload.redirect;
        return;
      }
      if (!payload.url) throw new Error('no_url');
      cancelHop.current = goToCheckout(payload.url, {
        sessionId: payload.id ?? null,
        viewerTier: 'anon',
        onStuck: (url) => {
          setAnonStuckUrl(url);
          setAnonSubmitting(false);
        },
      });
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
    priceCents,
    periodWord: plan === 'monthly' ? 'month' : 'year',
    chargeDate,
    planDown: Boolean(status && !status.annual_available),
    plan,
    setPlan,
    annualCents: pricing.cents,
    monthlyCents,
    monthlyAvailable,
    annualTrial,
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
        plan,
        price_cents: priceCents,
        pricing: pricing.variant ?? 'control',
      });
    },
    submitting: submitting || anonSubmitting,
    errorText:
      anonError ??
      (error ? 'We couldn’t start checkout. Please try again in a moment.' : null),
    stuckUrl: anonStuckUrl ?? signedInStuckUrl,
    existingAccountEmail,
    signInLink,
    sendSignInLink: () => {
      if (!existingAccountEmail || signInLink === 'sending' || signInLink === 'sent') return;
      setSignInLink('sending');
      signInWithMagicLink(existingAccountEmail)
        .then(({ error: linkError }) => {
          setSignInLink(linkError ? 'error' : 'sent');
          if (!linkError) {
            trackEvent('Magic Link Requested', { source: 'paywall-account-exists', from });
          }
        })
        .catch(() => setSignInLink('error'));
    },
    clearExistingAccount: () => setEmail(''),
    trialWithheld,
    startAnonCheckout,
    startCheckout: () => {
      reportSplitCta(pricing, 'paywall');
      trackEvent('Checkout Started', {
        surface: 'paywall',
        from,
        region,
        signed_in: true,
        plan,
        tier: isPaid ? 'pro' : 'free',
      });
      // The same token the eligibility read used, so the POST does not go
      // back to the client for a session and wait on the same lock.
      openCheckout({
        from,
        region,
        accessToken,
        viewerTier: isPaid ? 'pro' : 'free',
        plan,
      }).catch(() => {
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

  // The wallet sheet quotes a free trial in the operating system's own UI and
  // cannot be told otherwise once it is open, so it is not offered to a buyer
  // known to have no trial left. The card form beside it states paid terms.
  // Unknown (a signed-in read that failed) still shows it: the express route
  // refuses a trial it would not grant, with no charge.
  const noTrial = s.anon ? s.trialWithheld : Boolean(s.status && !s.status.trial_available);
  if (noTrial || s.existingAccountEmail) return null;

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
  inputClassName,
  hideLabel = false,
  collectEmail = true,
  placeholder = 'angler@example.com',
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
   * Added to the email field's classes, for the same reason as
   * `buttonClassName`: the phone sheet draws the field at Stripe's height and
   * corner radius so the field and the button under it read as one form.
   */
  inputClassName?: string;
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
  /** The email field's placeholder. The timeline sheet asks in its own words. */
  placeholder?: string;
}) {
  const s = useTrialCta();
  const emailFieldId = useId();

  const ctaClass =
    buttonClassName ??
    'inline-flex w-full items-center justify-center rounded-lg bg-rc-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';
  const ctaLabel = s.trialOn
    ? `Start ${s.trialDays}-day free trial`
    : `Get Pro · ${dollars(s.priceCents)}/${s.periodWord}`;
  const method: TrialCtaMethod = s.plan;

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

  // The typed address already has an account, and checkout refused to sell it
  // a second one. In place of the form, because a buy button here can only be
  // refused again.
  if (s.anon && PAY_FIRST && s.existingAccountEmail) {
    return (
      <ExistingAccountOffer
        className={className}
        buttonClassName={ctaClass}
      />
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {s.anon && PAY_FIRST && s.trialWithheld && (
        // Said at the button, where the label and the terms under it have just
        // changed, so the change reads as an answer rather than a glitch.
        <p
          role="status"
          data-testid="trial-cta-trial-used"
          className={cn(
            'rounded-md border p-2.5 text-xs leading-relaxed',
            s.isLight
              ? 'border-rc-rule bg-rc-surface text-rc-ink-soft'
              : 'border-rc-bg-light bg-rc-bg-light text-rc-text',
          )}
        >
          {s.email.trim()} has already had a free trial, so Pro starts today
          at {dollars(s.priceCents)} a {s.periodWord}.
        </p>
      )}
      {s.anon && PAY_FIRST && !collectEmail ? (
        // Pay first, sign up never, and Stripe asks for the email itself.
        <button
          type="button"
          data-testid={testId}
          data-plan={s.plan}
          disabled={s.submitting}
          onClick={() => {
            s.reportStartClick();
            s.onActivate?.(method);
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
            // The browser has validated the address by now (`required`,
            // type=email). reportEmail also identifies the pixel; on a phone
            // the field may never blur before the submit, so it runs here too.
            s.reportEmail(s.email);
            s.reportStartClick();
            s.onActivate?.(method);
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
            placeholder={placeholder}
            disabled={s.submitting}
            className={cn(
              'w-full rounded-lg border px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60',
              s.isLight
                ? 'border-rc-rule bg-rc-surface text-rc-ink placeholder:text-rc-ink-mute'
                : 'border-rc-bg-light bg-rc-bg-light text-rc-text placeholder:text-rc-text-muted',
              inputClassName,
            )}
          />
          <button
            type="submit"
            data-testid={testId}
            data-plan={s.plan}
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
          data-plan={s.plan}
          onClick={() => {
            s.reportStartClick();
            s.onActivate?.(method);
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
          data-plan={s.plan}
          onClick={() => {
            s.reportStartClick();
            s.onActivate?.(method);
            s.startCheckout();
          }}
          className={ctaClass}
        >
          {s.submitting ? 'Starting…' : s.busy ? 'Loading…' : ctaLabel}
        </button>
      )}

      {s.stuckUrl && (
        // The browser was asked to open Stripe and did not go. A plain link is
        // the one thing every browser honours on a tap.
        <a
          href={s.stuckUrl}
          data-testid="trial-cta-continue"
          className={cn(
            'inline-flex w-full items-center justify-center rounded-lg border border-rc-brand px-4 py-2.5 text-sm font-semibold text-rc-brand',
          )}
        >
          Continue to secure checkout
        </a>
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
 * What a signed-out buyer sees when the email they typed already has an
 * account: a way into that account, not a second purchase.
 *
 * A sign-in link first, because most of these accounts were made by a checkout
 * and have no password (src/lib/checkout-account.ts). The password route is
 * there for the rest, and comes back to this page. Once signed in, the sheet
 * reads the account's own state: a Pro member is shown "Manage subscription",
 * anyone else the terms their account qualifies for.
 */
function ExistingAccountOffer({
  className,
  buttonClassName,
}: {
  className?: string;
  buttonClassName: string;
}) {
  const s = useTrialCta();
  const email = s.existingAccountEmail ?? '';
  const loginHref = `/login?next=${encodeURIComponent(
    `${window.location.pathname}${window.location.search}`,
  )}`;
  const body = s.isLight ? 'text-rc-ink-soft' : 'text-rc-text';
  const quiet = cn(
    'text-sm font-semibold underline underline-offset-2',
    s.isLight ? 'text-rc-brand hover:text-rc-brand-hover' : 'text-white',
  );

  return (
    <div
      data-testid="trial-cta-account-exists"
      className={cn('flex flex-col gap-2', className)}
    >
      <p role="status" className={cn('text-sm leading-relaxed', body)}>
        {s.signInLink === 'sent' ? (
          <>
            We sent a sign-in link to <strong>{email}</strong>. Open it on this
            device and you&apos;re in.
          </>
        ) : (
          <>
            <strong>{email}</strong> already has a ReelCaster account. Sign in
            to it instead of buying again.
          </>
        )}
      </p>
      {s.signInLink !== 'sent' && (
        <button
          type="button"
          data-testid="trial-cta-send-sign-in"
          disabled={s.signInLink === 'sending'}
          onClick={s.sendSignInLink}
          className={buttonClassName}
        >
          {s.signInLink === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
        </button>
      )}
      {s.signInLink === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-rc-poor/30 bg-rc-poor-bg p-2.5 text-xs text-rc-poor-ink"
        >
          We couldn&apos;t send that just now. Try again in a minute, or sign in
          with your password.
        </p>
      )}
      <div className="flex items-center justify-center gap-4 pt-1">
        <a href={loginHref} className={quiet}>
          Sign in with a password
        </a>
        <button type="button" onClick={s.clearExistingAccount} className={quiet}>
          Use a different email
        </button>
      </div>
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
      {/* See ./charge-terms for why these are not prefetched. */}
      <Link href="/terms" prefetch={false} className={linkClass}>
        Terms
      </Link>
      {' · '}
      <Link href="/privacy" prefetch={false} className={linkClass}>
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
