/**
 * `?next=` handling for the auth pages.
 *
 * /login and /signup used to ignore it and always land on /dashboard or
 * /explore, which quietly broke every "sign in and come back" funnel — most
 * visibly the paywall path (modal → /plans/checkout → sign in → …/explore, and
 * the purchase never happens).
 *
 * Read from `window.location` rather than `useSearchParams()` so the auth
 * pages don't need a Suspense boundary just to know where to return to.
 */

/**
 * Same-origin relative paths only. An attacker-supplied `next` is otherwise an
 * open redirect: `//evil.com` and `https://evil.com` both leave the site, and
 * `/\evil.com` is treated as protocol-relative by some browsers.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    /* already decoded, or malformed escaping — fall through and validate */
  }
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

/** The validated `?next=` of the current URL, or `fallback`. */
export function readNextParam(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = new URLSearchParams(window.location.search).get('next');
  return safeNextPath(raw) ?? fallback;
}
