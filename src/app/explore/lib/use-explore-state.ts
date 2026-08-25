"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * URL state for the Explore canvas — deep-linkable and back-button friendly.
 *   ?loc=<citySlug>   selected location (rail scope)
 *   ?spot=<slug>      selected spot → rail shows the drawer
 *   ?day=<YYYY-MM-DD> selected forecast day (Phase 2)
 *   ?stn=<src>:<sid>  selected tide station / weather buoy → station panel
 *                     (src = chs | noaa for tide stations, ndbc for buoys)
 *
 * ── Why selection does not use the router ────────────────────────────────
 *
 * `router.replace` on this route is a full server round trip, and `page.tsx`
 * re-derives the opening viewport on every one of them. For `?spot` that is
 * actively harmful, because the server render is ANONYMOUS: it asks BlueCaster
 * to turn the slug into coordinates, and a private custom spot is invisible to
 * an anonymous caller by design. The slug resolves to nothing, the page falls
 * through to its default-city path exactly as its own comment says it will,
 * and the map re-frames on Victoria.
 *
 * Reported from Vancouver: selecting your own custom spot selected it and then
 * threw the viewport across the strait. Confirmed against production, where
 * `map/spot-coords` answers `{"spots":[]}` for a private custom slug and
 * answers normally for a published one.
 *
 * So the selection keys (`spot`, `stn`, `day`) are written with
 * `history.replaceState`: the URL stays correct and shareable, deep links and
 * the back button still work, and nothing re-renders on the server. `?loc` is
 * left on the router, because changing city is a genuine navigation and the
 * server render is what fetches that city.
 *
 * The catch this has to handle: `useSearchParams()` does NOT observe
 * `history.replaceState`, so a locally-written key would read back stale. The
 * hook keeps its own overrides and drops them whenever the router really does
 * navigate, which is the only time the URL becomes the better source again.
 */
const ROUTER_KEYS = new Set(["loc"]);

export function useExploreState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  // Keys written locally since the last real navigation. A key present here
  // beats the URL; a key absent falls through to it.
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});

  // A router navigation (back/forward, a ?loc change, a link) makes the URL
  // authoritative again. replaceState does not change `search`, so this does
  // not fire on our own writes.
  useEffect(() => {
    setOverrides({});
  }, [search]);

  const read = useCallback(
    (key: string) =>
      key in overrides ? overrides[key] : searchParams.get(key),
    [overrides, searchParams],
  );

  const setQuery = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(search);
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      // Anything already written locally has to be re-applied, or a later
      // write would resurrect the URL's older value for that key.
      for (const [k, v] of Object.entries(overrides)) {
        if (k in next) continue;
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }

      const qs = params.toString();
      const href = qs ? `/explore?${qs}` : "/explore";

      if (Object.keys(next).some((k) => ROUTER_KEYS.has(k))) {
        setOverrides({});
        router.replace(href, { scroll: false });
        return;
      }

      setOverrides((prev) => ({ ...prev, ...next }));
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", href);
      }
    },
    [router, search, overrides],
  );

  return useMemo(
    () => ({
      citySlug: read("loc"),
      spotSlug: read("spot"),
      day: read("day"),
      stn: read("stn"),
      setQuery,
    }),
    [read, setQuery],
  );
}
