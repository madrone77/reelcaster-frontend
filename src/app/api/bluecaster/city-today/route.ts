import { NextRequest, NextResponse } from "next/server";
import { fetchCityToday, fetchHierarchy } from "@/lib/bluecaster";
import { isProViewer, isSignedIn } from "@/lib/public-entitlement";
import { visibleForecastDays } from "@/lib/forecast-horizon";
import { COVERED_PROVINCES } from "@/lib/regions";
import { getFishingProvince } from "@/app/fishing/lib/fishing-data";

/**
 * Same-origin proxy → BlueCaster GET /api/v1/cities/[slug]/today.
 *
 * The page server-renders this band at the anon horizon, which is what gets
 * prerendered and indexed. This route exists to upgrade the FORWARD half for a
 * reader who has paid for more of it.
 *
 * The horizon is resolved here, from `resolveEntitlement`, and never taken
 * from the client. It is the same rule `stripSpotsOutlook` applies to the day
 * strip, applied to the summary of that strip: "best day ahead is Thursday" is
 * day 9 information even when the day 9 cell is drawn locked, so a band that
 * summarised the whole fortnight would hand over the thing the strip is
 * withholding.
 *
 * Entitlement rather than the client's `useSubscription`: that hook skips the
 * grace window, so an account in grace would read as free.
 */

async function isPublishedCity(slug: string): Promise<boolean> {
  try {
    const hierarchy = await fetchHierarchy();
    return COVERED_PROVINCES.some((code) =>
      (getFishingProvince(hierarchy, code)?.cities ?? []).some(
        (c) => c.slug === slug,
      ),
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("city");
  if (!slug || !/^[a-z0-9-]{2,64}$/.test(slug)) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  if (!(await isPublishedCity(slug))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [signedIn, isPro] = await Promise.all([
    isSignedIn(request),
    isProViewer(request),
  ]);

  const days = visibleForecastDays(signedIn, isPro);

  const today = await fetchCityToday(slug, days);
  if (!today) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }

  return NextResponse.json(today, {
    // Varies by reader tier, so never shared-cached.
    headers: { "Cache-Control": "private, no-store" },
  });
}
