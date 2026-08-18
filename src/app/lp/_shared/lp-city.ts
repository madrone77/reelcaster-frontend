import { fetchHierarchyLight } from "@/lib/bluecaster";

/**
 * Resolve an `/lp/<variant>/[city]` slug to a real city.
 *
 * The route shape comes from ../lp-entry.ts, which only checks that `?city=`
 * is slug-*shaped* before promoting it into the path. Shape is not existence,
 * so the page still has to decide what an unknown slug means — otherwise
 * /lp/2/not-a-place would answer 200 and print a title-cased guess back at the
 * visitor as if it were a place we cover.
 *
 * This uses the LIGHT hierarchy (`?spots=0`). The full tree inlines every
 * published spot in the database, which is a payload that grows with the
 * database rather than with what the page shows — and all this page needs is a
 * name and a sanity check. One cheap call also keeps the route ISR-cacheable,
 * which is the entire reason lp-entry redirects here instead of rendering.
 */
export interface LpCity {
  name: string;
  slug: string;
}

/**
 * Returns the city, or null when the slug is unknown, still building/staging,
 * or has no published spots.
 *
 * Lifecycle and spot count are both checked because either one alone lets
 * through a city we cannot actually sell: a published city with zero spots has
 * nothing to score, and a building city is not meant to be advertised yet.
 * Callers should notFound() on null rather than fall back to the pilot city —
 * a silent swap would spend Nanaimo's ad budget on a Victoria page and make
 * the campaign look like it worked.
 */
export async function resolveLpCity(slug: string): Promise<LpCity | null> {
  const tree = await fetchHierarchyLight();
  if (!tree) return null;

  for (const country of tree.countries) {
    for (const province of country.states_provinces) {
      for (const region of province.regions) {
        for (const city of region.cities) {
          if (city.slug !== slug) continue;
          if (city.lifecycle !== "published") return null;
          if (city.spot_count < 1) return null;
          return { name: city.name, slug: city.slug };
        }
      }
    }
  }
  return null;
}
