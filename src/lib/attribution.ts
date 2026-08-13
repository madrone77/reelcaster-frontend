/**
 * Where did this account come from, and which wall earned it?
 *
 * Two cookies carry the answer across the conversion boundary, because that
 * boundary is where every other carrier dies:
 *
 *   - React state and props die on the navigation to /signup or /plans.
 *   - sessionStorage dies on the redirect out to Stripe's hosted checkout.
 *   - The URL dies as soon as anyone shares or bookmarks the link, and it
 *     puts the referrer in a query string, which we don't do.
 *
 * Cookies survive all three, and the checkout route can read them server-side
 * without every caller having to thread props down to it.
 *
 *   rc_entry  90 days, WRITE-ONCE. First touch: landing path, referrer, UTM.
 *   rc_wall   30 minutes, rolling. Last touch: the paywall being looked at.
 *
 * rc_wall is deliberately short-lived. An hour after someone dismissed the
 * catch-reports wall, that wall is no longer why they signed up, and a stale
 * cookie would quietly claim the credit.
 *
 * Neither cookie carries an identifier. They describe the visit, not the
 * visitor, so there is no cross-site profile here and nothing to purge.
 */

export const ENTRY_COOKIE = 'rc_entry';
export const WALL_COOKIE = 'rc_wall';

const ENTRY_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const WALL_MAX_AGE = 60 * 30; // 30 minutes

/** Cookies have a 4KB budget and none of these fields earn more than this. */
const MAX_FIELD = 200;

export interface EntryAttribution {
  entry_path: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  ts: string;
}

export interface WallAttribution {
  /** A NagFeatureId from src/lib/plan-features.ts. */
  feature: string;
  /** The surface that opened the modal, e.g. "explore-forecast". */
  from: string;
  ts: string;
}

function clamp(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, MAX_FIELD);
}

/**
 * A referrer pointing at our own host is a page transition, not an entry
 * point. Recording it would make "reelcaster.com" the top acquisition source,
 * which is true and useless.
 */
function externalReferrer(): string {
  if (typeof document === 'undefined') return '';
  const raw = document.referrer;
  if (!raw) return '';
  try {
    if (new URL(raw).host === window.location.host) return '';
  } catch {
    return '';
  }
  return clamp(raw);
}

function writeCookie(name: string, value: object, maxAge: number): void {
  if (typeof document === 'undefined') return;
  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  } catch {
    // Safari with "Block All Cookies" throws on storage access rather than
    // failing quietly, which is how the app has white-screened before. Losing
    // attribution is fine; taking the page down over it is not.
  }
}

function readCookie<T>(name: string, source?: string): T | null {
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
    // A malformed cookie is not worth an error path. Attribution is a
    // nice-to-have on every code path that reads it.
    return null;
  }
}

/**
 * Record first touch. Safe to call on every page view: it returns early once
 * the cookie exists, so a visitor's fifth page does not overwrite the landing
 * page they actually arrived on.
 */
export function captureEntry(): void {
  if (typeof window === 'undefined') return;
  if (readCookie<EntryAttribution>(ENTRY_COOKIE)) return;

  const params = new URLSearchParams(window.location.search);
  const entry: EntryAttribution = {
    entry_path: clamp(window.location.pathname),
    referrer: externalReferrer(),
    utm_source: clamp(params.get('utm_source')),
    utm_medium: clamp(params.get('utm_medium')),
    utm_campaign: clamp(params.get('utm_campaign')),
    ts: new Date().toISOString(),
  };
  writeCookie(ENTRY_COOKIE, entry, ENTRY_MAX_AGE);
}

/** Record the wall currently being shown. Overwrites: last touch wins. */
export function captureWall(feature: string, from: string): void {
  if (typeof window === 'undefined') return;
  const wall: WallAttribution = {
    feature: clamp(feature),
    from: clamp(from),
    ts: new Date().toISOString(),
  };
  writeCookie(WALL_COOKIE, wall, WALL_MAX_AGE);
}

export function readEntry(cookieHeader?: string): EntryAttribution | null {
  return readCookie<EntryAttribution>(ENTRY_COOKIE, cookieHeader);
}

export function readWall(cookieHeader?: string): WallAttribution | null {
  return readCookie<WallAttribution>(WALL_COOKIE, cookieHeader);
}
