"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Map, { Marker, type MapRef, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { X, MapPin, Loader2, Anchor } from "lucide-react";
import type { BlueCasterSpotPage } from "@/lib/bluecaster";
import { breakdownRows } from "@/lib/factor-language";

export interface ExploreSpot {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  city_slug: string;
  city_name: string;
  province_code: string;
  region_slug: string;
}

export interface ExploreProvince {
  code: string;
  name: string;
  country_code: string;
  is_covered: boolean;
}

const COVERED_BBOX: Record<string, [number, number, number, number]> = {
  // [minLng, minLat, maxLng, maxLat]
  BC: [-139.06, 48.3, -114.03, 60.0],
  WA: [-124.85, 45.5, -116.91, 49.0],
  OR: [-124.6, 41.99, -116.46, 46.27],
  ALL: [-139.06, 41.99, -114.03, 60.0],
};

export default function ExploreCanvas({
  spots,
  provinces,
}: {
  spots: ExploreSpot[];
  provinces: ExploreProvince[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapRef = useRef<MapRef>(null);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const selectedSlug = searchParams.get("spot") ?? null;
  const selectedProvince = searchParams.get("province") ?? "ALL";

  const visibleSpots = useMemo(() => {
    if (selectedProvince === "ALL") return spots;
    return spots.filter((s) => s.province_code === selectedProvince);
  }, [spots, selectedProvince]);

  const initialBbox = COVERED_BBOX[selectedProvince] ?? COVERED_BBOX.ALL;
  const initialCenter = useMemo(
    () => ({
      lat: (initialBbox[1] + initialBbox[3]) / 2,
      lng: (initialBbox[0] + initialBbox[2]) / 2,
    }),
    [initialBbox],
  );

  const [viewport, setViewport] = useState({
    latitude: initialCenter.lat,
    longitude: initialCenter.lng,
    zoom: selectedProvince === "ALL" ? 4 : 6,
  });

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

  // Re-fly to province bbox when filter changes
  useEffect(() => {
    const bbox = COVERED_BBOX[selectedProvince] ?? COVERED_BBOX.ALL;
    mapRef.current?.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: 60, duration: 800 },
    );
  }, [selectedProvince]);

  const handlePinClick = useCallback(
    (slug: string) => {
      setQuery({ spot: slug });
      const spot = spots.find((s) => s.slug === slug);
      if (spot) {
        mapRef.current?.flyTo({
          center: [spot.lng, spot.lat],
          zoom: Math.max(viewport.zoom, 11),
          duration: 700,
        });
      }
    },
    [setQuery, spots, viewport.zoom],
  );

  const closeSidebar = useCallback(() => {
    setQuery({ spot: null });
  }, [setQuery]);

  const coveredProvinces = provinces.filter((p) => p.is_covered);

  if (!mapboxToken) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-6 max-w-md text-center">
          <p className="text-rc-text font-semibold mb-2">Map unavailable</p>
          <p className="text-sm text-rc-text-muted">
            Set <code className="text-rc-text">NEXT_PUBLIC_MAPBOX_TOKEN</code> to
            enable the explore canvas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Top bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 px-3 sm:px-4 pt-3 sm:pt-4 pointer-events-none">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto bg-rc-bg-dark/90 backdrop-blur border border-rc-bg-light rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg">
            <Link
              href="/fishing"
              className="flex items-center gap-1.5 text-rc-text font-bold text-sm hover:text-blue-400 transition-colors"
            >
              <Anchor className="w-4 h-4 text-blue-400" />
              ReelCaster
            </Link>
            <span className="text-rc-text-muted text-xs px-2 hidden sm:inline">
              Explore
            </span>
            <span className="text-rc-text-muted text-xs hidden sm:inline">
              · {visibleSpots.length} spot{visibleSpots.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="pointer-events-auto bg-rc-bg-dark/90 backdrop-blur border border-rc-bg-light rounded-xl p-1 flex items-center gap-1 shadow-lg overflow-x-auto max-w-full">
            <ProvincePill
              code="ALL"
              label="All"
              active={selectedProvince === "ALL"}
              onClick={() => setQuery({ province: null })}
            />
            {coveredProvinces.map((p) => (
              <ProvincePill
                key={p.code}
                code={p.code}
                label={p.code}
                active={selectedProvince === p.code}
                onClick={() => setQuery({ province: p.code })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          latitude: initialCenter.lat,
          longitude: initialCenter.lng,
          zoom: viewport.zoom,
        }}
        onMove={(e) =>
          setViewport({
            latitude: e.viewState.latitude,
            longitude: e.viewState.longitude,
            zoom: e.viewState.zoom,
          })
        }
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {visibleSpots.map((spot) => (
          <Marker
            key={spot.id}
            longitude={spot.lng}
            latitude={spot.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handlePinClick(spot.slug);
            }}
          >
            <button
              type="button"
              className={`group relative flex flex-col items-center transition-transform ${
                selectedSlug === spot.slug ? "scale-110" : "hover:scale-110"
              }`}
              aria-label={`Open ${spot.name}`}
            >
              <span
                className={`flex items-center justify-center w-7 h-7 rounded-full border-2 shadow-lg ${
                  selectedSlug === spot.slug
                    ? "bg-blue-600 border-white"
                    : "bg-rc-bg-dark border-blue-400 group-hover:bg-blue-600"
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-white" />
              </span>
              {(selectedSlug === spot.slug ||
                visibleSpots.length <= 12) && (
                <span
                  className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap shadow-md ${
                    selectedSlug === spot.slug
                      ? "bg-blue-600 text-white"
                      : "bg-rc-bg-dark text-rc-text border border-rc-bg-light"
                  }`}
                >
                  {spot.name}
                </span>
              )}
            </button>
          </Marker>
        ))}
      </Map>

      {/* Empty state */}
      {visibleSpots.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto bg-rc-bg-dark/95 backdrop-blur border border-rc-bg-light rounded-xl p-5 max-w-sm text-center shadow-xl">
            <p className="text-rc-text font-semibold mb-1">
              No published spots in this region yet
            </p>
            <p className="text-sm text-rc-text-muted mb-3">
              Pro Intel is rolling out across BC, WA, and OR. New spots are added
              every week.
            </p>
            <Link
              href="/fishing"
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors"
            >
              Browse city pages
            </Link>
          </div>
        </div>
      )}

      {/* Coverage footer banner */}
      <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-10 pointer-events-none">
        <div className="pointer-events-auto bg-rc-bg-dark/90 backdrop-blur border border-rc-bg-light rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-3">
          <p className="text-xs text-rc-text-muted flex-1">
            Live in{" "}
            <span className="text-rc-text font-semibold">BC, WA, OR</span>.
            Fishing elsewhere?
          </p>
          <Link
            href="/pricing#waitlist"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap"
          >
            Drop a pin →
          </Link>
        </div>
      </div>

      {/* Right sidebar (desktop) / bottom sheet (mobile) */}
      {selectedSlug && (
        <SpotDetailPanel slug={selectedSlug} onClose={closeSidebar} />
      )}
    </div>
  );
}

