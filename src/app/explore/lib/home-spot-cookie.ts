/**
 * The home-spot pin, mirrored into a cookie so the SERVER can read it.
 *
 * The pin itself lives in localStorage plus `user_metadata.preferences`
 * (see ./use-home-spot). Neither is readable while /explore is being
 * rendered: this app keeps its Supabase session in localStorage, not in a
 * cookie, so a server component has no identity to look the angler up with.
 *
 * That matters because the opening frame has to be chosen before any HTML is
 * written. Waiting for the bundle to hydrate and then flying the camera to
 * the home city is the exact behaviour ./opening-city.ts was written to avoid
 * — the angler would land on one piece of water and be moved to another.
 *
 * So the write path drops a plain cookie alongside every local write, and
 * /explore reads it the way it reads the geo headers: a hint that arrives with
 * the request. It carries a spot slug and nothing else — no identity, no
 * token — and it is same-site, so it never leaves our own origin.
 */

export const HOME_SPOT_COOKIE = "rc-home-spot";

// A pin the angler set once should still be there next season.
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Slugs only, at both ends.
 *
 * The value is written by client JS, so anything can end up in it — and it is
 * about to be interpolated into an upstream request. Everything the product
 * generates matches this; anything that doesn't is treated as no pin at all.
 */
export function sanitizeHomeSpotSlug(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return /^[a-z0-9-]{1,80}$/.test(value) ? value : null;
}

/**
 * Mirror `slug` into the cookie, or clear it when null. Client only; a no-op
 * anywhere `document` doesn't exist.
 *
 * `SameSite=Lax` because this is only ever read on a top-level navigation to
 * our own /explore. `Secure` off localhost so `next dev` keeps working.
 */
export function writeHomeSpotCookie(slug: string | null): void {
  if (typeof document === "undefined") return;
  const clean = sanitizeHomeSpotSlug(slug);
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = clean
    ? `${HOME_SPOT_COOKIE}=${clean}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
    : `${HOME_SPOT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}
