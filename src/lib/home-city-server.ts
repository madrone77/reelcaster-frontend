/**
 * The city an angler's dashboard is about, decided on the server.
 *
 * Three tiers, strongest first:
 *
 *   1. **stated** — `preferences.homeCitySlug`, the answer they gave the
 *      home-city modal or the account card. Pinning a home spot now writes
 *      this too (see `saveHomeSpot`), so a pin and a stated city are the same
 *      fact for every account created from here on.
 *   2. **spot** — the city under the pinned home spot, for the accounts that
 *      pinned one before the city setting existed. No backfill; this tier is
 *      the backfill.
 *   3. **ip** — the nearest covered city to the Vercel edge fix on THIS
 *      request. Nothing is stored and nothing was asked. It exists so that
 *      somebody who closed the modal without choosing still gets a report
 *      about real water instead of an empty card with a link on it.
 *
 * The IP tier is deliberately the only guess available here. The arrival URL
 * is the stronger signal and the modal uses it, but it lives in localStorage,
 * so the only way a server route could see it is if the client sent it, and a
 * client that can name a city can read every city's report by naming them one
 * at a time. Edge headers cannot be forged by the page, so this stays honest.
 *
 * The same reason is why no route here takes a city slug from the caller.
 *
 * SERVER-ONLY.
 */

import type { NextRequest } from "next/server";
import {
  fetchHierarchyLight,
  resolveCityBySlug,
  resolveHomeCity,
} from "@/lib/bluecaster";
import { coveredCityPoints } from "@/lib/nearby-spots";
import { nearestOpeningCity, readVisitorPoint } from "@/app/explore/lib/opening-city";

/** Where the answer came from, so a surface can say whether it was chosen. */
export type HomeCitySource = "stated" | "spot" | "ip";

export interface EffectiveHomeCity {
  slug: string;
  name: string;
  source: HomeCitySource;
}

/** The two preference keys this reads, as they sit in auth metadata. */
export interface HomeCityPrefs {
  homeSpotSlug?: string;
  homeCitySlug?: string;
}

/**
 * Pull the two keys out of an auth user's metadata.
 *
 * Takes `unknown` because that is what a free-form jsonb blob is, and an empty
 * string is how both settings are cleared, so neither is treated as an answer.
 */
export function readHomeCityPrefs(userMetadata: unknown): HomeCityPrefs {
  if (!userMetadata || typeof userMetadata !== "object") return {};
  const prefs = (userMetadata as { preferences?: unknown }).preferences;
  if (!prefs || typeof prefs !== "object") return {};
  const { homeSpotSlug, homeCitySlug } = prefs as HomeCityPrefs;
  return {
    homeSpotSlug: typeof homeSpotSlug === "string" && homeSpotSlug.trim() ? homeSpotSlug.trim() : undefined,
    homeCitySlug: typeof homeCitySlug === "string" && homeCitySlug.trim() ? homeCitySlug.trim() : undefined,
  };
}

/**
 * The visitor's position for the fallback tier.
 *
 * Outside production a `?geo_lat=&geo_lng=` pair on the request stands in for
 * the edge headers, the same override the Explore opening frame honours, so
 * this tier can be exercised in `next dev` where no geo header exists.
 */
export function requestPoint(request: NextRequest) {
  return readVisitorPoint(request.headers, {
    lat: request.nextUrl.searchParams.get("geo_lat"),
    lng: request.nextUrl.searchParams.get("geo_lng"),
  });
}

/**
 * Resolve the three tiers. Null only when there is no stated city, no pin, and
 * no position at all, which is a crawler or a data-centre IP.
 *
 * A stated slug that no longer resolves to a published city falls THROUGH to
 * the tiers below rather than ending the search. A city that went unpublished
 * should degrade to the next best answer, not to a blank dashboard.
 */
export async function resolveEffectiveHomeCity(
  request: NextRequest,
  prefs: HomeCityPrefs,
): Promise<EffectiveHomeCity | null> {
  if (prefs.homeCitySlug) {
    const stated = await resolveCityBySlug(prefs.homeCitySlug);
    if (stated) return { ...stated, source: "stated" };
  }

  const fromSpot = await resolveHomeCity(prefs.homeSpotSlug ?? null);
  if (fromSpot) return { ...fromSpot, source: "spot" };

  const point = requestPoint(request);
  if (!point) return null;

  const hierarchy = await fetchHierarchyLight();
  const slug = nearestOpeningCity(hierarchy, point);
  if (!slug) return null;

  const city = coveredCityPoints(hierarchy).find((c) => c.slug === slug);
  return city ? { slug: city.slug, name: city.name, source: "ip" } : null;
}