function ProvincePill({
  label,
  active,
  onClick,
}: {
  code: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "text-rc-text-muted hover:bg-rc-bg-light hover:text-rc-text"
      }`}
    >
      {label}
    </button>
  );
}

function SpotDetailPanel({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<BlueCasterSpotPage | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setData(null);

    fetch(`/api/spot-page/${slug}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setStatus("missing");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const json = (await res.json()) as BlueCasterSpotPage;
        setData(json);
        setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
        onClick={onClose}
      />

      <aside
        className="fixed z-40 bg-rc-bg-dark border-rc-bg-light shadow-2xl flex flex-col
          inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl border-t
          lg:inset-y-0 lg:right-0 lg:left-auto lg:top-0 lg:bottom-0 lg:max-h-none lg:w-[400px] lg:rounded-none lg:border-t-0 lg:border-l"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-rc-bg-light">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-rc-text-muted mb-1">
              Spot
            </p>
            <h2 className="text-lg font-bold text-rc-text truncate">
              {data?.spot.name ?? slug.replace(/-[0-9a-f]{6}$/, "")}
            </h2>
            {data?.hierarchy && (
              <p className="text-xs text-rc-text-muted mt-0.5">
                {data.hierarchy.city.name},{" "}
                {data.hierarchy.province.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-rc-text-muted hover:bg-rc-bg-light hover:text-rc-text transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-rc-text-muted py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading spot…
            </div>
          )}

          {status === "missing" && (
            <div className="text-center py-6">
              <p className="text-sm text-rc-text mb-1 font-semibold">
                Page not yet published
              </p>
              <p className="text-xs text-rc-text-muted">
                This spot is in our database but doesn&apos;t have a published
                profile yet. Check back soon.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-6">
              <p className="text-sm text-rc-text mb-1 font-semibold">
                Couldn&apos;t load spot
              </p>
              <p className="text-xs text-rc-text-muted">
                Please try again in a moment.
              </p>
            </div>
          )}

          {status === "ok" && data && <SpotDetailBody data={data} />}
        </div>
      </aside>
    </>
  );
}

