"use client";

import { useEffect, useState } from "react";
import { fetchMapSpotsForIds } from "@/lib/bluecaster-client";
import type { MapCondStrip } from "@/lib/bluecaster";
import type { RailSpot } from "./explore-data";

/** Full strips already read, by "spotId|date". One read per spot per day per visit. */
const cache = new Map<string, MapCondStrip | null>();

/**
 * The spot's whole 24-hour conditions strip, for the drawer's hour scrubber.
 *
 * The map loads the slim body, whose strip holds only the hours a pin or card
 * reads. The drawer scrubs every hour, so on open it reads this one spot by id
 * in the full shape (a few KB). Until that lands, and for a spot that already
 * carries its full strip, the spot's own strip is returned.
 */
export function useFullCondStrip(spot: RailSpot, date: string): MapCondStrip | null {
  const key = `${spot.id}|${date}`;
  const [loaded, setLoaded] = useState<{ key: string; strip: MapCondStrip | null } | null>(
    () => (cache.has(key) ? { key, strip: cache.get(key) ?? null } : null),
  );

  useEffect(() => {
    if (!spot.condStripPartial || !spot.id || !date) return;
    if (cache.has(key)) {
      setLoaded({ key, strip: cache.get(key) ?? null });
      return;
    }
    let cancelled = false;
    fetchMapSpotsForIds([spot.id], date)
      .then((p) => {
        const strip = p?.spots.find((s) => s.id === spot.id)?.conditions ?? null;
        // A miss is not cached, so the next open tries again.
        if (strip) cache.set(key, strip);
        if (!cancelled) setLoaded({ key, strip });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, spot.id, spot.condStripPartial, date]);

  if (spot.condStripPartial && loaded?.key === key && loaded.strip) return loaded.strip;
  return spot.condStrip;
}
