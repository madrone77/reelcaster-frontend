/**
 * The "share and get a free month" nag, and whether this browser has said no.
 *
 * Two surfaces carry it, a banner at the top of a spot page and a line under
 * the home city on the dashboard, and each has its own X. Dismissing one
 * hides that one for good on this browser; the other keeps asking until it
 * is dismissed in turn. Per browser rather than per account because the ask
 * is about this screen, and a column on user_settings for a nag is a
 * migration nobody needs.
 *
 * Every read and write is wrapped: on iOS with storage blocked the
 * localStorage getter itself throws, and a nag must never take a page down.
 */

export type ReferralNagSurface = 'spot' | 'dashboard';

const KEY_PREFIX = 'rc_referral_nag_dismissed:';

export function isReferralNagDismissed(surface: ReferralNagSurface): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(KEY_PREFIX + surface) !== null;
  } catch {
    return false;
  }
}

export function dismissReferralNag(surface: ReferralNagSurface): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_PREFIX + surface, new Date().toISOString());
  } catch {
    // Storage blocked. The line's own state hides it for this page view.
  }
}
