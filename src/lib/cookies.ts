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

export function clampField(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, MAX_FIELD);
}

export function writeJsonCookie(name: string, value: object, maxAge: number): void {
  if (typeof document === 'undefined') return;
  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  } catch {
    // Safari with "Block All Cookies" throws on storage access rather than
    // failing quietly, which is how the app has white-screened before. Losing
    // a cookie is fine; taking the page down over it is not.
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
