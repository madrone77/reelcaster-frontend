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

/**
 * Is this the path of a spot page?
 *
 * `/fishing/<country>/<state>/<city>/<spot>` is exactly five segments, and the
 * leaf must not be a segment a sibling route owns. Middleware uses this to
 * decide where to rewrite the ad frame, so it has to agree with the route tree
 * by construction rather than by a second regex kept in step by hand.
 */
export function isSpotPath(pathname: string): boolean {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts.length !== 5) return false;
  if (parts[0] !== FISHING_ROOT.slice(1)) return false;
  return !SPOT_RESERVED_SEGMENTS.has(parts[4]);
}

/**
 * The spot slug in a pathname, in either URL shape, or "" if it is neither.
 *
 * not-found.tsx is handed no params, so the slug has to come back off the URL,
 * and there are now two URLs a spot can be at: the canonical five-segment path
 * and the retired /explore/spot/<slug> that private custom spots never leave.
 */
export function spotSlugFromPath(pathname: string): string {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);

  if (parts[0] === "explore" && parts[1] === "spot" && parts[2]) {
    return decodeURIComponent(parts[2]);
  }
  if (isSpotPath(pathname)) return decodeURIComponent(parts[4]);
  // The ad frame hangs one segment below the spot page.
  if (parts.length === 6 && parts[5] === "ad" && isSpotPath(`/${parts.slice(0, 5).join("/")}`)) {
    return decodeURIComponent(parts[4]);
  }
  return "";
}

/**
 * The href for a spot link, given whatever the caller knows.
 *
 * Pass the canonical `path` when the surface has resolved one. When it has not
 * (a component with no city index, an unpublished city, a private custom
 * spot), this falls back to the retired one-segment URL, which still resolves
 * and 308s for anything with a public home.
 *
 * The fallback is a redirect hop, so it is a cost, not a default to settle
 * for: a surface that renders many spot links should thread a city index in
 * and give this a real path. It exists so that "we do not know the city here"
 * degrades to one extra request rather than to a fabricated URL that 404s.
 */
export function spotHref(
  spot: { path?: string | null; slug: string },
): string {
  return spot.path ?? legacySpotPath(spot.slug);
}
