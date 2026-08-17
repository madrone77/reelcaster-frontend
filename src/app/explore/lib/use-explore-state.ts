"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * URL state for the Explore canvas — deep-linkable and back-button friendly.
 *   ?loc=<citySlug>   selected location (rail scope)
 *   ?spot=<slug>      selected spot → rail shows the drawer
 *   ?day=<YYYY-MM-DD> selected forecast day (Phase 2)
 *   ?stn=<src>:<sid>  selected tide station / weather buoy → station panel
 *                     (src = chs | noaa for tide stations, ndbc for buoys)
 */
export function useExploreState() {
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
      const url = qs ? `/explore?${qs}` : "/explore";

      // Native replaceState, NOT router.replace. The whole selection is client
      // state that happens to be spelled in the URL, and going through the
      // router made every pick of a spot, day, station or city wait on the
      // server.
      //
      // `/explore` reads `?loc` and `?spot` during render, so it is a dynamic
      // route (`ƒ`). A router navigation to a new query string cannot be
      // answered from the client, so it fetches a fresh RSC payload, which
      // re-runs fetchSpotCoords + fetchMapSpots + fetchMapForecast14d. Measured
      // against prod: 270ms to 1.33s per pick, 68 to 86 KB a time. React holds
      // the old UI for the whole pending transition, and `spotSlug` below only
      // moves when it commits, so the drawer kept showing the PREVIOUS spot
      // while `handleSelectSpot`'s imperative flyTo (which needs no server) had
      // already moved the camera to the new one. Clicking Constance Bank and
      // then another spot left Constance Bank in the rail over the wrong water,
      // for as long as the round trip took. Cache warmth decides how long that
      // is, which is what made it feel intermittent.
      //
      // Next patches history.pushState/replaceState to dispatch ACTION_RESTORE
      // (see next/dist/client/components/app-router.js), so `useSearchParams`
      // picks this up on the client with no fetch, and `replaceState` keeps the
      // no-new-history-entry semantics `router.replace` had. The server reads
      // in page.tsx still run for real document requests, which is the arrival
      // path they were added for. Nothing here needs them, because the client
      // already loads spots by viewport.
      window.history.replaceState(null, "", url);
    },
    [searchParams],
  );

  return { citySlug, spotSlug, day, stn, setQuery };
}
