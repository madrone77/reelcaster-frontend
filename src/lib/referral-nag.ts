/**
 * The "share and get a free month" nag, and whether this ACCOUNT has said no.
 *
 * Two surfaces carry it, a banner at the top of a spot page and a line under
 * the home city on the dashboard, and each has its own X. Dismissing one
 * hides that one for good, on every browser the account signs in on; the
 * other keeps asking until it is dismissed in turn.
 *
 * The answer lives on `user_settings.dismissed_nags`, a map of surface to
 * the time it was dismissed, read with the rest of the row by the
 * subscription store and written through POST /api/referrals/dismiss. It
 * used to live in localStorage, which meant a no on the phone was a yes on
 * the laptop.
 *
 * Pure on purpose: the route imports the surface check, so nothing here may
 * pull in the browser Supabase client. The write lives in the component.
 */

export const REFERRAL_NAG_SURFACES = ['spot', 'dashboard'] as const;
export type ReferralNagSurface = (typeof REFERRAL_NAG_SURFACES)[number];

export function isReferralNagSurface(value: unknown): value is ReferralNagSurface {
  return (
    typeof value === 'string' && (REFERRAL_NAG_SURFACES as readonly string[]).includes(value)
  );
}

export function isReferralNagDismissed(
  dismissed: Record<string, string> | null | undefined,
  surface: ReferralNagSurface,
): boolean {
  return !!dismissed && typeof dismissed[surface] === 'string';
}