function SpotDetailBody({ data }: { data: BlueCasterSpotPage }) {
  const score = data.rc_score_now;
  const rows = breakdownRows(score?.factor_contributions ?? null).slice(0, 6);
  const cityHref = data.hierarchy
    ? `/fishing/${data.hierarchy.province.code.toLowerCase()}/${data.hierarchy.city.slug}`
    : null;
  const spotHref = data.hierarchy
    ? `/fishing/${data.hierarchy.province.code.toLowerCase()}/${data.hierarchy.city.slug}/${data.page.slug}`
    : null;

  return (
    <div className="space-y-4">
      {score && (
        <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-rc-text-muted">
                RC Score · {score.species_name}
              </p>
              <p className="text-xs text-rc-text-light capitalize">
                {score.state}
              </p>
            </div>
            <span
              className={`text-3xl font-black ${
                score.score >= 70
                  ? "text-emerald-400"
                  : score.score >= 50
                    ? "text-amber-400"
                    : "text-rc-text-muted"
              }`}
            >
              {score.score}
            </span>
          </div>

          {rows.length > 0 && (
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <li
                  key={r.key}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-rc-text-muted">{r.label}</span>
                  <span className="text-rc-text-light">
                    {r.state ??
                      (r.contribution !== null
                        ? r.contribution.toFixed(2)
                        : "—")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!score && (
        <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-4 text-xs text-rc-text-muted">
          No live score yet for this spot. Try again in a few minutes.
        </div>
      )}

      <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-rc-text-muted mb-2">
          Spot details
        </p>
        <dl className="text-xs space-y-1.5">
          <div className="flex justify-between gap-3">
            <dt className="text-rc-text-muted">Coordinates</dt>
            <dd className="text-rc-text-light font-mono">
              {data.spot.lat.toFixed(3)}, {data.spot.lng.toFixed(3)}
            </dd>
          </div>
          {data.spot.depth_avg_m !== null && (
            <div className="flex justify-between gap-3">
              <dt className="text-rc-text-muted">Avg depth</dt>
              <dd className="text-rc-text-light">{data.spot.depth_avg_m} m</dd>
            </div>
          )}
          {data.spot.dfo_area_label && (
            <div className="flex justify-between gap-3">
              <dt className="text-rc-text-muted">DFO area</dt>
              <dd className="text-rc-text-light">{data.spot.dfo_area_label}</dd>
            </div>
          )}
          {data.spot.tidal_station_name && (
            <div className="flex justify-between gap-3">
              <dt className="text-rc-text-muted">Tide station</dt>
              <dd className="text-rc-text-light truncate">
                {data.spot.tidal_station_name}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {data.species_table.length > 0 && (
        <div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-rc-text-muted mb-2">
            Species
          </p>
          <ul className="space-y-1">
            {data.species_table.slice(0, 5).map((s) => (
              <li
                key={s.species_id}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-rc-text-light">{s.species_name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    s.status === "open"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : s.status === "non_retention"
                        ? "bg-amber-500/20 text-amber-300"
                        : s.status === "closed"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-rc-bg-light text-rc-text-muted"
                  }`}
                >
                  {s.status ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        {spotHref && (
          <Link
            href={spotHref}
            className="flex-1 text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors"
          >
            Open spot page
          </Link>
        )}
        {cityHref && (
          <Link
            href={cityHref}
            className="px-4 py-2.5 bg-rc-bg-light hover:bg-rc-bg-darkest border border-rc-bg-light rounded-lg text-sm font-medium text-rc-text-light transition-colors"
          >
            City
          </Link>
        )}
      </div>
    </div>
  );
}
