"use client";

import Link from "next/link";
import { ChevronRight, Home, Star } from "lucide-react";
import { TIER_PILL, tierFor } from "@/app/explore/lib/explore-data";
import type { MapSpotsPayload } from "@/lib/bluecaster";

/** How many spots to list per city before deferring to Explore. */
const PER_CITY = 3;

/**
 * "sooke-bc" → "Sooke". The map payload carries `city_slug` but no city name,
 * and the only endpoint that resolves names is a second round trip for a label.
 * Every city slug in the covered extent is `<name>-<province>` (checked against
 * all nine: bellingham-wa … victoria-bc), so the province code comes off the
 * end and the rest title-cases. A slug that ever breaks that shape degrades to
 * a readable title-cased string rather than to nothing.
 */
function cityName(slug: string): string {
  return slug
    .replace(/-(bc|wa|or|ca|ak)$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type AroundYouSpot = {
  slug: string;
  name: string;
  score: number;
  species: string | null;
  isHome: boolean;
  isSaved: boolean;
};

export type AroundYouCity = {
  slug: string;
  name: string;
  total: number;
  spots: AroundYouSpot[];
};

/**
 * Rank the cities the angler already fishes, from the map payload the
 * dashboard has fetched anyway.
 *
 * A city qualifies by having one of their spots in it — home, saved, or
 * custom — rather than only the home spot's city. Anglers here fish across a
 * boundary: on the account this was built against, the pinned home spot is in
 * Sooke while two of four saved spots are in Victoria, and Victoria was
 * scoring higher. A strict home-city block would have hidden the better water.
 */
export function aroundYouFrom(
  payload: MapSpotsPayload | null,
  ownSlugs: string[],
  homeSlug: string | null,
): AroundYouCity[] | null {
  if (!payload) return null;
  const own = new Set(ownSlugs);

  // The cities those spots sit in. A custom spot the payload doesn't carry
  // simply contributes no city, which is correct — we know of no water there.
  const citySlugs = new Set<string>();
  for (const e of payload.spots) {
    if (own.has(e.slug) && e.city_slug) citySlugs.add(e.city_slug);
  }
  if (citySlugs.size === 0) return [];

  const species = payload.species ?? {};
  const cities: AroundYouCity[] = [];

  for (const city of citySlugs) {
    const scored: AroundYouSpot[] = [];
    for (const e of payload.spots) {
      if (e.city_slug !== city) continue;
      let best = 0;
      let bestId: string | null = null;
      for (const [id, strip] of Object.entries(e.scores ?? {})) {
        const peak = (strip as { peak?: number })?.peak;
        if (typeof peak === "number" && peak > best) {
          best = peak;
          bestId = id;
        }
      }
      // An unscored spot is not a recommendation — leave it to Explore.
      if (best <= 0) continue;
      scored.push({
        slug: e.slug,
        name: e.name,
        score: Math.round(best * 100),
        species: (bestId && species[bestId]?.name) || null,
        isHome: e.slug === homeSlug,
        isSaved: own.has(e.slug),
      });
    }
    if (scored.length === 0) continue;
    scored.sort((a, b) => b.score - a.score);
    cities.push({
      slug: city,
      name: cityName(city),
      total: scored.length,
      spots: scored.slice(0, PER_CITY),
    });
  }

  // Best city first, measured by its best spot — the city fishing hardest
  // today leads, which is not always the one the home spot sits in.
  cities.sort((a, b) => (b.spots[0]?.score ?? 0) - (a.spots[0]?.score ?? 0));
  return cities;
}

function SpotRow({ spot }: { spot: AroundYouSpot }) {
  const tier = tierFor(spot.score);
  return (
    <Link
      href={`/explore/spot/${spot.slug}`}
      className="flex items-center gap-3 border-t border-rc-rule px-4 py-2.5 transition-colors first:border-t-0 hover:bg-rc-surface"
    >
      <span
        className={`shrink-0 rounded px-2 py-0.5 font-rc-mono text-[12px] font-bold tabular-nums ${TIER_PILL[tier]}`}
      >
        {spot.score}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium text-rc-ink">
            {spot.name}
          </span>
          {/* Says why a spot the angler already has is in a discovery list,
              so it doesn't read as the dashboard forgetting they own it. */}
          {spot.isHome ? (
            <Home className="h-3 w-3 shrink-0 text-rc-brand" />
          ) : spot.isSaved ? (
            <Star className="h-3 w-3 shrink-0 fill-rc-brand text-rc-brand" />
          ) : null}
        </span>
        {spot.species && (
          <span className="block truncate font-rc-mono text-[11px] text-rc-ink-mute">
            {spot.species}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-rc-ink-mute" />
    </Link>
  );
}

/**
 * The best water in the cities the angler already fishes — including spots
 * they have not saved, which is the whole point. Everything above this on the
 * dashboard can only show them what they already told us about; on the account
 * this was built against, 14 of Sooke's 17 scored spots appeared nowhere else
 * on the page, two of them out-scoring the pinned home spot.
 *
 * Derived entirely from the map payload the dashboard already fetches for its
 * scores, so this costs no request.
 */
export default function AroundYou({ cities }: { cities: AroundYouCity[] | null }) {
  if (cities === null) {
    return (
      <div className="h-40 animate-pulse rounded-xl border border-rc-rule bg-rc-surface" />
    );
  }
  if (cities.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-lg font-bold text-rc-ink">Around you</h2>
        <span className="font-rc-mono text-[11px] text-rc-ink-mute">
          today&apos;s best water where you fish
        </span>
      </div>

      <div className="space-y-4">
        {cities.map((city) => (
          <div
            key={city.slug}
            className="overflow-hidden rounded-xl border border-rc-rule bg-rc-panel"
          >
            <div className="flex items-center justify-between gap-2 px-4 pb-2.5 pt-3">
              <span className="font-rc-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rc-brand">
                {city.name}
              </span>
              <span className="font-rc-mono text-[10px] text-rc-ink-mute">
                {city.total} scored
              </span>
            </div>
            <div className="border-t border-rc-rule">
              {city.spots.map((s) => (
                <SpotRow key={s.slug} spot={s} />
              ))}
            </div>
            {city.total > city.spots.length && (
              <Link
                href={`/explore?loc=${city.slug}`}
                className="flex items-center justify-between border-t border-rc-rule px-4 py-2.5 text-[14px] font-semibold text-rc-brand transition-colors hover:bg-rc-surface"
              >
                Click here to see all {city.total} spots in {city.name}
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
