/**
 * The referral share taps worth recording, and the check a request body must
 * pass before one lands in `referral_share_events`.
 *
 * Pure on purpose: the route imports these, so nothing here may pull in the
 * browser Supabase client. The client write is in referral-share-log.ts.
 */

export const REFERRAL_SHARE_KINDS = ['open', 'copy', 'share', 'shared', 'dismiss'] as const;
export type ReferralShareKind = (typeof REFERRAL_SHARE_KINDS)[number];

export const REFERRAL_SHARE_SURFACES = ['spot', 'dashboard', 'account'] as const;
export type ReferralShareSurface = (typeof REFERRAL_SHARE_SURFACES)[number];

export function isReferralShareKind(value: unknown): value is ReferralShareKind {
  return typeof value === 'string' && (REFERRAL_SHARE_KINDS as readonly string[]).includes(value);
}

export function isReferralShareSurface(value: unknown): value is ReferralShareSurface {
  return (
    typeof value === 'string' && (REFERRAL_SHARE_SURFACES as readonly string[]).includes(value)
  );
}
