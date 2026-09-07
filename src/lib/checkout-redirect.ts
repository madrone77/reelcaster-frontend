/**
 * The hop from our page to Stripe's, made visible.
 *
 * Until now the funnel went CTA click -> checkout_start (the server made a
 * Stripe session) -> trial. The step between the last two, the browser
 * actually setting `location.href` to Stripe's URL and leaving, was recorded
 * nowhere, so a redirect that an in-app browser swallowed looked exactly like
 * a buyer who reached Stripe's page and walked away (2026-09-06: ten checkout
 * starts in a row with no completed session, and no way to tell which).
 *
 * Two beacons and one fallback, all from here:
 *
 *   'checkout_redirect'  fired the instant before the navigation is asked for,
 *                        carrying the Stripe session id so the row can be
 *                        matched to Stripe's own record of that session.
 *   'checkout_stuck'     fired if, STUCK_AFTER_MS later, this document is still
 *                        the visible one. A page that left never fires it.
 *   onStuck(url)         the caller draws the Stripe URL as a plain link the
 *                        reader can tap, so a swallowed navigation still has a
 *                        way through.
 *
 * `pagehide` is the signal that the navigation took: it fires when the
 * document is being left for Stripe and cancels the timer. bfcache restores
 * on the way back fire `pageshow`, not a fresh script run, so a reader who
 * reaches Stripe and taps Back within three seconds does not get a false
 * 'stuck' either.
 */

import { reportCheckoutHop } from './paywall-counter';
import type { PlanTierId } from './plan-features';

/** Long enough for a slow phone to start leaving; short enough to help. */
export const STUCK_AFTER_MS = 3000;

export interface GoToCheckoutOptions {
  /** The Stripe Checkout session id the URL opens, when the caller has it. */
  sessionId?: string | null;
  viewerTier: PlanTierId;
  /** Called with the URL if the page is still here after STUCK_AFTER_MS. */
  onStuck?: (url: string) => void;
}

/**
 * Report the hop, ask the browser to leave, and watch whether it did.
 *
 * Returns a cancel function for a component that unmounts before the timer
 * fires, so a stale `onStuck` never sets state on a dead component.
 */
export function goToCheckout(url: string, opts: GoToCheckoutOptions): () => void {
  if (typeof window === 'undefined') return () => {};

  const context = opts.sessionId ? { session: opts.sessionId } : undefined;
  reportCheckoutHop('checkout_redirect', { viewerTier: opts.viewerTier, context });

  let settled = false;
  const settle = () => {
    settled = true;
    window.clearTimeout(timer);
    window.removeEventListener('pagehide', settle);
  };

  const timer = window.setTimeout(() => {
    if (settled) return;
    settle();
    // Hidden means another tab or app is in front, which on a phone is what
    // an external checkout opening in a new activity looks like. Only a page
    // that is still the one on screen counts as stuck.
    if (document.visibilityState !== 'visible') return;
    reportCheckoutHop('checkout_stuck', { viewerTier: opts.viewerTier, context });
    opts.onStuck?.(url);
  }, STUCK_AFTER_MS);

  window.addEventListener('pagehide', settle);

  window.location.href = url;

  return settle;
}
