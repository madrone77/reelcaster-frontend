/**
 * Every hero-reel still the ad frames can ask for, for the capture job
 * (scripts/capture-reel-stills.mjs). One sheet per published city, one window
 * per published spot, framed by the same functions the pages call, so a
 * frame here and a frame on a page cannot disagree.
 */

import { NextResponse } from 'next/server';
import { fetchHierarchy } from '@/lib/bluecaster';
import { COVERED_PROVINCES } from '@/lib/regions';
import { getFishingProvinceByCode } from '@/app/fishing/lib/fishing-data';
import { cityStillFrame, spotStillFrame, STILL_DPR, type StillFrame } from '@/lib/map/reel-still';

export const revalidate = 3600;

export async function GET() {
  const hierarchy = await fetchHierarchy();
  const frames: StillFrame[] = [];
  const seen = new Set<string>();
  for (const code of COVERED_PROVINCES) {
    for (const city of getFishingProvinceByCode(hierarchy, code)?.cities ?? []) {
      frames.push(cityStillFrame(city.slug, city.spots, { lat: city.lat, lng: city.lng }));
      for (const spot of city.spots) {
        if (seen.has(spot.slug)) continue;
        seen.add(spot.slug);
        frames.push(spotStillFrame(spot.slug, spot.lat, spot.lng));
      }
    }
  }
  return NextResponse.json({ dpr: STILL_DPR, count: frames.length, frames });
}
