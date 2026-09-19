/**
 * Mixpanel `Trial Started` on /billing/success.
 *
 * This is the product conversion, not the ad-network one. Meta / Google /
 * Plausible wait on `/api/stripe/conversion-event` (and a 6s hard cap) because
 * they need trial-vs-paid and an event id that matches the webhook. Mixpanel
 * must not wait on that race: it fires as soon as this page knows the buyer
 * is Pro / trialing, once per Stripe `session_id`.
 *
 * Confirmation is any one of:
 *   - the checkout poll returned `is_active` (entitlement.isPro)
 *   - the signed-in subscription hook already shows paid / trialing Pro
 *   - the pay-first claim route provisioned (`signed_in` or `emailed`)
 *
 * Landing on the page, a dummy `session_id`, a poll timeout with Pro still
 * false, or a 202-timeout claim are not enough — those are unpaid or unfinished.
 */

import { trackEvent } from './analytics';

export const TRIAL_STARTED_STORAGE_PREFIX = 'rc_mixpanel_fired:';

export function trialStartedStorageKey(sessionId: string): string {
  return `${TRIAL_STARTED_STORAGE_PREFIX}${sessionId}`;
}

export type TrialStartedConfirmInput = {
  /** Stripe Checkout session id from the success URL. Required to dedupe. */
  sessionId: string | null;
  /** Checkout poll returned entitlement.isPro / is_active. */
  checkoutActive: boolean;
  /** Signed-in user_settings already show a paid / trialing Pro. */
  subscriptionPaid: boolean;
  /**
   * Pay-first claim route confirmed a completed session and a provisioned
   * account (`signed_in` or `emailed`). Not the 202-timeout fallback.
   */
  claimProvisioned: boolean;
};

/** True when Mixpanel may fire for this success-page visit. */
export function isTrialStartedConfirmable(input: TrialStartedConfirmInput): boolean {
  if (!input.sessionId) return false;
  return input.checkoutActive || input.subscriptionPaid || input.claimProvisioned;
}

export type TrialStartedStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/**
 * Once-per-session guard. Returns true if this `session_id` has not yet been
 * marked, and marks it. Storage throws (iOS with cookies blocked) are treated
 * as "fire" — skipping there would lose every trial those browsers start.
 */
export function consumeTrialStartedGuard(
  sessionId: string,
  storage: TrialStartedStorage | null,
): boolean {
  if (!sessionId) return false;
  if (!storage) return true;
  const key = trialStartedStorageKey(sessionId);
  try {
    if (storage.getItem(key)) return false;
    storage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}

export type TrialStartedProperties = {
  tier?: string;
  status?: string;
  claimed?: string;
};

/**
 * Fire Mixpanel `Trial Started` once per Stripe session_id.
 * Returns whether this call sent the event.
 */
export function trackTrialStartedOnce(
  sessionId: string,
  properties?: TrialStartedProperties,
): boolean {
  const storage =
    typeof window === 'undefined' ? null : window.sessionStorage;
  if (!consumeTrialStartedGuard(sessionId, storage)) return false;
  trackEvent('Trial Started', properties);
  return true;
}
