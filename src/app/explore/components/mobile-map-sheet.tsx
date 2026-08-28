"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronUp, X } from "lucide-react";
import AdSlot from "@/app/components/ads/ad-slot";
import type { RailSpot, Tier } from "../lib/explore-data";
import { MAP_INSET_ATTR, MAP_INSET_RESTING_ATTR } from "../lib/sheet-safe-center";
import type { ForecastStripModel, ForecastDay } from "../lib/forecast-strip";
import type { FreshCatchesResponse } from "../lib/fresh-catch-types";
import SpotCard from "./spot-card";
import SortControl, { type SortKey, sortSpots } from "./sort-control";
import SheetForecast from "./sheet-forecast";
import ExploreFooter from "./explore-footer";

type Detent = "peek" | "half" | "full";

/**
 * Squared distance between two spots in degrees, longitude corrected for
 * latitude. Only ever compared against another of the same, so the square root
 * and the earth radius both cancel out — this is an ordering, not a readout.
 */
function spotDist2(a: RailSpot, b: RailSpot): number {
  const dx =
    (a.lng - b.lng) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dy = a.lat - b.lat;
  return dx * dx + dy * dy;
}

/** Score colour on the day pill — the tier tokens the day cells already use. */
const DAY_PILL_SCORE: Record<Tier, string> = {
  good: "text-rc-good",
  fair: "text-rc-fair-ink",
  poor: "text-rc-poor",
  none: "text-rc-ink-mute",
};

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
  onSelectDay,
  signedIn,
  onLockedAdDay,
  freshCatches,
  selectedSlug = null,
  previewAnchorSlug = null,
  onPreviewSlug,
  onClosePreview,
}: {
  spots: RailSpot[];
  tz: string;
  locationName?: string | null;
  onSelectSpot: (slug: string) => void;
  forecastModel: ForecastStripModel | null;
  selectedIso: string;
  onSelectDay: (day: ForecastDay) => void;
  signedIn: boolean;
  /** Ad frame: focus the offer already on the page instead of opening a
   *  dialog. Passed straight through to the sheet's forecast rows. */
  onLockedAdDay?: () => void;
  /** Scraped catch reports keyed by spot id — the same payload the desktop
   *  rail joins on, so a spot wears the same badge on both surfaces. Already
   *  Pro-gated by the route: a free viewer's entries carry `locked: true`. */
  freshCatches?: FreshCatchesResponse | null;
  /** The spot the map has selected (`?spot=`), or null for the browse list.
   *  Non-null swaps this dock from the spot list to the preview carousel. */
  selectedSlug?: string | null;
  /** The pin that opened the preview. The carousel is ordered by distance from
   *  it, so swiping walks outward from the spot actually tapped. */
  previewAnchorSlug?: string | null;
  /** The carousel was swiped onto a different spot — move the map selection
   *  to match. Distinct from `onSelectSpot`, which OPENS the spot page. */
  onPreviewSlug?: (slug: string) => void;
  /** Dismiss the preview and go back to the browse list. */
  onClosePreview?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");
  const sorted = useMemo(() => sortSpots(spots, sort), [spots, sort]);
  const selectedDay = useMemo(
    () => forecastModel?.days.find((d) => d.iso === selectedIso) ?? null,
    [forecastModel, selectedIso],
  );

  // Escape closes the picker, matching the location and filter sheets.
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  // Detent visible-heights (px) derived from the viewport height.
  const [vh, setVh] = useState(0);
  useEffect(() => {
    const read = () => setVh(window.innerHeight);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // Peek is the measured height of the header block (handle + count + view
  // toggle), not a guessed number. A hardcoded one left the top of the first
  // spot card sticking into the peek and guillotined mid-row, which read as a
  // rendering fault rather than a list you can drag open.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setHeaderH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const detents = useMemo(() => {
    const h = vh || 800;
    return {
      peek: headerH || 132,
      // Leave ~132px of map (+ the floating location header) visible up top.
      half: Math.round(h * 0.5),
      full: Math.max(240, h - 132),
    };
  }, [vh, headerH]);

  const [detent, setDetent] = useState<Detent>("peek");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Collapsed folds the sheet down to a slim bar (handle + count + reopen
  // chevron), clearing the map. A tap on the chevron toggles it; a tap or drag
  // anywhere on the bar reopens to peek.
  const [collapsed, setCollapsed] = useState(false);
  const COLLAPSED_H = 52;

  const height = collapsed ? COLLAPSED_H : dragHeight ?? detents[detent];

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

  // ── Preview carousel ────────────────────────────────────────────────
  // A tap on a map pin docks ONE spot card here instead of routing away, and
  // swiping the dock walks the spots in view. Selection is the same `?spot=`
  // param the desktop drawer reads, so a deep link lands on the card too.
  // Nearest-first from the tapped pin, NOT the list's sort. Ordering the deck
  // by score meant tapping one pin opened at "41 of 53" and swiping walked the
  // regional ranking — the two cards either side of a spot had nothing to do
  // with the water around it. Nearest-first makes a swipe mean "and what's
  // next to it", which is the question a map pin asks.
  const previewOrder = useMemo(() => {
    const anchor = spots.find((sp) => sp.slug === previewAnchorSlug);
    if (!anchor) return sorted;
    return [...spots].sort((a, b) => spotDist2(anchor, a) - spotDist2(anchor, b));
  }, [spots, sorted, previewAnchorSlug]);

  const previewIndex = previewOrder.findIndex((sp) => sp.slug === selectedSlug);
  const previewing = selectedSlug != null && previewIndex >= 0;

  const railRef = useRef<HTMLDivElement | null>(null);
  // What the dock actually covers, measured. The camera reads this to frame
  // the tapped pin in the water still visible above the card, and a card's
  // height varies with its content (a reports badge, a wrapped spot name), so
  // a guessed constant would aim the flyTo at the wrong water.
  const [dockH, setDockH] = useState(232);
  const dockRO = useRef<ResizeObserver | null>(null);
  // Callback ref, not an effect: the dock mounts and unmounts as the angler
  // taps in and out of pins, so there is no stable dependency to key an effect
  // on — the ref firing IS the event.
  const dockRef = useCallback((el: HTMLDivElement | null) => {
    dockRO.current?.disconnect();
    dockRO.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    setDockH(Math.round(el.offsetHeight));
    const ro = new ResizeObserver(() => setDockH(Math.round(el.offsetHeight)));
    ro.observe(el);
    dockRO.current = ro;
  }, []);
  const centredIndex = useCallback(() => {
    const el = railRef.current;
    if (!el) return -1;
    const centre = el.scrollLeft + el.clientWidth / 2;
    let best = -1;
    let bestD = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }, []);

  // Snap settled on a new card → move the map's selection to it.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRailScroll = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const i = centredIndex();
      const next = previewOrder[i];
      if (!next || next.slug === selectedSlug) return;
      onPreviewSlug?.(next.slug);
    }, 90);
  }, [centredIndex, previewOrder, selectedSlug, onPreviewSlug]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  // Selection changed from the map → bring that card into view. Instant on the
  // first paint of a dock (there is nothing to animate from), smooth after.
  //
  // The two directions are told apart by where the rail already sits, not by a
  // "who moved last" flag: a flag that is set but never consumed (the settle
  // fired, the slug did not change) stays set, and swallows the scroll for the
  // NEXT pin the angler taps. The rail's own position can't go stale.
  const wasPreviewing = useRef(false);
  useEffect(() => {
    if (!previewing) {
      wasPreviewing.current = false;
      return;
    }
    const el = railRef.current;
    const card = el?.children[previewIndex] as HTMLElement | undefined;
    if (!el || !card) return;
    if (centredIndex() === previewIndex) {
      // Already the card in hand — this is the swipe that set the slug.
      wasPreviewing.current = true;
      return;
    }
    el.scrollTo({
      left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2,
      behavior: wasPreviewing.current ? "smooth" : "auto",
    });
    wasPreviewing.current = true;
  }, [previewing, previewIndex, centredIndex]);

  if (previewing) {
    const spot = previewOrder[previewIndex];
    return (
      <>
        <div
          aria-hidden
          className="lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-rc-panel"
          style={{ height: "var(--rc-tabbar-clearance)" }}
        />
        <div
          // Same contract as the sheet: tell the camera how much map this
          // covers so `sheet-safe-center` frames the tapped pin in the water
          // still visible above it.
          {...{
            [MAP_INSET_ATTR]: "bottom",
            [MAP_INSET_RESTING_ATTR]: String(dockH),
          }}
          ref={dockRef}
          role="dialog"
          aria-label={`${spot.name} preview`}
          className="lg:hidden fixed inset-x-0 z-30 pt-1"
          style={{ bottom: "var(--rc-tabbar-clearance)" }}
        >
          {/* Both controls hug the LEFT edge: the map's zoom buttons live at
              the right, and a close button under them is a 44px target sharing
              an edge with "zoom out". */}
          <div className="mb-1.5 flex items-center gap-2 px-4">
            <button
              type="button"
              onClick={onClosePreview}
              aria-label="Close spot preview"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rc-ink/70 text-white backdrop-blur"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="rounded-full bg-rc-ink/70 px-2.5 py-1 font-rc-mono text-[11px] font-semibold text-white backdrop-blur">
              {previewIndex + 1} of {previewOrder.length}
            </span>
          </div>

          {/* One card per spot in view, snapped. Only the card in hand and its
              two neighbours actually mount — every SpotCard runs its own
              subscription + favourite reads, and 40 of them behind a swipe is
              a request storm for cards nobody has scrolled to yet. The rest
              hold their width so the snap offsets stay honest. */}
          <div
            ref={railRef}
            onScroll={onRailScroll}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-hide px-[7vw] pb-2"
          >
            {previewOrder.map((sp, i) => (
              <div
                key={sp.id}
                className="w-[86vw] shrink-0 snap-center"
              >
                {Math.abs(i - previewIndex) <= 1 && (
                  <SpotCard
                    spot={sp}
                    tz={tz}
                    onSelect={() => onSelectSpot(sp.slug)}
                    fresh={freshCatches?.spots[sp.id]}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* White base filling the strip the floating nav pill floats over, so the
          map doesn't peek through below/around the sheet — the sheet's white
          reads as continuous all the way to the screen bottom. Its top meets the
          sheet's bottom exactly (same offset). */}
      <div
        aria-hidden
        className="lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-rc-panel"
        style={{ height: "var(--rc-tabbar-clearance)" }}
      />
      <div
        // Tells the camera how much of the map this covers, so a spot the angler
        // taps here is framed in the water they can see, not behind the sheet.
        // The resting height is what gets measured, not `height`: the sheet can
        // be dragged up to browse, but it always comes back at peek, and that is
        // the frame the return trip will be seen in.
        {...{ [MAP_INSET_ATTR]: "bottom", [MAP_INSET_RESTING_ATTR]: String(collapsed ? COLLAPSED_H : detents.peek) }}
        className="lg:hidden fixed inset-x-0 z-30 flex flex-col rounded-t-2xl border-t border-rc-rule bg-rc-panel shadow-[0_-8px_30px_rgba(15,23,42,0.12)]"
        style={{
          // Sit above the floating bottom tab bar (see --rc-tabbar-clearance).
          bottom: "var(--rc-tabbar-clearance)",
          height,
          transition:
            dragHeight == null ? "height 0.3s cubic-bezier(0.32,0.72,0,1)" : "none",
        }}
        role="dialog"
        aria-label="Spots in view"
      >
      {/* Collapsed — a slim bar. Tap anywhere on it to reopen to peek. */}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Show spot list"
          className="shrink-0 px-4 pt-2.5 pb-2 text-left"
        >
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-rc-rule" />
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[15px] font-semibold text-rc-ink">
              {locationName ? `${locationName} · ` : ""}
              {spots.length} spot{spots.length === 1 ? "" : "s"}
            </span>
            <ChevronUp className="h-4 w-4 shrink-0 text-rc-ink-mute" />
          </div>
        </button>
      )}

      {/* Drag handle + count — owns the drag gesture. */}
      <div
        ref={headerRef}
        className={`shrink-0 cursor-grab touch-none select-none px-4 pt-2.5 pb-2 ${collapsed ? "hidden" : ""}`}
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
          {/* Sort + a collapse chevron. Both must swallow the pointer so a tap
              doesn't start a sheet drag. */}
          <div
            className="flex items-center gap-1.5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {spots.length > 1 && <SortControl sort={sort} onSort={setSort} />}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse spot list"
              className="flex h-8 w-8 items-center justify-center rounded-md text-rc-ink-mute transition-colors hover:bg-rc-surface"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* The day the map is showing, stated as text, with the picker
            behind a button that says what it does. It was a single pill whose
            label was the date — which read as a status line, so the way to
            change the day was invisible unless you happened to tap it. Saying
            the day and offering the change are two jobs; they get two
            elements. */}
        <div
          className="mt-2.5 flex items-center justify-between gap-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-[13px] font-semibold text-rc-ink">
              {selectedDay
                ? `${selectedDay.index === 0 ? "Today" : selectedDay.dow} · ${selectedDay.date}`
                : "14-day forecast"}
            </span>
            {selectedDay?.score != null && (
              <span
                className={`font-rc-mono text-[12px] font-bold ${DAY_PILL_SCORE[selectedDay.tier]}`}
              >
                {selectedDay.score}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={!selectedDay}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rc-rule bg-rc-surface px-3 py-1.5 text-[13px] font-semibold text-rc-brand transition-colors enabled:hover:border-rc-brand disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand"
          >
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            Change date
          </button>
        </div>
      </div>

      {/* Body — the spots in view (hidden while the sheet is collapsed). The
          fortnight is a picker now, not a second tenant of this space. */}
      <div
        className={`flex-1 overflow-y-auto overscroll-contain ${collapsed ? "hidden" : ""}`}
      >
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
      </div>

      {/* The list runs right up to the sheet's bottom edge, so whatever card
          the edge lands on gets cut mid-row. Fade the last few pixels into the
          panel so that reads as "keep scrolling" rather than a broken row.
          Only once the sheet is open — at peek the body has no height and the
          gradient would sit on the day pill instead. */}
      {height > detents.peek + 8 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-rc-panel to-transparent"
        />
      )}
      </div>

      {/* Day picker — the 14-day ledger, on demand. A portaled bottom sheet
          like the location and filter pickers, so the three things you can
          change about the map all open the same way. It stays open on a pick:
          the row you tapped expands into its 24-hour scrub lane, and dragging
          that is the reason to still be here. */}
      {pickerOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/25"
              onClick={() => setPickerOpen(false)}
            />
            <div
              role="dialog"
              aria-label="Pick a day"
              className="fixed inset-x-0 bottom-0 z-[61] max-h-[75vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-rc-panel shadow-rc-panel animate-slide-up pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
            >
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="h-1 w-9 rounded-full bg-rc-rule" />
              </div>
              {/* Names the instrument the same way the spot page's section
                  does, so the fortnight reads as one thing across surfaces. */}
              <div className="flex items-baseline justify-between gap-3 px-4 pb-3">
                <span className="rc-label text-[9px]">14-Day Forecast</span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="text-[13px] font-semibold text-rc-brand"
                >
                  Done
                </button>
              </div>
              <SheetForecast
                model={forecastModel}
                selectedIso={selectedIso}
                onSelectDay={onSelectDay}
                signedIn={signedIn}
                onLockedAdDay={onLockedAdDay}
              />
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
