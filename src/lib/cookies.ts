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
/**
 * The scope these cookies are written at.
 *
 * They MUST outlive the hostname they were set on. Paid traffic lands on
 * try.reelcaster.com (see src/lib/landing-host.ts) and converts on
 * www.reelcaster.com, so a cookie left at its default host scope is invisible
 * by the time checkout reads it: every bought click would file as untagged,
 * and an offer claim made on a landing page would evaporate on the way to
 * /signup. That is not hypothetical, it is the failure mode this project has
 * already had once when capture and conversion disagreed about where the
 * record lived.
 *
 * Widened to the registrable domain rather than listing hosts, so a future
 * subdomain inherits it. Anything not under reelcaster.com (localhost, a
 * *.vercel.app preview) gets no domain attribute at all: naming a domain the
 * browser is not on makes it reject the cookie outright, which would take
 * local development and every preview down with it.
 */
const COOKIE_DOMAIN = '.reelcaster.com';

function domainAttribute(hostname: string): string {
  const onSite =
    hostname === 'reelcaster.com' || hostname.endsWith(COOKIE_DOMAIN);
  return onSite ? `; domain=${COOKIE_DOMAIN}` : '';
}

export function writeJsonCookie(name: string, value: object, maxAge: number): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    if (encoded.length + name.length > MAX_COOKIE_BYTES) return false;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    const domain = domainAttribute(window.location.hostname);
    // Clear the host-scoped twin before writing the domain-scoped one.
    //
    // Scope is part of a cookie's identity, so the two coexist under one name
    // and the browser sends BOTH in the same header. Nothing downstream can
    // tell them apart: readJsonCookie takes the first match, and the order is
    // the browser's business, not ours. On a rolling cookie like rc_paid that
    // is a stale value winning forever over the one just written. Deleting
    // first matches only the host-scoped record, because this line names no
    // domain, and leaves exactly one cookie behind.
    //
    // A no-op for anyone who never had one, which is everybody eventually.
    if (domain) document.cookie = `${name}=; path=/; max-age=0${secure}`;
    document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax${secure}${domain}`;
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
