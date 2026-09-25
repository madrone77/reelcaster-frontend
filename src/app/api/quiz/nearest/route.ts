import { NextRequest, NextResponse } from "next/server";
import { fetchHierarchyLight } from "@/lib/bluecaster";
import { coveredCityPoints } from "@/lib/nearby-spots";
import { readEdgeGeo } from "@/lib/edge-geo";
import { requestPoint } from "@/lib/home-city-server";
import { nearestOpeningCity } from "@/app/explore/lib/opening-city";
import { loadQuizData } from "@/app/lp/q/_quiz/quiz-data";

/**
 * GET /api/quiz/nearest -- redirect to the quiz for the visitor's city.
 *
 * Where `/lp/q/<not a city>` lands (see src/app/lp/q/_quiz/nearest-hop.tsx).
 * The IP fix snaps to a city with the same rule Explore opens on, so a BC
 * reader gets Vancouver's quiz and never Seattle's. A Canadian IP never lands
 * on an American city, even from Toronto, where the far-arrival hubs would say
 * Seattle. With no fix at all (a data-centre IP, `next dev`), the country
 * header decides: Canada gets Vancouver, everyone else Seattle.
 *
 * The pick has to have quiz data, or the city page would hop straight back
 * here. A city without it falls to its country's default, and when neither
 * has any the reader goes to Explore rather than round a loop.
 *
 * Under /api so the hop is not counted as a second landing-page view.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CA_DEFAULT = "vancouver-bc";
const US_DEFAULT = "seattle-wa";

export async function GET(request: NextRequest) {
  const country = readEdgeGeo(request.headers).country?.toUpperCase();
  const hierarchy = await fetchHierarchyLight();
  const countryOf = new Map(coveredCityPoints(hierarchy).map((c) => [c.slug, c.country]));
  let nearest = nearestOpeningCity(hierarchy, requestPoint(request));
  if (country === "CA" && nearest && countryOf.get(nearest) !== "CA") nearest = null;
  const canadian = nearest ? countryOf.get(nearest) === "CA" : country === "CA";
  const fallback = canadian ? CA_DEFAULT : US_DEFAULT;

  let city: string | null = null;
  for (const slug of [nearest, fallback]) {
    if (slug && (await loadQuizData(slug))) {
      city = slug;
      break;
    }
  }

  const query = new URLSearchParams(request.nextUrl.searchParams);
  query.delete("geo_lat");
  query.delete("geo_lng");
  const qs = query.toString();
  const path = city ? `/lp/q/${city}` : "/explore";
  const res = NextResponse.redirect(new URL(`${path}${qs ? `?${qs}` : ""}`, request.url), 307);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
