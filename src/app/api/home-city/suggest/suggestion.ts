/**
 * The shared pieces of the home-city suggestion.
 *
 * Split out of ./route.ts because a Next route module may only export request
 * handlers and a fixed set of config names — exporting anything else fails the
 * generated route types. Both the client, which needs the response shape, and
 * the tests, which need the matcher, import from here instead.
 */

import type { CityPoint } from "@/lib/nearby-spots";

export interface HomeCitySuggestion {
  slug: string;
  name: string;
}

export interface HomeCitySuggestResponse {
  suggested: HomeCitySuggestion | null;
  /** Where `suggested` came from, so the client can weight its copy. */
  source: "arrival" | "ip" | null;
  alternates: HomeCitySuggestion[];
  /** Every covered city, for the modal's typeahead. Names and slugs only. */
  all: HomeCitySuggestion[];
}

export const asSuggestion = (c: CityPoint): HomeCitySuggestion => ({
  slug: c.slug,
  name: c.name,
});

/**
 * Find a city named anywhere in an arrival URL.
 *
 * Every /fishing and /lp shape puts the city in a path segment, and Explore
 * puts it in `?loc`, so rather than encode five route shapes this walks the
 * segments and asks the hierarchy about each one. Matching is against both
 * `slug` ("victoria-bc", what the API and ?loc use) and the trailing-suffix
 * form that /fishing paths carry ("victoria"), because the two differ and both
 * appear in real URLs.
 *
 * Later segments are tried first: in /fishing/ca/bc/victoria the city is the
 * last thing named, and in /fishing/ca/bc/victoria/oak-bay-flats-x the spot
 * slug sits after it and matches nothing, so order only helps.
 */
export function cityFromArrival(
  arrival: string | null,
  cities: CityPoint[],
): CityPoint | null {
  if (!arrival) return null;

  // Split the recorded "path?city=slug" back apart. Not a real URL parse: the
  // value is ours, written by ./arrival-city, and is a path not an origin.
  const [path, query = ""] = arrival.split("?");
  const named = new URLSearchParams(query).get("city");

  const candidates = [
    ...(named ? [named] : []),
    ...path.split("/").filter(Boolean).reverse(),
  ].map((s) => decodeURIComponent(s).toLowerCase());

  for (const candidate of candidates) {
    const exact = cities.find((c) => c.slug === candidate);
    if (exact) return exact;
    // "/fishing/ca/bc/victoria" carries the url_slug, which is the city slug
    // with its province suffix removed. Match on that shape too, but only when
    // it is unambiguous: two provinces can both have a Richmond.
    const bySuffix = cities.filter((c) => c.slug.replace(/-[a-z]{2}$/, "") === candidate);
    if (bySuffix.length === 1) return bySuffix[0];
  }
  return null;
}
