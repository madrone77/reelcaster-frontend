/**
 * The home-city choice, mirrored into a cookie so the SERVER can read it.
 *
 * Exactly the same problem, and the same answer, as ./home-spot-cookie: this
 * app keeps its Supabase session in localStorage, so a server component
 * rendering /explore has no identity to look the angler up with, and the
 * opening frame has to be chosen before any HTML is written. So every local
 * write drops a plain cookie alongside it, and the page reads that the way it
 * reads the geo headers: a hint that arrives with the request.
 *
 * It carries a city slug and nothing else. No identity, no token, same-site,
 * so it never leaves our own origin.
 */

export const HOME_CITY_COOKIE = "rc-home-city";

// A home city is a statement about where someone lives, not where they are
// this week. It should outlast the season.
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Slugs only, at both ends.
 *
 * Written by client JS and interpolated into an upstream request path, so it
 * gets the same treatment the spot slug does: anything that is not slug-shaped
 * is treated as no choice at all rather than passed along.
 */
export function sanitizeHomeCitySlug(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return /^[a-z0-9-]{1,80}$/.test(value) ? value : null;
}

/**
 * Mirror `slug` into the cookie, or clear it when null. Client only; a no-op
 * on the server, where there is no `document` to write to.
 */
export function writeHomeCityCookie(slug: string | null): void {
  if (typeof document === "undefined") return;
  const clean = sanitizeHomeCitySlug(slug);
  document.cookie = clean
    ? `${HOME_CITY_COOKIE}=${clean}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`
    : `${HOME_CITY_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
