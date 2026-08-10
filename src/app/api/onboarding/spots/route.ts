/**
 * GET /api/onboarding/spots
 *
 * A flat, minimal roster of published spots for the onboarding home-spot
 * picker: slug, name, city, province, coordinates. Nothing else.
 *
 * Why not `/api/search`: that route proxies BlueCaster's `/api/v1/search`,
 * which does not exist on BlueCaster — every query comes back with zero
 * results (the global search header has the same problem). Rather than block
 * onboarding on fixing search, this reads the hierarchy BlueCaster does serve
 * and filters client-side. The whole covered set is a few hundred spots, so one
 * cached fetch beats a round-trip per keystroke, and the picker stays
 * responsive while the angler types.
 *
 * Published spots only — an unpublished spot has no scores to pin a dashboard
 * hero or an alert to.
 */

import { NextResponse } from 'next/server';
import { fetchHierarchy } from '@/lib/bluecaster';
import { COVERED_PROVINCES } from '@/lib/regions';

export const runtime = 'nodejs';
// Matches fetchHierarchy's own hour-long revalidate — the spot roster changes
// when a city publishes, not by the minute.
export const revalidate = 3600;

export interface OnboardingSpot {
  slug: string;
  name: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
}

export async function GET() {
  const hierarchy = await fetchHierarchy();
  if (!hierarchy) {
    return NextResponse.json({ spots: [] as OnboardingSpot[] });
  }

  const spots: OnboardingSpot[] = [];
  for (const country of hierarchy.countries ?? []) {
    for (const province of country.states_provinces ?? []) {
      const code = province.code?.toUpperCase() ?? '';
      if (!(COVERED_PROVINCES as readonly string[]).includes(code)) continue;
      for (const region of province.regions ?? []) {
        for (const city of region.cities ?? []) {
          // A spot in a city that hasn't published yet isn't reachable on the
          // site, so it has no business being offered as a home spot.
          if (city.lifecycle !== 'published') continue;
          for (const spot of city.spots ?? []) {
            if (!spot.is_published || !spot.slug) continue;
            spots.push({
              slug: spot.slug,
              name: spot.name,
              city: city.name,
              province: code,
              lat: spot.lat,
              lng: spot.lng,
            });
          }
        }
      }
    }
  }

  spots.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(
    { spots },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  );
}
