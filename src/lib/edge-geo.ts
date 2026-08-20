/**
 * Where a request came from, as far as the edge will say.
 *
 * NO IP IS STORED, here or anywhere downstream. Vercel resolves the address to
 * a coarse place before our code runs and hands us the result in
 * `x-vercel-ip-*`. We keep the result and never see the address, which is both
 * the privacy-preserving choice and the reason no third-party geo-IP service
 * appears in this path. See the same argument at length in the
 * 20260819_signup_geo_capture migration.
 *
 * Precision is city-level at best and often much worse: a mobile carrier can
 * put a Victoria angler in Vancouver, and a VPN puts them wherever they like.
 * Good enough to answer "which market did this campaign reach", never good
 * enough to act on for one individual.
 *
 * `src/app/api/attribution/signup/route.ts` reads the same headers with its
 * own copy of this logic, written before there was a second caller. The header
 * names are a fixed contract from Vercel rather than a judgement call, so the
 * two cannot disagree about anything that matters; new callers should use this
 * one.
 */

/** Cap on any single stored value. Longer than any real city name. */
const MAX_VALUE = 120;

export interface EdgeGeo {
  /** ISO-3166-1 alpha-2, e.g. "CA". */
  country: string | null;
  /** Subdivision code, e.g. "BC" or "WA". Not the same vocabulary as our own
   *  region slugs, which a user picks for themselves. */
  region: string | null;
  /** Nearest city the edge resolved, URL-decoded. */
  city: string | null;
}

/**
 * Read one header, decoded and trimmed.
 *
 * Vercel percent-encodes city names, so "Campbell%20River" arrives looking
 * like one word unless this decodes it. A malformed escape is not worth
 * dropping the whole location over, so a failed decode keeps the raw value.
 */
function geoHeader(headers: Headers, name: string): string | null {
  const raw = headers.get(name);
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // Keep the raw value rather than losing the field.
  }
  value = value.trim();
  return value ? value.slice(0, MAX_VALUE) : null;
}

/**
 * The coarse location of this request. Every field is independently nullable:
 * local development sends none of these headers, and some networks resolve a
 * country without a city.
 */
export function readEdgeGeo(headers: Headers): EdgeGeo {
  return {
    country: geoHeader(headers, 'x-vercel-ip-country'),
    region: geoHeader(headers, 'x-vercel-ip-country-region'),
    city: geoHeader(headers, 'x-vercel-ip-city'),
  };
}
