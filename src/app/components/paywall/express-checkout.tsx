'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Elements,
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
// `@stripe/stripe-js` fetches stripe.js as a SIDE EFFECT OF BEING IMPORTED —
// not when loadStripe() is called. This module is reachable from the top bar
// (TrialModalButton → ProTrialModal → TrialCta), which every signed-in page
// renders, so 246 KB of Stripe was downloading and evaluating on the dashboard,
// on settings, on every route — including for Pro accounts that can never open
// a checkout. The `/pure` entrypoint defers the fetch to the first loadStripe()
// call, which is getStripeJs() below, which only runs when the express-checkout
// element actually mounts.
import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe } from '@stripe/stripe-js';
import type {
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementReadyEvent,
} from '@stripe/stripe-js';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { trackEvent } from '@/lib/analytics';
import { TRIAL_DAYS, dollars } from '@/lib/pricing';

/**
 * Apple Pay / Google Pay, on the page, one tap.
 *
 * The email-and-card path below this in the modal still exists and still goes
 * out to Stripe's hosted Checkout. This is the fast lane: the wallet already
 * holds the card AND the email, so a buyer who has one never types anything.
 *
 * The purchase is two server calls with the wallet sheet in between — see
 * src/app/api/stripe/express-checkout/route.ts for why it's split that way.
 * The short version: nothing is created until the wallet has authorised, so
 * opening the sheet and changing your mind costs you nothing, least of all
 * your one free trial.
 *
 * This renders NOTHING when no wallet is available — most desktop Chrome
 * without a saved card, every browser on a machine with no wallet configured.
 * `onAvailabilityChange` is how the parent knows whether to draw the "or" rule
 * above the email field, so there's never a divider with nothing over it.
 *
 * Apple Pay additionally requires the domain to be registered with Stripe
 * (Dashboard → Settings → Payments → Apple Pay). Until that's done for a given
 * host, the button simply doesn't appear there — including on localhost, which
 * is why this is the one piece of the modal that can't be checked locally.
 */

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

/** One Stripe.js load for the whole app, not one per modal open. */
let stripePromise: Promise<Stripe | null> | null = null;
function getStripeJs(): Promise<Stripe | null> {
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}

interface ExpressConfig {
  available: boolean;
  anon_available: boolean;
  currency: string;
  trial_days: number;
  price_cents: number;
  per_month_cents: number;
}

export interface ExpressCheckoutProps {
  /** Analytics origin, passed through to Stripe metadata. */
  from: string;
  /** Region slug when the surface knows it ('BC', 'WA', 'OR'). */
  region?: string;
  /** Fires with whether a wallet button actually rendered. */
  onAvailabilityChange?: (available: boolean) => void;
  /** Fires when the buyer taps a wallet button, before the sheet opens. */
  onActivate?: () => void;
  className?: string;
}

