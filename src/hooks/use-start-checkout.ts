'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import type { PricingPlan } from '@/lib/pricing';

export interface StartCheckoutArgs {
  /** Cadence. Paywall CTAs lead with annual — the better deal. */
  plan?: PricingPlan;
  /**
   * 'BC' | 'WA' | 'OR' | 'Other'. Optional: with no region the checkout route
   * resolves currency from the request's IP country, which is what every
   * surface without a region picker relies on.
   */
  region?: string;
  /** Analytics breadcrumb carried into Stripe metadata ('paywall', 'pricing'). */
  from?: string;
  /**
   * Where to send a visitor who isn't signed in — Stripe needs a Supabase user
   * to attach the subscription to, so there is nothing to redirect them to yet.
   */
  signedOutHref: string;
}

/**
 * Shared "go to Stripe now" action behind every trial CTA. Creates a Checkout
 * Session server-side and hands the browser to Stripe, so no surface has to
 * bounce the user through /pricing first.
 *
 * `error` is the caller's to render — a failure here is the difference between
 * a customer and a bounce, so it must not be swallowed.
 */
export function useStartCheckout() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = useCallback(
    async ({ plan = 'annual', region, from, signedOutHref }: StartCheckoutArgs) => {
      setError(null);

      if (!user) {
        router.push(signedOutHref);
        return;
      }

      setSubmitting(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken)
          throw new Error('No session token. Please sign in again.');

        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ plan, region, from }),
        });
        // Guard the parse — a crashed function can return an empty body, and
        // "Unexpected end of JSON input" is not a message to show a customer.
        let body: { url?: string; redirect?: string; error?: string } = {};
        try {
          body = await res.json();
        } catch {
          /* non-JSON error body */
        }
        if (!res.ok) {
          throw new Error(
            body.error === 'plan_unavailable'
              ? `${plan === 'annual' ? 'Yearly' : 'Monthly'} billing isn't available right now — please try the ${plan === 'annual' ? 'monthly' : 'yearly'} plan or check back soon.`
              : 'We couldn’t start checkout. Please try again in a moment.',
          );
        }

        // 'Other' region → the route hands back a waitlist redirect instead of
        // a Stripe URL rather than taking money for an uncovered area.
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
        setError(
          err instanceof Error ? err.message : 'Could not start checkout',
        );
        setSubmitting(false);
      }
    },
    [user, router],
  );

  return { startCheckout, submitting, error };
}

export default useStartCheckout;
