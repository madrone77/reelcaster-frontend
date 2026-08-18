/**
 * Where did this account come from, and which wall earned it?
 *
 * Three cookies carry the answer across the conversion boundary, because that
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
 *   rc_paid   90 days, rolling.    Last touch on a click we PAID for.
 *   rc_wall   30 minutes, rolling. Last touch: the paywall being looked at.
 *
 * Why rc_paid exists when rc_entry already records first touch: write-once
 * first touch systematically undercredits paid acquisition. Someone who finds
 * a city page in January, clicks a Meta ad in March, and subscribes is filed
 * as organic, and the ad that actually closed them gets nothing. The better
 * the SEO does, the worse that bias gets, which is precisely backwards for
 * deciding where to spend money. So both are kept, reported side by side, and
 * the gap between them stays visible instead of being silently baked into one
 * number.
 *
 * rc_wall is deliberately short-lived. An hour after someone dismissed the
 * catch-reports wall, that wall is no longer why they signed up, and a stale
 * cookie would quietly claim the credit.
 *
 * Neither cookie carries an identifier we issued. They describe the visit, not
 * the visitor. Click ids are the exception and are the reason this file is
 * named in the privacy policy: gclid and fbclid are assigned by the ad network
 * and are personal data, so they ride the same 90-day expiry as everything
 * else here and are never written into a URL we emit.
 */

import {
  clampField as clamp,
  clampQuery,
  readJsonCookie,
  writeJsonCookie,
} from './cookies';

export const ENTRY_COOKIE = 'rc_entry';
export const WALL_COOKIE = 'rc_wall';
export const PAID_COOKIE = 'rc_paid';

const ENTRY_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const WALL_MAX_AGE = 60 * 30; // 30 minutes

/**
 * 90 days, matching the window Google allows for uploading an offline
 * conversion against a gclid. A paid click older than that cannot be reported
 * back to the network that sold it, so holding it longer would only produce
 * credit we can act on in our own dashboard and nowhere else.
 */
const PAID_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * Click ids, in priority order. One visit is one click, so at most one of
 * these is ever present; the order only decides the winner in the pathological
 * case of a hand-built URL carrying several.
 *
 * gbraid and wbraid are not optional extras. On iOS, Google suppresses gclid
 * and sends one of these instead, so capturing gclid alone quietly loses the
 * larger half of a mobile-first audience.
 */
export const CLICK_TYPES = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'] as const;

export type ClickType = (typeof CLICK_TYPES)[number];

/**
 * Mediums we treat as bought traffic when no click id is present. A click id
 * is the stronger signal and is checked first; this list is the fallback for
 * networks that don't stamp one, and for hand-tagged placements.
 */
const PAID_MEDIUMS = new Set([
  'cpc',
  'ppc',
  'paid',
  'paidsocial',
  'paid_social',
  'display',
  'retargeting',
  'remarketing',
]);

/**
 * The long tail: everything the UTM five have no slot for. Kept in a bag
 * rather than promoted to columns because the list will keep growing and a
 * migration per parameter is a bad trade for values the dashboard groups by
 * occasionally rather than constantly.
 *
 *   city/species/spot  which slice of the product the ad pointed at
 *   variant            creative or landing-page test arm
 *   offer              offer code, mirrored from rc_offer for paid links
 *   adgroup            Google ad group id, {adgroupid}
 *   net                g | s | d — search, search partners, display
 *   match              exact | phrase | broad
 *   dev                m | t | c — mobile, tablet, desktop
 *   loc                {loc_physical_ms}, where the click physically was
 *   plc                Meta placement: feed, story, reels
 */
export const EXTRA_PARAMS = [
  'city',
  'species',
  'spot',
  'variant',
  'offer',
  'adgroup',
  'net',
  'match',
  'dev',
  'loc',
  'plc',
] as const;

/** Parsed campaign parameters, shared by first touch and paid touch. */
export interface CampaignParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  /** The click id itself. Case-sensitive, never normalised. */
  click_id: string;
  /** Which network issued `click_id`, so the upload knows where to send it. */
  click_type: ClickType | '';
  /** The long tail above. Absent keys are simply not present. */
  params: Record<string, string>;
}

