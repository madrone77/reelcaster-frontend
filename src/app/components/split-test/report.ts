'use client';

/**
 * Telling the counter that an arm was seen, and that its button was pressed.
 *
 * Both halves fire from the same code under the same conditions, which is what
 * makes the ratio between them honest even though neither is a count of
 * people. A visitor with JavaScript off is missing from the numerator and the
 * denominator alike. Nothing built on these numbers is ever described as
 * "visitors" — see the migration for why that trade was made.
 */

import { useEffect, useRef } from 'react';
import type { PricingView } from '@/lib/pricing';

const ENDPOINT = '/api/split-tests/event';

interface EventPayload {
  kind: 'exposure' | 'cta_click';
  test: string;
  variant: string;
  surface: string;
  currency: string;
}

/**
 * sendBeacon first, because a CTA navigates away immediately: a plain fetch
 * racing `window.location` loses often enough to dent the click count, and a
 * dent in the numerator alone makes a working arm look like a losing one.
 */
function post(payload: EventPayload): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // Fall through to fetch.
  }
  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Counting is not worth an error on a page someone is buying from.
  }
}

/** Report that an arm's price was shown on `surface`. */
export function reportSplitExposure(view: PricingView, surface: string): void {
  if (!view.testKey || !view.variant) return;
  post({
    kind: 'exposure',
    test: view.testKey,
    variant: view.variant,
    surface,
    currency: view.currency,
  });
}

/** Report that the arm's call to action was pressed on `surface`. */
export function reportSplitCta(view: PricingView, surface: string): void {
  if (!view.testKey || !view.variant) return;
  post({
    kind: 'cta_click',
    test: view.testKey,
    variant: view.variant,
    surface,
    currency: view.currency,
  });
}

/**
 * Count one exposure when an arm's price first appears on a surface.
 *
 * Keyed on the arm rather than on mount, because {@link usePricing} renders
 * the control first and swaps when the server answers: firing on mount would
 * count an exposure to the control for every visitor in the test arm, which
 * inflates the control's denominator and quietly makes the test arm look
 * better than it is.
 *
 * Nothing fires when no test is running, which is the normal state: a null
 * `testKey` is not an arm and there is nothing to count.
 */
export function useSplitExposure(view: PricingView, surface: string): void {
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (!view.testKey || !view.variant) return;
    const key = `${view.testKey}:${view.variant}:${surface}`;
    if (reported.current === key) return;
    reported.current = key;
    reportSplitExposure(view, surface);
  }, [view, surface]);
}
