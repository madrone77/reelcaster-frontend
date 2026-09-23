import type { Metadata } from "next";
import StillCapture from "./still-capture";

/**
 * `/dev/reel-still?lat=&lng=&zoom=&w=&h=` is the capture surface for the hero
 * reel's baked map (src/lib/map/reel-still.ts).
 *
 * scripts/capture-reel-stills.mjs opens this at a w x h viewport, waits for
 * `window.__stillReady`, and screenshots the top-left w x h. The map is
 * the marketing map's own style with no pins; the page draws the pins over the
 * picture from live scores.
 *
 * Unlike /dev/where-what-when this one answers in production. The job runs
 * against the live site so the still is drawn from the tiles and style that
 * are actually deployed. It renders nothing but a map from its query string.
 */

export const metadata: Metadata = { robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const num = (v: string | string[] | undefined) =>
  typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;

export default async function DevReelStill({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const lat = num(sp.lat);
  const lng = num(sp.lng);
  const zoom = num(sp.zoom);
  const w = num(sp.w);
  const h = num(sp.h);
  if (lat === null || lng === null || zoom === null || w === null || h === null) {
    return <p>lat, lng, zoom, w and h are required.</p>;
  }
  return (
    <StillCapture
      lat={lat}
      lng={lng}
      zoom={zoom}
      w={Math.min(Math.max(w, 50), 2000)}
      h={Math.min(Math.max(h, 50), 2000)}
    />
  );
}