export interface EntryAttribution extends CampaignParams {
  entry_path: string;
  referrer: string;
  /**
   * The landing query string, verbatim.
   *
   * Insurance, and the only field here that buys back the past. Whatever list
   * of parameters we standardise on today will be missing one we want in three
   * months; with the raw string kept, that parameter can be back-filled across
   * every visit already recorded instead of starting the clock over. Dropped
   * first if the cookie runs out of room, because it is the one field that is
   * redundant with the others on the day it is written.
   */
  raw_query: string;
  ts: string;
}

export interface PaidAttribution extends CampaignParams {
  /** Where the bought click actually landed, which is rarely the home page. */
  landing_path: string;
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
 * Lower-cased and trimmed.
 *
 * Without this, `utm_source=Google` and `utm_source=google` become two rows in
 * every report forever, and no amount of downstream modelling puts them back
 * together. Applied to everything EXCEPT click ids, which are opaque
 * network-issued tokens where case is significant and mangling one makes the
 * conversion unattributable at upload time.
 */
function norm(value: string | null | undefined): string {
  return clamp(value).trim().toLowerCase();
}

/** Pull the campaign shape out of a query string. */
function readCampaign(params: URLSearchParams): CampaignParams {
  let clickId = '';
  let clickType: ClickType | '' = '';
  for (const key of CLICK_TYPES) {
    const raw = params.get(key);
    if (raw) {
      clickId = clamp(raw); // deliberately not normalised
      clickType = key;
      break;
    }
  }

  const extras: Record<string, string> = {};
  for (const key of EXTRA_PARAMS) {
    const value = norm(params.get(key));
    if (value) extras[key] = value;
  }

  return {
    utm_source: norm(params.get('utm_source')),
    utm_medium: norm(params.get('utm_medium')),
    utm_campaign: norm(params.get('utm_campaign')),
    utm_content: norm(params.get('utm_content')),
    utm_term: norm(params.get('utm_term')),
    click_id: clickId,
    click_type: clickType,
    params: extras,
  };
}

/** Did we pay for this visit? */
function isPaid(campaign: CampaignParams): boolean {
  if (campaign.click_type) return true;
  return PAID_MEDIUMS.has(campaign.utm_medium);
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
    ...readCampaign(params),
    entry_path: clamp(window.location.pathname),
    referrer: externalReferrer(),
    raw_query: clampQuery(window.location.search),
    ts: new Date().toISOString(),
  };

  // Cookies get a 4KB budget and a silently truncated one decodes to nothing,
  // taking the whole record with it. raw_query is the only field here that is
  // recoverable from its neighbours today, so it is what gets dropped.
  if (!writeJsonCookie(ENTRY_COOKIE, entry, ENTRY_MAX_AGE)) {
    writeJsonCookie(ENTRY_COOKIE, { ...entry, raw_query: '' }, ENTRY_MAX_AGE);
  }
}

/**
 * Record the most recent click we paid for. Overwrites: unlike first touch,
 * the point of this record is that the newest paid click is the one that
 * closed the sale.
 *
 * Safe to call on every page view. A visit carrying no paid markers leaves any
 * existing cookie untouched rather than blanking it, so browsing five organic
 * pages after arriving on an ad does not erase the ad.
 */
export function capturePaidTouch(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const campaign = readCampaign(params);
  if (!isPaid(campaign)) return;

  const paid: PaidAttribution = {
    ...campaign,
    landing_path: clamp(window.location.pathname),
    ts: new Date().toISOString(),
  };
  writeJsonCookie(PAID_COOKIE, paid, PAID_MAX_AGE);
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

export function readPaid(cookieHeader?: string): PaidAttribution | null {
  return readJsonCookie<PaidAttribution>(PAID_COOKIE, cookieHeader);
}

export function readWall(cookieHeader?: string): WallAttribution | null {
  return readJsonCookie<WallAttribution>(WALL_COOKIE, cookieHeader);
}
