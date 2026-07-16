"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * URL state for the Explore canvas — deep-linkable and back-button friendly.
 *   ?loc=<citySlug>   selected location (rail scope)
 *   ?spot=<slug>      selected spot → rail shows the drawer
 *   ?day=<YYYY-MM-DD> selected forecast day (Phase 2)
 *   ?stn=<src>:<sid>  selected tide station / weather buoy → station panel
 *                     (src = chs | noaa for tide stations, ndbc for buoys)
 */
export function useExploreState() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const citySlug = searchParams.get("loc");
  const spotSlug = searchParams.get("spot");
  const day = searchParams.get("day");
  const stn = searchParams.get("stn");

  const setQuery = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.replace(qs ? `/explore?${qs}` : "/explore", { scroll: false });
    },
    [router, searchParams],
  );

  return { citySlug, spotSlug, day, stn, setQuery };
}
