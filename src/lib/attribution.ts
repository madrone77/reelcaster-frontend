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

import { clampField as clamp, readJsonCookie, writeJsonCookie } from './cookies';

export const ENTRY_COOKIE = 'rc_entry';
export const WALL_COOKIE = 'rc_wall';

const ENTRY_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const WALL_MAX_AGE = 60 * 30; // 30 minutes

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

/**
 * Record first touch. Safe to call on every page view: it returns early once
 * the cookie exists, so a visitor's fifth page does not overwrite the landing
 * page they actually arrived on.
 */
export function captureEntry(): void {
  if (typeof window === 'undefined') return;
  if (readJsonCookie<EntryAttribution>(ENTRY_COOKIE)) return;

  const params = new URLSearchParams(window.location.search);
  const entry: EntryAttribution = {
    entry_path: clamp(window.location.pathname),
    referrer: externalReferrer(),
    utm_source: clamp(params.get('utm_source')),
    utm_medium: clamp(params.get('utm_medium')),
    utm_campaign: clamp(params.get('utm_campaign')),
    ts: new Date().toISOString(),
  };
  writeJsonCookie(ENTRY_COOKIE, entry, ENTRY_MAX_AGE);
}

/** Record the wall currently being shown. Overwrites: last touch wins. */
export function captureWall(feature: string, from: string): void {
  if (typeof window === 'undefined') return;
  const wall: WallAttribution = {
    feature: clamp(feature),
    from: clamp(from),
    ts: new Date().toISOString(),
  };
  writeJsonCookie(WALL_COOKIE, wall, WALL_MAX_AGE);
}

export function readEntry(cookieHeader?: string): EntryAttribution | null {
  return readJsonCookie<EntryAttribution>(ENTRY_COOKIE, cookieHeader);
}

export function readWall(cookieHeader?: string): WallAttribution | null {
  return readJsonCookie<WallAttribution>(WALL_COOKIE, cookieHeader);
}
