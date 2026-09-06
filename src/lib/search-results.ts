/**
 * Search results, with each one's canonical path resolved.
 *
 * BlueCaster's `/api/v1/search` answers with slugs, and a slug is not enough
 * to build a URL on this site. A city's segment is its `url_slug`, not the
 * API slug the search returns ("victoria", not "victoria-bc"), and a spot's
 * URL is owned by whichever city is its home. Both facts live in the
 * hierarchy, which only the server holds, so the proxy resolves them once per
 * response and the palette just follows `path`.
 *
 * The alternative — the client concatenating a province code and a slug — is
 * what shipped, and every city row in the palette pointed at a URL that 404s
 * or, at best, cost a redirect hop.
 */

import {
  fetchHierarchy,
  type BlueCasterHierarchy,
  type BlueCasterSearchResult,
} from "@/lib/bluecaster";
import {
  getFishingCountries,
  getFishingProvinceByCode,
  spotPathIndex,
} from "@/app/fishing/lib/fishing-data";
import { legacySpotPath } from "@/lib/paths";

export interface SearchResult extends BlueCasterSearchResult {
  /**
   * Where this result leads, or null when nothing on this site renders it.
   *
   * Regions are always null: they are worth showing, because they tell a
   * reader the coverage is there, but they have no standalone page.
   */
  path: string | null;
}

function pathFor(
  r: BlueCasterSearchResult,
  spotPaths: Map<string, string>,
  cityPaths: Map<string, string>,
  hierarchy: BlueCasterHierarchy | null,
): string | null {
  switch (r.kind) {
    case "spot":
      // A spot with no published home has no /fishing address at all — a
      // private custom spot, or one in a city that is still building. The
      // retired one-segment URL is where those still render, and it is the
      // honest answer rather than a hop.
      return spotPaths.get(r.slug) ?? legacySpotPath(r.slug);
    case "city": {
      const path = cityPaths.get(r.slug);
      if (path) return path;
      // In the search index but with no page of its own, because every spot it
      // can reach is another city's home. The state index is the nearest true
      // answer, which is what the legacy redirect map does for a city that has
      // been unpublished.
      const code =
        typeof r.meta?.province_code === "string" ? r.meta.province_code : null;
      return code
        ? (getFishingProvinceByCode(hierarchy, code)?.path ?? null)
        : null;
    }
    default:
      return null;
  }
}

export async function resolveSearchPaths(
  results: BlueCasterSearchResult[],
): Promise<SearchResult[]> {
  // Region-only and empty responses never need the tree. The hierarchy fetch
  // is cached, but a search runs per keystroke, so skipping it is worth the
  // one line.
  if (!results.some((r) => r.kind === "spot" || r.kind === "city")) {
    return results.map((r) => ({ ...r, path: null }));
  }

  const hierarchy = await fetchHierarchy();
  const spotPaths = spotPathIndex(hierarchy);

  // Keyed on the API slug, which is what a search result carries. Unlike
  // `url_slug` that is unique across states, so one flat map is safe.
  const cityPaths = new Map<string, string>();
  for (const country of getFishingCountries(hierarchy)) {
    for (const province of country.provinces) {
      for (const city of province.cities) cityPaths.set(city.slug, city.path);
    }
  }

  return results.map((r) => ({
    ...r,
    path: pathFor(r, spotPaths, cityPaths, hierarchy),
  }));
}
