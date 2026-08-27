/**
 * Where an ad link goes, expressed as pure functions over a URL.
 *
 * Split out of src/app/lp/lp-entry.ts so middleware can use it. Middleware runs
 * on the edge and cannot import `next/navigation`, and the landing host needs
 * exactly this logic BEFORE routing rather than inside a page: see
 * src/lib/landing-host.ts for why the doorway hop happens there.
 *
 * Nothing in here touches a request or a response, which is the rule that keeps
 * one copy of the answer instead of two that drift.
 */

/**
 * Where an untagged or unroutable link goes. Victoria is the pilot city and
 * the one guaranteed to have scored spots to show.
 */
export const DEFAULT_LP_CITY = 'victoria-bc';

/**
 * Fallback for the US-market variant. A Seattle page must not answer an
 * untagged link with a Canadian city: the whole variant is built around
 * American water, down to the flag in the header.
 */
export const DEFAULT_US_LP_CITY = 'seattle-wa';

/**
 * The city a variant falls back to when its link carries no `?city=`.
 *
 * Only variants that differ from the pilot city need a row. This is the same
 * value each doorway page passes to `enterLp`, kept here because middleware
 * answers the doorway on the landing host and the two must agree: a variant
 * listed in one and not the other would send American chrome to Victoria on
 * one host and Seattle on the other, for the same ad.
 */
export const LP_FALLBACK_CITY: Record<string, string> = {
  '6': DEFAULT_US_LP_CITY,
};

/** City slugs are lowercase kebab, e.g. "victoria-bc", "friday-harbor-wa". */
const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type LpSearchParams = Record<string, string | string[] | undefined>;

/**
 * Reduce `?city=` to a routable slug.
 *
 * Lower-cased before matching because Vercel resolves paths case-insensitively:
 * left alone, `?city=Victoria-BC` would produce a second URL for the same page
 * and split its cache entry and its analytics.
 *
 * Anything that isn't slug-shaped falls back to the default rather than
 * throwing. A malformed tag is a mistake in a link we wrote, and the cost of
 * being strict about it is a 404 served to traffic we already paid for.
 */
export function resolveLpCity(
  raw: string | string[] | undefined,
  fallback: string = DEFAULT_LP_CITY,
): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const slug = (first ?? '').trim().toLowerCase();
  return SLUG_SHAPE.test(slug) ? slug : fallback;
}

/**
 * Rebuild the query string minus `city`, which has been promoted into the path
 * and would otherwise appear twice.
 */
export function forwardedQuery(searchParams: LpSearchParams): string {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'city' || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) out.append(key, v);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : '';
}
