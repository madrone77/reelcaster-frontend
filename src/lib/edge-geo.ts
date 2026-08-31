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

/** A coarse position, as the edge resolved it. */
export interface EdgeGeoPoint {
  lat: number;
  lng: number;
}

/**
 * The caller's approximate coordinates, or null when the edge did not resolve
 * any — a data-centre IP, `next dev`, or a network the resolver has no fix for.
 *
 * Separate from `readEdgeGeo` above because the two answer different
 * questions and fail independently: a request can carry a country and no
 * lat/lng, and a caller that wants to snap to the nearest city needs the
 * numbers rather than the names.
 *
 * `devOverride` stands in for the headers outside production, so a surface
 * built on this can be exercised on localhost and on a preview where the
 * platform sets no geo at all. The gate is `VERCEL_ENV === "production"`,
 * which the platform sets and we do not: on prod the override is never read,
 * so it cannot be used to make a response claim a visitor is somewhere else.
 *
 * Both params are required together — a lone `geo_lat` used to fall through to
 * `Number(null) === 0` and place the caller in the Gulf of Guinea.
 */
export function readEdgeGeoPoint(
  headers: Headers,
  devOverride?: URLSearchParams,
): EdgeGeoPoint | null {
  if (devOverride && process.env.VERCEL_ENV !== 'production') {
    const lat = Number(devOverride.get('geo_lat'));
    const lng = Number(devOverride.get('geo_lng'));
    if (
      devOverride.has('geo_lat') &&
      devOverride.has('geo_lng') &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      return { lat, lng };
    }
  }

  const lat = parseFloat(headers.get('x-vercel-ip-latitude') ?? '');
  const lng = parseFloat(headers.get('x-vercel-ip-longitude') ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
