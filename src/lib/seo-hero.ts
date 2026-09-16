/**
 * Which fishing pages carry the landing hero, as a hard-coded list.
 *
 * The hero (the search answered in words, the fish plate, Try Pro free) was
 * built for paid clicks and lived only behind `?ad=`. It is now the default
 * top of the public spot and city pages in the markets listed here — no
 * parameter, no referrer sniffing, no frame.
 *
 * WHY A LIST AND NOT A CONDITION. The first shape of this asked "did this
 * visitor arrive from a search engine, and are they signed out?" and branched
 * the page on the answer. That is cloaking: Googlebot is an anonymous request
 * with no referrer, so it would have been served a different page from the
 * human who found it, at the same URL. Serving one page to everybody removes
 * the divergence entirely — the crawler sees exactly what a reader sees — and
 * it keeps the route statically prerendered, because nothing here reads
 * `searchParams` or a request header.
 *
 * The hero is suppressed for signed-in readers, which is the one thing that
 * cannot be decided here: the session lives in localStorage, so no request
 * carries it. That check is in seo-hero.tsx and runs after hydration, where
 * it costs a crawler nothing — a crawler is never signed in.
 *
 * TO WIDEN: add a `<country>/<state>` pair. Washington is first because it is
 * where the Google Ads spend already is, so the hero's effect on organic
 * arrivals can be read against a market whose paid numbers we know.
 */
const SEO_HERO_MARKETS = new Set(["us/wa"]);

/**
 * Markets where only the SPOT page carries the hero; their city pages keep
 * the plain header. California joined on 2026-09-16, spot pages only.
 */
const SEO_HERO_SPOT_ONLY_MARKETS = new Set(["us/ca"]);

const marketKey = (country: string, state: string) =>
  `${country.toLowerCase()}/${state.toLowerCase()}`;

/** City pages (and their header). Route params as they arrive. */
export function seoHeroEnabled(country: string, state: string): boolean {
  return SEO_HERO_MARKETS.has(marketKey(country, state));
}

/** Spot pages: every city-page market plus the spot-only ones. */
export function seoHeroEnabledOnSpot(country: string, state: string): boolean {
  const key = marketKey(country, state);
  return SEO_HERO_MARKETS.has(key) || SEO_HERO_SPOT_ONLY_MARKETS.has(key);
}
