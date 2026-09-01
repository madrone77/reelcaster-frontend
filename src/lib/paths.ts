/**
 * Every public /fishing URL is built here.
 *
 * These paths used to be interpolated by hand at about fifty call sites, which
 * is survivable while a spot URL is one segment off a slug and is not
 * survivable now that it is four segments deep and needs the country, the
 * state and the city to build at all. One builder also means one place that
 * lowercases, and one place to change when a level is added.
 *
 * The shape:
 *
 *   /fishing/ca/bc                                    state
 *   /fishing/ca/bc/victoria                           city
 *   /fishing/ca/bc/victoria/oak-bay                   spot
 *   /fishing/ca/bc/victoria/species/chinook-salmon    species guide
 *
 * Spots and guides share a depth, which is why guides carry the literal
 * `species` segment: Next ranks a static segment above a dynamic one, so
 * /fishing/ca/bc/victoria/species/x can never be read as a spot named
 * "species". SPOT_RESERVED_SEGMENTS keeps the reverse true.
 */

/**
 * Where a spot or a guide sits, without the leaf.
 *
 * `cityUrlSlug` is the city's `url_slug`, NOT its `slug`. The slug carries a
 * province suffix and is what the BlueCaster API wants; putting it in a path
 * spells the province twice.
 */
export interface PlaceLocation {
  /** ISO country code, any case: "CA", "US". */
  countryCode: string;
  /** State or province code, any case: "BC", "WA". */
  stateCode: string;
  /** cities.url_slug: "victoria", "seattle". */
  cityUrlSlug: string;
}

/**
 * Path segments are lowercased on the way out.
 *
 * Vercel resolves dynamic routes case-insensitively, so /Fishing/CA/BC and
 * /fishing/ca/bc are the same page at two URLs. Four dynamic segments is a lot
 * of casings to leak into a sitemap or an internal link, and middleware's
 * lowercase 308 is a net, not a licence to emit mixed case.
 */
function seg(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Leaf segments a spot slug may not take, because a route above it already
 * owns the word. Only `species` today.
 *
 * Nothing generates a slug like this, but a spot named "Species" would produce
 * one, and the failure would be a spot page that silently serves a guide
 * index instead.
 */
export const SPOT_RESERVED_SEGMENTS = new Set(["species", "ad"]);

export const FISHING_ROOT = "/fishing";

export function countryPath(countryCode: string): string {
  return `${FISHING_ROOT}/${seg(countryCode)}`;
}

export function statePath(countryCode: string, stateCode: string): string {
  return `${countryPath(countryCode)}/${seg(stateCode)}`;
}

export function cityPath(loc: PlaceLocation): string {
  return `${statePath(loc.countryCode, loc.stateCode)}/${seg(loc.cityUrlSlug)}`;
}

export function spotPath(loc: PlaceLocation, spotSlug: string): string {
  return `${cityPath(loc)}/${seg(spotSlug)}`;
}

/** The ad frame of a spot page. Rewritten to by middleware on `?ad=`. */
export function spotAdPath(loc: PlaceLocation, spotSlug: string): string {
  return `${spotPath(loc, spotSlug)}/ad`;
}

export function guidePath(loc: PlaceLocation, speciesSlug: string): string {
  return `${cityPath(loc)}/species/${seg(speciesSlug)}`;
}

// ── Legacy ─────────────────────────────────────────────────────────────────

/**
 * The retired one-segment spot URL, kept because it is the only spot path a
 * caller holding nothing but a slug can build.
 *
 * ⚠️ Do not use this for a link on a page. It costs a redirect hop and points
 * the crawler at a URL we are trying to retire. It exists for the redirect
 * route itself, for tests, and as the honest answer where a caller genuinely
 * cannot resolve a spot's city.
 *
 * These URLs must keep resolving indefinitely: score alerts and weekend
 * digests already sent carry them, and mail does not get re-written.
 */
export const LEGACY_SPOT_PREFIX = "/explore/spot";

export function legacySpotPath(spotSlug: string): string {
  return `${LEGACY_SPOT_PREFIX}/${seg(spotSlug)}`;
}

/**
 * The retired /fishing/<province>/<city> shape, where the province stood in
 * for both country and state and the city kept its suffix.
 *
 * Only the redirect map builds these. Kept here so the two shapes are written
 * down side by side rather than one being a string in middleware.
 */
export function legacyProvincePath(stateCode: string): string {
  return `${FISHING_ROOT}/${seg(stateCode)}`;
}

export function legacyCityPath(stateCode: string, citySlug: string): string {
  return `${legacyProvincePath(stateCode)}/${seg(citySlug)}`;
}
