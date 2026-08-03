"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { ChevronRight } from "lucide-react";
import type { RailSpot } from "@/app/explore/lib/explore-data";

// SSR-off: MapLibre touches `window` on mount.
const ExploreMap = dynamic(
  () => import("@/app/explore/components/explore-map"),
  { ssr: false },
);

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
export default function DashboardSavedMap({ spots }: { spots: RailSpot[] }) {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const [ready, setReady] = useState(false);

  // Only spots with real coordinates can plot (unscored fallbacks have 0,0).
  const plottable = spots.filter(
    (s) =>
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng) &&
      (s.lat !== 0 || s.lng !== 0),
  );

  useEffect(() => {
    if (!ready) return;
    const bounds = boundsOf(plottable);
    if (!bounds) return;
    mapRef.current?.fitBounds(bounds, {
      padding: 48,
      maxZoom: 12,
      duration: 600,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, plottable.length]);

  return (
    <section className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
      {plottable.length > 0 ? (
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
            initialCenter={DEFAULT_CENTER}
            initialZoom={6}
            relief={false}
            labels
            currents={false}
            showBrand={false}
            onViewportChange={() => setReady(true)}
          />
          {/* The one map CTA, sitting on the map itself. */}
          <Link
            href="/explore"
            className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded bg-rc-panel/95 px-2.5 py-1.5 font-rc-mono text-[11px] font-bold text-rc-brand shadow-rc-panel backdrop-blur-sm hover:bg-rc-panel"
          >
            View full map <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
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
