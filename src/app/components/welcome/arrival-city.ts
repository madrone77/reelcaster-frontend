"use client";

/**
 * Remember the URL somebody arrived on, so we can guess their home city from
 * it later.
 *
 * The best evidence of where a person fishes is the page they came in on. An
 * ad click lands on /lp/1/victoria-bc, an organic search lands on
 * /fishing/ca/bc/victoria or one of its spots, a shared link names a city in
 * `?loc`. All of that is a far stronger signal than an IP fix, which reports
 * the exit of whatever network they happen to be on.
 *
 * Only the FIRST such URL is kept. Someone who lands on Victoria and then
 * browses Prince Rupert out of curiosity still lives in Victoria, and the
 * arrival is the one moment we know was not idle clicking.
 *
 * Deliberately just the raw path plus the two query keys that can name a city.
 * Resolving that to a real city needs the place hierarchy, which is 58 KB and
 * already sitting in the server's Data Cache, so the matching happens in
 * /api/home-city/suggest rather than here. That also means a new URL shape
 * that mentions a city works without touching this file.
 *
 * localStorage rather than sessionStorage on purpose: signing up bounces
 * through Stripe and back, and a session store would lose the arrival across
 * exactly the round trip that matters.
 */

const KEY = "rc-arrival";

/** Cap what we keep: this is evidence, not a URL we will ever navigate to. */
const MAX_LENGTH = 300;

/**
 * Record this URL as the arrival, if none is recorded yet.
 *
 * Safe to call on every navigation. Never overwrites, so the first call of the
 * session wins and later browsing cannot drift the guess.
 */
export function recordArrival(pathname: string, search: string): void {
  try {
    if (localStorage.getItem(KEY)) return;
    const params = new URLSearchParams(search);
    // `loc` is Explore naming a city; `city` is the landing-page shape before
    // /lp/<variant> redirects it into the path.
    const named = params.get("loc") || params.get("city") || "";
    const value = named ? `${pathname}?city=${named}` : pathname;
    localStorage.setItem(KEY, value.slice(0, MAX_LENGTH));
  } catch {
    // A browser refusing storage simply has no arrival, and the suggestion
    // falls back to the IP fix.
  }
}

/** The recorded arrival URL, or null. */
export function readArrival(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Forget the arrival.
 *
 * Called once the home-city question has been put, answered or not. Keeping it
 * would mean a stale guess following someone around for a year, and it has
 * done its one job.
 */
export function clearArrival(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
