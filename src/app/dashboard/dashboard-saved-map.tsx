"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { ChevronRight } from "lucide-react";
import type { RailSpot } from "@/app/explore/lib/explore-data";

// SSR-off: MapLibre touches `window` on mount.
//
// Named so the same import can be kicked off by hand on mount (see below).
// Without that, the ~270 KB MapLibre chunk doesn't even start downloading until
// the auth round trip and the saved-spots fetch have both returned and this
// component renders its map branch — three serial stages deep. The dynamic()
// wrapper and the manual call share webpack's module promise, so the second
// caller reuses the in-flight request rather than starting a new one.
const loadExploreMap = () => import("@/app/explore/components/explore-map");
const ExploreMap = dynamic(loadExploreMap, { ssr: false });

/** Last view the map settled on, so a returning angler opens over their own
 *  water instead of flying there after everything has loaded. */
const VIEW_KEY = "rc-dash-map-view";

interface SavedView {
  lng: number;
  lat: number;
  zoom: number;
}

function readSavedView(): SavedView | null {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SavedView>;
    if (
      typeof v?.lng === "number" &&
      typeof v?.lat === "number" &&
      typeof v?.zoom === "number" &&
      Number.isFinite(v.lng) &&
      Number.isFinite(v.lat) &&
      Number.isFinite(v.zoom)
    ) {
      return { lng: v.lng, lat: v.lat, zoom: v.zoom };
    }
  } catch {
    // Blocked storage (iOS "Block All Cookies") throws on read — fall back.
  }
  return null;
}

function boundsOf(
  spots: RailSpot[],
): [[number, number], [number, number]] | null {
  if (spots.length === 0) return null;
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const sp of spots) {
    w = Math.min(w, sp.lng);
    e = Math.max(e, sp.lng);
    s = Math.min(s, sp.lat);
    n = Math.max(n, sp.lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}

// Sensible default view (Salish Sea) before spots load / when none plot.
const DEFAULT_CENTER = { lat: 49.3, lng: -123.6 };

/**
 * Dashboard summary map — the angler's saved spots only. No species overlay, no
 * basemap toggle, no unsaved-spot pins; fits to the saved set. A summary, not an
 * instrument — the full instrument is one tap away via "View full map".
 */
export default function DashboardSavedMap({
  spots,
  loading = false,
}: {
  spots: RailSpot[];
  /** Saved set still resolving. Distinguishes "no spots yet" from "no spots". */
  loading?: boolean;
}) {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const hasFitted = useRef(false);

  // Read once, synchronously with the first render — it decides the opening
  // camera, so it cannot wait for an effect.
  const [savedView] = useState<SavedView | null>(() =>
    typeof window === "undefined" ? null : readSavedView(),
  );

  // Start the map chunk immediately, in parallel with the dashboard's own data
  // fetches, whichever branch renders below.
  useEffect(() => {
    void loadExploreMap();
  }, []);

  // Only spots with real coordinates can plot (unscored fallbacks have 0,0).
  const plottable = useMemo(
    () =>
      spots.filter(
        (s) =>
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lng) &&
          (s.lat !== 0 || s.lng !== 0),
      ),
    [spots],
  );

  // A saved view is proof this angler had plottable spots last visit, so the
  // map can mount and start fetching tiles while their spots are still in
  // flight. Without one, wait — a first-timer with nothing saved should not pay
  // for a map they are about to be told they have no spots for.
  const showMap = plottable.length > 0 || (loading && savedView !== null);

  // Fit to the saved set as soon as it arrives. Deliberately NOT gated on the
  // map's 'load' event: that waits on the style and the first tile batch, which
  // meant staring at the default view for the whole load and then flying —
  // paying for two rounds of tiles. fitBounds is camera-only and safe before
  // load. The first fit is instant (nothing to animate away from); later ones
  // ease, so adding a spot reads as a move.
  const boundsKey = plottable
    .map((s) => `${s.lng.toFixed(4)},${s.lat.toFixed(4)}`)
    .sort()
    .join("|");

  const fitToSaved = () => {
    const map = mapRef.current;
    const bounds = boundsOf(plottable);
    if (!map || !bounds) return;
    // Claim the flag BEFORE moving: an instant fitBounds emits moveend
    // synchronously, which re-enters this through onViewportChange below.
    const first = !hasFitted.current;
    hasFitted.current = true;
    map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: first ? 0 : 600 });
  };

  useEffect(() => {
    fitToSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  // Fires on the map's own load, every moveend, and resize. Doubles as the
  // catch-up fit for the case where the spots landed before the map chunk did,
  // so the effect above found no map instance to aim.
  const handleViewport = () => {
    if (!hasFitted.current) fitToSaved();
    const map = mapRef.current;
    if (!map) return;
    try {
      const c = map.getCenter();
      localStorage.setItem(
        VIEW_KEY,
        JSON.stringify({ lng: c.lng, lat: c.lat, zoom: map.getZoom() }),
      );
    } catch {
      // Blocked storage — the map still works, it just won't reopen here.
    }
  };

  return (
    <section className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
      {showMap ? (
        <div className="dash-map relative h-72 w-full">
          {/* Zoom + attribution controls: 20px in from the right edge. */}
          <style>{`
            .dash-map .maplibregl-ctrl-bottom-right { right: 20px !important; }
            .dash-map .maplibregl-ctrl-bottom-right .maplibregl-ctrl { margin-right: 0 !important; }
          `}</style>
          <ExploreMap
            mapRef={mapRef}
            spots={plottable}
            selectedSlug={null}
            onSelect={(slug) => router.push(`/explore/spot/${slug}`)}
            onSelectStation={() => {}}
            initialCenter={
              savedView ? { lat: savedView.lat, lng: savedView.lng } : DEFAULT_CENTER
            }
            initialZoom={savedView ? savedView.zoom : 6}
            relief={false}
            labels
            currents={false}
            showBrand={false}
            summary
            onViewportChange={handleViewport}
          />
          {/* The one map CTA, sitting on the map itself. */}
          <Link
            href="/explore"
            className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded bg-rc-panel/95 px-2.5 py-1.5 font-rc-mono text-[11px] font-bold text-rc-brand shadow-rc-panel backdrop-blur-sm hover:bg-rc-panel"
          >
            View full map <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : loading ? (
        <div className="h-72 w-full animate-pulse bg-rc-rule/30" />
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-rc-ink-soft">
            Save spots to see them on your map.
          </p>
          <Link
            href="/explore"
            className="mt-3 inline-flex items-center gap-1 font-rc-mono text-[11px] font-bold text-rc-brand hover:underline"
          >
            Explore spots <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
