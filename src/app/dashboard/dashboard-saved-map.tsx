"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { ChevronRight } from "lucide-react";
import type { RailSpot } from "@/app/explore/lib/explore-data";

// SSR-off: MapLibre touches `window` on mount.
//
// Named so the same import can be kicked off by hand — see `useNearViewport`.
const loadExploreMap = () => import("@/app/explore/components/explore-map");
const ExploreMap = dynamic(loadExploreMap, { ssr: false });

/**
 * Whether `ref` is at or near the viewport.
 *
 * The map is ~396 KB gzipped — MapLibre, pmtiles and the react-map-gl wrapper —
 * which is around 60% of all the JavaScript on the dashboard, for a 288px-tall
 * summary with no relief, no currents and no species overlay.
 *
 * It used to be kicked off at MODULE scope, on the theory that starting early
 * beats starting late. Measured on a production build over 4 Mbps, that put a
 * 265 KB chunk on the wire at 790ms and another mid-flight at 2243ms, both
 * competing with map/spots and the 14-day outlook for the same bandwidth — and
 * it ran for EVERY visitor, including one with no saved spots, who then got
 * "Save spots to see them on your map" for their 396 KB.
 *
 * So: download it when it is about to be looked at, and not before. The margin
 * is generous enough that a scroll finds the chunk already in flight.
 *
 * Latches on. Once loaded there is nothing to unload, and re-firing on every
 * scroll past would just churn state.
 */
function useNearViewport(ref: RefObject<HTMLElement | null>, margin = "400px"): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    // Without IntersectionObserver, load rather than never show a map.
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, near, margin]);
  return near;
}

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
  resolving = false,
}: {
  spots: RailSpot[];
  /**
   * Coordinates for the saved set are still arriving. Distinguishes "no spots
   * yet" from "no spots" — and it must stay true until the map payload lands,
   * not merely until the saved list does: a favourite is known by slug long
   * before anything knows where it is, so the list can be non-empty while
   * every entry still sits at 0,0. Treating that gap as "no spots" tore the
   * map down a second after it mounted and rebuilt it seconds later.
   */
  resolving?: boolean;
}) {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const hasFitted = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const nearViewport = useNearViewport(sectionRef);

  // Read AFTER mount, not in a state initializer.
  //
  // This page is server-rendered now, and the server has no localStorage: an
  // initializer would make the first client render (the hydration pass)
  // disagree with the server HTML — map here, skeleton there — which is the
  // mismatch class that has blanked pages in this app before. The cost is one
  // effect tick before the map mounts, which is nothing next to the round trip
  // it used to wait on.
  const [savedView, setSavedView] = useState<SavedView | null>(null);
  useEffect(() => {
    setSavedView(readSavedView());
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
  const hasMapToDraw = plottable.length > 0 || (resolving && savedView !== null);
  // Two conditions, and both are about not wasting the download: there has to
  // BE a map worth drawing, and it has to be somewhere the angler can see.
  const showMap = hasMapToDraw && nearViewport;

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
    <section
      ref={sectionRef}
      className="overflow-hidden rounded border border-rc-rule bg-rc-panel"
    >
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
      ) : hasMapToDraw || resolving ? (
        // Same block for "still resolving" and "there is a map, it just isn't
        // near the viewport yet". It has to hold the map's full height either
        // way: it is the element the observer watches, and a zero-height box
        // would never intersect — the map would then never load at all.
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
