/**
 * Is this browser one of ours?
 *
 * Internal views were 70% of the site's page counter in the fortnight before
 * this was written: reel captures, previews, and the team checking its own
 * work. Two ways to say so, both honoured:
 *
 *   rc_internal=1 cookie   set once in a browser used for captures and demos,
 *                          with no account involved. Any value but "0" counts.
 *   NEXT_PUBLIC_ANALYTICS_INTERNAL_USER_IDS
 *                          comma-separated Supabase user ids for team accounts,
 *                          so signing in on a fresh phone is enough.
 *
 * The answer is applied by opting the SDKs out (see analytics.ts), which is
 * persisted by the SDKs themselves, so it survives the cookie being cleared
 * only as long as their own storage does. Good enough: the goal is that a
 * team member's ordinary day does not read as a customer's.
 */
export function isInternalBrowser(): boolean {
  if (typeof document === 'undefined') return false;
  const m = document.cookie.match(/(?:^|;\s*)rc_internal=([^;]*)/);
  return !!m && m[1] !== '0' && m[1] !== '';
}

export function isInternalUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const raw = process.env.NEXT_PUBLIC_ANALYTICS_INTERNAL_USER_IDS ?? '';
  if (!raw) return false;
  return raw.split(',').map((s) => s.trim()).filter(Boolean).includes(userId);
}
