'use client';

import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export interface OpenCheckoutOptions {
  /** Region slug (e.g. 'BC', 'WA', 'OR'); 'Other' triggers waitlist redirect. */
  region?: string;
  /** Analytics origin: 'spot', 'pricing', 'paywall:14-day-forecast', etc. */
  from?: string;
  /**
   * The caller's session token, when it has one in hand (the auth context).
   * Passed through so the request does not ask the Supabase client for a
   * session at send time: that read waits on a cross-tab lock that a frozen
   * Android tab can hold forever, and a button that had already resolved
   * its terms then hung at "Starting…" on the press.
   */
  accessToken?: string | null;
}

interface CheckoutResponse {
  url?: string;
  redirect?: string;
  id?: string;
}

interface PortalResponse {
  url: string;
}

/**
 * Centralizes the checkout + billing portal redirect dance so every paywall
 * upsell button can call one function instead of reimplementing the fetch.
 */
export function useUpgradeFlow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const openCheckout = useCallback(async (opts: OpenCheckoutOptions = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<CheckoutResponse>('/api/stripe/checkout', {
        method: 'POST',
        accessToken: opts.accessToken,
        body: {
          region: opts.region ?? '',
          from: opts.from ?? '',
        },
      });

      // 'Other' region returns { redirect: '/explore?waitlist=1' } instead of a Stripe URL.
      const target = res.url ?? res.redirect;
      if (target) {
        window.location.href = target;
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const openPortal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<PortalResponse>('/api/stripe/portal', {
        method: 'POST',
      });
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { openCheckout, openPortal, loading, error };
}
