/**
 * In-app nudges: the one-at-a-time ask at the top of a spot page.
 *
 * Three nudges rotate through one banner. Each page view picks one at random
 * from those the account is still eligible for, so the tap rates stay
 * comparable (see the bluecaster Analytics → Nudges page).
 *
 *   share     share with a friend, get a free month. Never retires on its
 *             own: every friend is another month.
 *   catch     log a catch at this spot. Only for accounts with no catches
 *             yet; it is the ask that starts a catch log.
 *   feedback  how would you rate ReelCaster? Retired by the first rating.
 *
 * An X retires a nudge on the account, through the same
 * `user_settings.dismissed_nags` map the referral nag uses. The share nudge
 * keeps the referral nag's `spot` key, so an X from before this existed
 * still holds.
 *
 * Pure on purpose: routes import these checks, so nothing here may pull in
 * the browser Supabase client.
 */

export const NUDGES = ['share', 'catch', 'feedback'] as const;
export type Nudge = (typeof NUDGES)[number];

export const NUDGE_EVENT_KINDS = ['shown', 'open', 'dismiss', 'rate', 'done'] as const;
export type NudgeEventKind = (typeof NUDGE_EVENT_KINDS)[number];

export const NUDGE_SURFACES = ['spot'] as const;
export type NudgeSurface = (typeof NUDGE_SURFACES)[number];

/** The `dismissed_nags` key each nudge is retired under. */
export const NUDGE_DISMISS_KEY: Record<Nudge, string> = {
  share: 'spot',
  catch: 'catch',
  feedback: 'feedback',
};

const includes = (list: readonly string[], value: unknown): boolean =>
  typeof value === 'string' && list.includes(value);

export const isNudge = (v: unknown): v is Nudge => includes(NUDGES, v);
export const isNudgeEventKind = (v: unknown): v is NudgeEventKind =>
  includes(NUDGE_EVENT_KINDS, v);
export const isNudgeSurface = (v: unknown): v is NudgeSurface => includes(NUDGE_SURFACES, v);

export const isRating = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

/** A spot slug as the client sends it: short, lower case, url-safe. */
export function cleanSpotSlug(v: unknown): string | null {
  return typeof v === 'string' && /^[a-z0-9-]{1,120}$/.test(v) ? v : null;
}

export const FEEDBACK_NOTE_MAX = 2000;

/** What the server knows that decides eligibility, beyond dismissed_nags. */
export interface NudgeEligibility {
  hasCatch: boolean;
}

export function eligibleNudges(
  dismissed: Record<string, string> | null | undefined,
  eligibility: NudgeEligibility,
): Nudge[] {
  return NUDGES.filter((n) => {
    if (dismissed && typeof dismissed[NUDGE_DISMISS_KEY[n]] === 'string') return false;
    if (n === 'catch' && eligibility.hasCatch) return false;
    return true;
  });
}
