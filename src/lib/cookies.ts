/**
 * The two cookie primitives shared by everything that has to survive the
 * conversion boundary — attribution (src/lib/attribution.ts) and offer claims
 * (src/lib/offers.ts).
 *
 * Extracted so the Safari failure mode below is handled in exactly one place.
 * Both callers store a small JSON object and read it back on the server from a
 * raw Cookie header, so they want the same encode/decode pair rather than two
 * that can drift apart.
 */

/** Cookies have a 4KB budget and no field we store earns more than this. */
export const MAX_FIELD = 200;

/**
 * The one exception to MAX_FIELD: a verbatim landing query string, which is
 * deliberately several parameters long. Still capped, because an attacker (or
 * a broken redirect chain) can put arbitrary length in a URL and the cookie
 * budget is shared with the session.
 */
export const MAX_QUERY = 400;

/**
 * Refuse to write past this, in encoded bytes.
 *
 * Browsers do not report a cookie that exceeds the 4KB limit; they drop it, so
 * the next read returns nothing and the record is lost in full rather than in
 * part. Checking first lets the caller shed a field and try again, which is
 * strictly better than discovering the loss at conversion time.
 */
const MAX_COOKIE_BYTES = 3800;

export function clampField(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, MAX_FIELD);
}

export function clampQuery(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, MAX_QUERY);
}

/**
 * @returns true if the cookie was written, false if it was too large to fit.
 *   A storage-blocked browser also returns true: nothing was persisted, but
 *   retrying with fewer fields would not change that, and the caller's only
 *   fallback is to write less.
 */
export function writeJsonCookie(name: string, value: object, maxAge: number): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    if (encoded.length + name.length > MAX_COOKIE_BYTES) return false;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
    return true;
  } catch {
    // Safari with "Block All Cookies" throws on storage access rather than
    // failing quietly, which is how the app has white-screened before. Losing
    // a cookie is fine; taking the page down over it is not.
    return true;
  }
}

export function readJsonCookie<T>(name: string, source?: string): T | null {
  const jar = source ?? (typeof document === 'undefined' ? '' : document.cookie);
  if (!jar) return null;
  const hit = jar
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!hit) return null;
  try {
    return JSON.parse(decodeURIComponent(hit.slice(name.length + 1))) as T;
  } catch {
    // A malformed cookie is not worth an error path. Every caller treats a
    // missing value as "no information", which is the same answer.
    return null;
  }
}
