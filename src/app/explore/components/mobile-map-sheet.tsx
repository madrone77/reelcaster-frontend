"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdSlot from "@/app/components/ads/ad-slot";
import type { RailSpot } from "../lib/explore-data";
import { MAP_INSET_ATTR, MAP_INSET_RESTING_ATTR } from "../lib/sheet-safe-center";
import type { ForecastStripModel, ForecastDay } from "../lib/forecast-strip";
import type { FreshCatchesResponse } from "../lib/fresh-catch-types";
import SpotCard from "./spot-card";
import SortControl, { type SortKey, sortSpots } from "./sort-control";
import SheetForecast from "./sheet-forecast";
import ExploreFooter from "./explore-footer";

type Detent = "peek" | "half" | "full";
type SheetView = "spots" | "forecast";

/**
 * Zillow-style mobile bottom sheet over the full-screen Explore map. Three
 * drag detents — peek (handle + count only), half, and full (list with a
 * sliver of map showing). The drag handle owns the gesture; the list below it
 * scrolls independently, so flicking through spots never fights the sheet.
 * Floats above the fixed bottom tab bar. Replaces the old in-flow spot list on
 * small screens (the desktop rail is unchanged).
 */
export default function MobileMapSheet({
  spots,
  tz,
  locationName,
  onSelectSpot,
  forecastModel,
  selectedIso,
  selectedDayHours,
  scrubHour,
  onScrubHour,
  onSelectDay,
  signedIn,
  freshCatches,
}: {
  spots: RailSpot[];
  tz: string;
  locationName?: string | null;
  onSelectSpot: (slug: string) => void;
  forecastModel: ForecastStripModel | null;
  selectedIso: string;
  selectedDayHours: (number | null)[];
  scrubHour: number | null;
  onScrubHour: (h: number) => void;
  onSelectDay: (day: ForecastDay) => void;
  signedIn: boolean;
  /** Scraped catch reports keyed by spot id — the same payload the desktop
   *  rail joins on, so a spot wears the same badge on both surfaces. Already
   *  Pro-gated by the route: a free viewer's entries carry `locked: true`. */
  freshCatches?: FreshCatchesResponse | null;
}) {
  const [view, setView] = useState<SheetView>("spots");
  const [sort, setSort] = useState<SortKey>("score");
  const sorted = useMemo(() => sortSpots(spots, sort), [spots, sort]);

  // Detent visible-heights (px) derived from the viewport height.
  const [vh, setVh] = useState(0);
  useEffect(() => {
    const read = () => setVh(window.innerHeight);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const detents = useMemo(() => {
    const h = vh || 800;
    return {
      peek: 132,
      half: Math.round(h * 0.5),
      // Leave ~132px of map (+ the floating location header) visible up top.
      full: Math.max(240, h - 132),
    };
  }, [vh]);

  const [detent, setDetent] = useState<Detent>("peek");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const height = dragHeight ?? detents[detent];

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { startY: e.clientY, startH: detents[detent] };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [detent, detents],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - e.clientY; // drag up = grow
      const next = Math.min(
        detents.full,
        Math.max(detents.peek, dragRef.current.startH + dy),
      );
      setDragHeight(next);
    },
    [detents],
  );

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const h = dragHeight ?? detents[detent];
    const opts: [Detent, number][] = [
      ["peek", detents.peek],
      ["half", detents.half],
      ["full", detents.full],
    ];
    let best: Detent = "peek";
    let bestD = Infinity;
    for (const [d, v] of opts) {
      const dd = Math.abs(v - h);
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    dragRef.current = null;
    setDragHeight(null);
    setDetent(best);
  }, [dragHeight, detent, detents]);

  return (
    <>
      {/* White base filling the strip the floating nav pill floats over, so the
          map doesn't peek through below/around the sheet — the sheet's white
          reads as continuous all the way to the screen bottom. Its top meets the
          sheet's bottom exactly (same offset). */}
      <div
        aria-hidden
        className="lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-rc-panel"
        style={{ height: "calc(5.25rem + env(safe-area-inset-bottom))" }}
      />
      <div
        // Tells the camera how much of the map this covers, so a spot the angler
        // taps here is framed in the water they can see, not behind the sheet.
        // The resting height is what gets measured, not `height`: the sheet can
        // be dragged up to browse, but it always comes back at peek, and that is
        // the frame the return trip will be seen in.
        {...{ [MAP_INSET_ATTR]: "bottom", [MAP_INSET_RESTING_ATTR]: String(detents.peek) }}
        className="lg:hidden fixed inset-x-0 z-30 flex flex-col rounded-t-2xl border-t border-rc-rule bg-rc-panel shadow-[0_-8px_30px_rgba(15,23,42,0.12)]"
        style={{
          // Sit above the floating bottom tab bar (pill h-16 + its 0.75rem gap).
          bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
          height,
          transition:
            dragHeight == null ? "height 0.3s cubic-bezier(0.32,0.72,0,1)" : "none",
        }}
        role="dialog"
        aria-label="Spots in view"
      >
      {/* Drag handle + count — owns the drag gesture. */}
      <div
        className="shrink-0 cursor-grab touch-none select-none px-4 pt-2.5 pb-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-rc-rule" />
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {/* Lead with the location so scope + count read as one unit —
                "Victoria · 24 spots" (per gelb-verify: the count belongs with
                the place that produced it). */}
            <div className="truncate text-[15px] font-semibold text-rc-ink">
              {locationName ? `${locationName} · ` : ""}
              {spots.length} spot{spots.length === 1 ? "" : "s"}
            </div>
          </div>
          {view === "spots" && spots.length > 1 && (
            // Keep taps on the sort control from starting a sheet drag.
            <div onPointerDown={(e) => e.stopPropagation()}>
              <SortControl sort={sort} onSort={setSort} />
            </div>
          )}
        </div>

        {/* All spots ⇄ 14-day — the two lenses on the same water. Tap-only
            (a swipe toggle was UX-vetoed for colliding with day-scroll). */}
        <div
          className="mt-2.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            role="group"
            aria-label="Sheet view"
            className="inline-flex rounded-full border border-rc-rule bg-rc-surface p-0.5"
          >
            <button
              type="button"
              aria-pressed={view === "spots"}
              onClick={() => setView("spots")}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand ${
                view === "spots"
                  ? "bg-rc-brand text-white shadow-sm"
                  : "text-rc-ink-soft hover:text-rc-ink"
              }`}
            >
              All spots
            </button>
            <button
              type="button"
              aria-pressed={view === "forecast"}
              onClick={() => setView("forecast")}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand ${
                view === "forecast"
                  ? "bg-rc-brand text-white shadow-sm"
                  : "text-rc-ink-soft hover:text-rc-ink"
              }`}
            >
              14-day
            </button>
          </div>
        </div>
      </div>

      {/* Body — swaps between the spot list and the 14-day forecast. */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {view === "forecast" ? (
          <SheetForecast
            model={forecastModel}
            selectedIso={selectedIso}
            hours={selectedDayHours}
            scrubHour={scrubHour}
            onScrubHour={onScrubHour}
            onSelectDay={onSelectDay}
            signedIn={signedIn}
          />
        ) : (
          <div className="px-4 pb-4">
            <div className="mx-auto max-w-[392px] space-y-3 pt-1">
              {sorted.map((spot, i) => (
                <Fragment key={spot.id}>
                  <SpotCard
                    spot={spot}
                    tz={tz}
                    onSelect={() => onSelectSpot(spot.slug)}
                    fresh={freshCatches?.spots[spot.id]}
                  />
                  {/* Same position as the desktop rail — after the third spot,
                      or at the foot of a shorter list. */}
                  {i === Math.min(2, sorted.length - 1) && (
                    <AdSlot placement="exploreList" only="mobile" />
                  )}
                </Fragment>
              ))}

              {spots.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="mb-1 text-sm font-semibold text-rc-ink">
                    No published spots here yet
                  </p>
                  <p className="text-xs text-rc-ink-mute">
                    Pan or zoom the map to find spots. Coverage is rolling out
                    across BC, WA, and OR.
                  </p>
                </div>
              )}
            </div>

            <ExploreFooter />
          </div>
        )}
      </div>
      </div>
    </>
  );
}
