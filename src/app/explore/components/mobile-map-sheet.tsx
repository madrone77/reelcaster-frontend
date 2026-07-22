"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RailSpot } from "../lib/explore-data";
import SpotCard from "./spot-card";
import SortControl, { type SortKey, sortSpots } from "./sort-control";
import ExploreFooter from "./explore-footer";

type Detent = "peek" | "half" | "full";

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
  onSelectSpot,
}: {
  spots: RailSpot[];
  tz: string;
  onSelectSpot: (slug: string) => void;
}) {
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
    <div
      className="lg:hidden fixed inset-x-0 z-30 flex flex-col rounded-t-2xl border-t border-rc-rule bg-rc-panel shadow-[0_-8px_30px_rgba(15,23,42,0.12)]"
      style={{
        // Sit above the fixed bottom tab bar (h-14 + safe area).
        bottom: "calc(3.5rem + env(safe-area-inset-bottom))",
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
            <div className="rc-label text-[9px]">Viewing all spots</div>
            <div className="mt-0.5 text-[15px] font-semibold text-rc-ink">
              {spots.length} spot{spots.length === 1 ? "" : "s"}
            </div>
          </div>
          {spots.length > 1 && (
            // Keep taps on the sort control from starting a sheet drag.
            <div onPointerDown={(e) => e.stopPropagation()}>
              <SortControl sort={sort} onSort={setSort} />
            </div>
          )}
        </div>
      </div>

      {/* Scrollable spot list — independent of the sheet drag. */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        <div className="mx-auto max-w-[392px] space-y-3 pt-1">
          {sorted.map((spot) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              tz={tz}
              onSelect={() => onSelectSpot(spot.slug)}
            />
          ))}

          {spots.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="mb-1 text-sm font-semibold text-rc-ink">
                No published spots here yet
              </p>
              <p className="text-xs text-rc-ink-mute">
                Pan or zoom the map to find spots — coverage is rolling out
                across BC, WA, and OR.
              </p>
            </div>
          )}
        </div>

        <ExploreFooter />
      </div>
    </div>
  );
}