export default function ExpressCheckout({
  from,
  region,
  onAvailabilityChange,
  onActivate,
  className,
}: ExpressCheckoutProps) {
  const { user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<ExpressConfig | null>(null);

  useEffect(() => {
    if (!PUBLISHABLE_KEY) return;

    let cancelled = false;
    (async () => {
      try {
        const qs = region ? `?region=${encodeURIComponent(region)}` : '';
        const res = await fetch(`/api/stripe/express-checkout${qs}`);
        if (!res.ok) throw new Error('config fetch failed');
        const body = (await res.json()) as ExpressConfig;
        if (!cancelled) setConfig(body);
      } catch {
        // No config, no buttons. The card path below is unaffected.
        if (!cancelled) setConfig(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [region]);

  const signedIn = !authLoading && Boolean(user);
  const sellable =
    Boolean(PUBLISHABLE_KEY) &&
    Boolean(config?.available) &&
    (signedIn || Boolean(config?.anon_available));

  // Tell the parent as soon as we know we're not going to draw anything, so a
  // divider isn't left hanging over empty space while the config resolves.
  useEffect(() => {
    if (!sellable) onAvailabilityChange?.(false);
  }, [sellable, onAvailabilityChange]);

  if (!sellable || !config || authLoading) return null;

  return (
    <div className={className}>
      <Elements
        stripe={getStripeJs()}
        options={{
          // Deferred intent: the SetupIntent doesn't exist until the wallet
          // sheet has been authorised, so the element is configured by shape
          // rather than by a client secret.
          mode: 'setup',
          currency: config.currency,
          setupFutureUsage: 'off_session',
          appearance: { variables: { borderRadius: '8px' } },
        }}
      >
        <WalletButtons
          from={from}
          region={region}
          signedIn={signedIn}
          priceCents={config.price_cents}
          onAvailabilityChange={onAvailabilityChange}
          onActivate={onActivate}
        />
      </Elements>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function WalletButtons({
  from,
  region,
  signedIn,
  priceCents,
  onAvailabilityChange,
  onActivate,
}: {
  from: string;
  region?: string;
  signedIn: boolean;
  /**
   * The amount THIS visitor's subscription will be created at, resolved by
   * /api/stripe/express-checkout from their split-test arm. Passed down rather
   * than imported, because the wallet sheet is drawn by the operating system
   * and cannot be corrected once it is open: the number here and the number on
   * the subscription have to come from the same resolution.
   */
  priceCents: number;
  onAvailabilityChange?: (available: boolean) => void;
  onActivate?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The wallet sheet has to show the customer the deal it's committing them to:
  // free until this date, then this much, this often. Apple requires it for
  // recurring payments and it's the honest thing to show regardless.
  //
  // A lazy initialiser, not a ref mutated in an effect: the effect version runs
  // twice under StrictMode and quietly promises a 14-day trial. This reads the
  // clock exactly once, on mount — and only ever on the client, since this
  // component doesn't render until the config fetch resolves.
  const [trialEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + TRIAL_DAYS);
    return d;
  });

  const options = useMemo(
    () => ({
      // Apple Pay hands back the billing email, which is exactly what the
      // pay-first flow needs to provision an account — so a signed-out buyer
      // never types one.
      emailRequired: !signedIn,
      buttonHeight: 44,
      buttonType: { applePay: 'subscribe' as const, googlePay: 'subscribe' as const },
      // Wallets only. Link, PayPal and the BNPL methods either don't suit a
      // card-required trial or would redirect away — and a redirect is the one
      // thing this component exists to avoid (see onConfirm).
      paymentMethods: {
        applePay: 'auto' as const,
        googlePay: 'auto' as const,
        link: 'never' as const,
        paypal: 'never' as const,
        amazonPay: 'never' as const,
        klarna: 'never' as const,
      },
      layout: { maxColumns: 2, maxRows: 1 },
      applePay: {
        recurringPaymentRequest: {
          paymentDescription: 'ReelCaster Pro',
          managementURL:
            typeof window === 'undefined'
              ? 'https://www.reelcaster.com/profile'
              : `${window.location.origin}/profile`,
          regularBilling: {
            label: 'ReelCaster Pro, yearly',
            amount: priceCents,
            recurringPaymentIntervalUnit: 'year' as const,
            recurringPaymentIntervalCount: 1,
            recurringPaymentStartDate: trialEndsAt,
          },
          trialBilling: {
            label: `Free trial, ${TRIAL_DAYS} days`,
            amount: 0,
            recurringPaymentIntervalUnit: 'day' as const,
            recurringPaymentIntervalCount: TRIAL_DAYS,
          },
          billingAgreement: `Free for ${TRIAL_DAYS} days, then ${dollars(
            priceCents,
          )} a year until you cancel.`,
        },
      },
    }),
    [signedIn, trialEndsAt, priceCents],
  );

  const onReady = useCallback(
    (event: StripeExpressCheckoutElementReadyEvent) => {
      const methods = event.availablePaymentMethods;
      onAvailabilityChange?.(
        Boolean(methods && (methods.applePay || methods.googlePay)),
      );
    },
    [onAvailabilityChange],
  );

  const onConfirm = useCallback(
    async (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) return;

      trackEvent('Checkout Started', {
        surface: 'express',
        wallet: event.expressPaymentType === 'apple_pay' ? 'apple_pay' : 'google_pay',
        region,
        from,
      });
      setBusy(true);
      setError(null);

      const fail = (message: string) => {
        // Dismisses the wallet sheet with an error rather than leaving it
        // spinning on a payment that is never going to land.
        event.paymentFailed({ reason: 'fail' });
        setError(message);
        setBusy(false);
      };

      try {
        const { error: submitError } = await elements.submit();
        if (submitError) {
          fail(submitError.message ?? 'That payment method was declined.');
          return;
        }

        // 1. Resolve the customer and get a SetupIntent to confirm against.
        const setup = await apiFetch<{
          client_secret?: string;
          redirect?: string;
        }>('/api/stripe/express-checkout', {
          method: 'POST',
          body: {
            step: 'setup',
            email: event.billingDetails?.email,
            region: region ?? '',
            from,
          },
        });

        if (setup.redirect) {
          window.location.href = setup.redirect;
          return;
        }
        if (!setup.client_secret) {
          fail('We couldn’t start checkout. Please try again in a moment.');
          return;
        }

        // 2. The wallet authorises. `redirect: 'if_required'` never actually
        //    redirects for Apple Pay or Google Pay — which is why the element
        //    above is restricted to those two. A method that DID redirect would
        //    land on return_url with no subscription created.
        const { error: confirmError, setupIntent } = await stripe.confirmSetup({
          elements,
          clientSecret: setup.client_secret,
          confirmParams: {
            return_url: `${window.location.origin}/billing/success`,
          },
          redirect: 'if_required',
        });

        if (confirmError || !setupIntent) {
          fail(
            confirmError?.message ??
              'That payment method couldn’t be confirmed.',
          );
          return;
        }

        // 3. Card is on file — now sell them the subscription.
        const result = await apiFetch<{
          requires_action?: boolean;
          client_secret?: string;
        }>('/api/stripe/express-checkout', {
          method: 'POST',
          body: { step: 'subscribe', setup_intent: setupIntent.id },
        });

        // Only reachable for a repeat customer with no trial left, whose first
        // charge lands immediately and needs a 3DS step.
        if (result.requires_action && result.client_secret) {
          const { error: actionError } = await stripe.handleNextAction({
            clientSecret: result.client_secret,
          });
          if (actionError) {
            fail(actionError.message ?? 'That payment needed another step.');
            return;
          }
        }

        // The SetupIntent id stands in for a Checkout Session id here; the
        // claim route accepts both, and a signed-out buyer is signed into the
        // account the webhook provisions from it.
        window.location.href = `/billing/success?session_id=${encodeURIComponent(
          setupIntent.id,
        )}`;
      } catch {
        fail('We couldn’t complete that purchase. Please try again.');
      }
    },
    [stripe, elements, from, region],
  );

  return (
    <div>
      <ExpressCheckoutElement
        options={options}
        onReady={onReady}
        // A misconfigured publishable key, a blocked stripe.js, a domain not
        // registered for Apple Pay — all land here. Left unhandled, Stripe
        // logs an unhandled-error to the console of every buyer it happens to;
        // handled, it's just "no wallet available", which is a state the modal
        // already knows how to render.
        onLoadError={() => onAvailabilityChange?.(false)}
        onClick={({ resolve }: { resolve: () => void }) => {
          onActivate?.();
          resolve();
        }}
        onConfirm={onConfirm}
        onCancel={() => setBusy(false)}
      />

      {busy && (
        <p className="mt-2 text-center text-xs text-rc-ink-mute" role="status">
          Finishing up…
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-md border border-rc-poor/30 bg-rc-poor-bg p-2.5 text-xs text-rc-poor-ink"
        >
          {error}
        </p>
      )}
    </div>
  );
}
