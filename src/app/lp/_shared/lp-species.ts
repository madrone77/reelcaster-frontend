/**
 * Species targeting for the landing pages that take a species from the ad
 * link. Only /lp/4 uses it today.
 *
 * It lives in its own module rather than inside lp-spot.ts because the
 * matching rules are the interesting part. An ad link is written by a person
 * in a hurry, months before the click lands, and being strict about what they
 * typed costs a generic page served to traffic we paid extra to target.
 */

import type { MapSpotsPayload } from "@/lib/bluecaster";

export interface LpSpecies {
  /** Species uuid. Keys both the score strips and the catch counts. */
  id: string;
  /** Canonical slug, e.g. "chinook-salmon". */
  slug: string;
  /** What the page is allowed to print, e.g. "Chinook Salmon", "Halibut". */
  label: string;
}

/**
 * Display form of a stored species name.
 *
 * "Pacific" is a qualifier in the data and not a word anyone says at the ramp,
 * so it comes off here and here only. Everything upstream matches on the
 * stored name, so rewriting it any earlier would quietly break those matches.
 * "(Aggregate)" is a roster rollup label and reads as a database artifact in a
 * headline.
 */
export function lpSpeciesLabel(name: string): string {
  return name
    .replace(/^pacific\s+/i, "")
    .replace(/\s*\(aggregate\)\s*$/i, "")
    .trim();
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Resolve `?species=` against the species actually scored in this city.
 *
 * Order: exact slug, then a unique prefix of one, then a unique match on the
 * name. The prefix rule is there because "chinook" is how a person writes what
 * the database calls "chinook-salmon", and a link that reads well is a link
 * that gets pasted correctly.
 *
 * Anything ambiguous resolves to nothing rather than guessing. "salmon" is
 * five species here, and silently picking one of them puts the wrong fish in
 * the headline of a page someone paid for.
 *
 * Resolving against the payload rather than a static species list also gives
 * the behaviour the page wants for free: a species that exists in the database
 * but has no scored spot in this city never resolves, so the page can only
 * ever name water it can actually score.
 */
export function resolveLpSpecies(
  payload: MapSpotsPayload,
  raw: string | string[] | undefined,
): LpSpecies | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const want = (first ?? "").trim().toLowerCase();
  if (!want) return null;

  const entries = Object.values(payload.species ?? {});
  const only = (matches: typeof entries): LpSpecies | null =>
    matches.length === 1
      ? {
          id: matches[0].id,
          slug: matches[0].slug,
          label: lpSpeciesLabel(matches[0].name),
        }
      : null;

  const exact = only(entries.filter((s) => s.slug === want));
  if (exact) return exact;

  const wanted = normalize(want);
  if (!wanted) return null;

  const byPrefix = only(entries.filter((s) => normalize(s.slug).startsWith(wanted)));
  if (byPrefix) return byPrefix;

  return only(entries.filter((s) => normalize(s.name) === wanted));
}
