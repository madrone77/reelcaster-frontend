'use client';

/**
 * The first-login Pro interstitial.
 *
 * Shown once, to an account that is not Pro, straight after the three-step
 * tour. The tour has just explained what the score is made of and what the
 * week strip shows; this is the first and only unprompted moment the product
 * asks a new member to pay, while the thing it is selling is still on screen
 * in their head.
 *
 * IT IS THE LIVE OFFER, not a lighter version of it. The list, the button and
 * the charge line are ./paywall/trial-sheet-stripe's own parts — BrandHeader,
 * TrialCtaProvider, TrialBuy, ChargeTerms — so this screen inherits that
 * sheet's results rather than re-deciding them, and its button opens Stripe
 * directly. The reader is signed in by the time they get here, so TrialBuy
 * renders a bare button with no email field: the address is already ours.
 *
 * THE WAY OUT IS A BUTTON, NOT AN X. Casey's call (2026-09-15): "hit them with
 * a sign up to pro interstitial, that they can bypass by clicking proceed
 * without full features that pro provides". So the bypass is spelled out in
 * those words rather than hidden behind a corner glyph, and the backdrop is
 * inert — the two ways past this screen are the offer and the sentence that
 * says what declining it costs. Escape still works, because a modal that traps
 * the keyboard is a bug whatever it is selling.
 *
 * SEEN IS RECORDED SERVER-SIDE, once, whichever way they leave — including
 * when they head off to Stripe, because coming back from an abandoned checkout
 * to the same interstitial would read as the product not listening. The write
 * is POST /api/welcome {kind:'upsell'} and it is bookkeeping: the UI closes
 * first and never waits on it.
 *
 * Mounting and ordering live in ./welcome-gate.tsx. By the time this renders
 * the decision is made.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/use-analytics';
import { reportPaywall } from '@/lib/paywall-counter';
import { usePricing } from '@/app/components/split-test/use-pricing';
import { TRIAL_DAYS } from '@/lib/pricing';
import BrandHeader from '@/app/components/paywall/brand-header';
import ChargeTerms from '@/app/components/paywall/charge-terms';
import { TrialBuy, TrialCtaProvider } from '@/app/components/paywall/trial-cta';
import {
  PRO_ROWS_HEADING,
  proRows,
} from '@/app/components/paywall/trial-sheet-stripe';

/** The wall id every event on this screen is counted under. */
const FEATURE = 'first-login' as const;
/** `surface` in the paywall report, and `from` for the checkout session. */
const SURFACE = 'first-login';

/** Stripe Checkout's field and pay button, at ./trial-sheet-stripe's sizes. */
const STRIPE_INPUT = 'h-11 rounded-md px-3 text-[16px]';
const STRIPE_BUTTON =
  'inline-flex h-11 w-full items-center justify-center rounded-md bg-rc-brand px-4 text-[16px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';
/**
 * The bypass, quieter by a whole step: no fill, no border, 14px. It has to be
 * unmissable and unmistakably second — a reader who wants past this screen
 * should find the sentence immediately and never mistake it for the offer.
 */
const BUTTON_BYPASS =
  'inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-center text-[14px] font-semibold text-rc-ink-soft transition-colors hover:bg-rc-surface hover:text-rc-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';

export default function ProUpsellModal({ onClose }: { onClose: () => void }) {
  const { trackEvent } = useAnalytics();
  const pricing = usePricing();

  const openedAt = useRef<number>(Date.now());
  /** Escape, the bypass and the Stripe hop can race. Latch the first one. */
  const closed = useRef(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    trackEvent('Pro Upsell Shown', { surface: SURFACE });
    reportPaywall('impression', {
      feature: FEATURE,
      surface: SURFACE,
      // Always: this screen is only ever raised for an account that is not Pro.
      viewerTier: 'free',
    });
    // Once per mount, not per re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Records the dismissal and closes. `took` distinguishes the reader who went
   * to Stripe from the one who went past — both stop the screen coming back,
   * only one of them is a conversion.
   */
  const close = useCallback(
    async (took: 'pro' | 'bypass' | 'escape') => {
      if (closed.current) return;
      closed.current = true;
      setLeaving(true);

      const dwellMs = Date.now() - openedAt.current;
      trackEvent('Pro Upsell Closed', { surface: SURFACE, took, dwellMs });
      if (took !== 'pro') {
        reportPaywall('dismiss', {
          feature: FEATURE,
          surface: SURFACE,
          viewerTier: 'free',
          context: { took },
          dwellMs,
        });
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await fetch('/api/welcome', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ kind: 'upsell' }),
          });
        }
      } catch {
        // If this fails the interstitial simply shows once more next session.
        // Never worth surfacing an error over.
      }

      // The Stripe hop navigates the page out from under us; closing as well
      // would be a flash of the app behind a redirect that is already running.
      if (took !== 'pro') onClose();
    },
    [trackEvent, onClose],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void close('escape');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  /**
   * The button went to checkout. `checkout_tap` is what Meta's
   * InitiateCheckout is fired off — the counter answers a marked cta_click
   * with an event id and lib/paywall-counter turns it into the tag — and on
   * this screen the button really is the hop to the card, exactly as it is on
   * ./paywall/plan-choice-modal.
   */
  const onActivate = useCallback(
    (method: string) => {
      reportPaywall('cta_click', {
        feature: FEATURE,
        surface: SURFACE,
        viewerTier: 'free',
        context: { checkout_tap: true, method },
      });
      void close('pro');
    },
    [close],
  );

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-upsell-title"
      data-testid="pro-upsell-modal"
    >
      <div className="flex max-h-[90dvh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl bg-rc-panel px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <TrialCtaProvider from={SURFACE} theme="light" onActivate={onActivate}>
          <BrandHeader />

          {/* The offer, set the way Stripe Checkout sets it on the page this
              button leads to: what it is in grey, what it costs today in
              large type, centred, as there. */}
          <div className="mt-6 text-center">
            <p className="text-[19px] leading-6 font-medium text-rc-ink-soft">
              Try ReelCaster Pro
            </p>
            <h2
              id="pro-upsell-title"
              className="mt-1 text-[36px] leading-[40px] font-bold tracking-[-0.02em] text-rc-ink"
            >
              {TRIAL_DAYS} days free
            </h2>
          </div>

          <p className="mt-6 font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
            {PRO_ROWS_HEADING}
          </p>
          <ul className="mt-2 divide-y divide-rc-rule-soft">
            {proRows().map((row) => (
              <li
                key={row}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="text-[15px] leading-5 font-medium text-rc-ink">
                  {row}
                </span>
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft"
                >
                  <Check className="size-3 text-rc-brand" strokeWidth={3} />
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <TrialBuy
              testId="pro-upsell-cta"
              buttonClassName={STRIPE_BUTTON}
              inputClassName={STRIPE_INPUT}
              hideLabel
            />
            {/* The first charge, under the button the way Stripe's page puts
                the terms under Start trial. */}
            <ChargeTerms
              priceAmount={pricing.amount}
              className="mt-3 text-center"
            />
          </div>

          {/* The way past. Casey's own sentence, kept whole: it names what
              declining costs instead of saying "no thanks", which names
              nothing. No heading over it and no second argument under it — a
              paragraph here would be a pitch for the cheaper thing sitting
              directly beneath the button for the dearer one. */}
          <button
            type="button"
            onClick={() => void close('bypass')}
            disabled={leaving}
            data-testid="pro-upsell-bypass"
            className={`mt-4 ${BUTTON_BYPASS}`}
          >
            Proceed without the full features Pro provides
          </button>
        </TrialCtaProvider>
      </div>
    </div>
  );
}
