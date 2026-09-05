"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import AdSlot from "@/app/components/ads/ad-slot";
import type { RailSpot } from "../lib/explore-data";
import { MAP_INSET_ATTR, MAP_INSET_RESTING_ATTR } from "../lib/sheet-safe-center";
import type { ForecastStripModel, ForecastDay } from "../lib/forecast-strip";
import type { FreshCatchesResponse } from "../lib/fresh-catch-types";
import SpotCard from "./spot-card";
import SortControl, { type SortKey, sortSpots } from "./sort-control";
import DatePillRail from "./date-pill-rail";
import ExploreFooter from "./explore-footer";

type Detent = "peek" | "half" | "full";

/** Slim-bar height when the sheet is folded away. */
const COLLAPSED_H = 52;

/**
 * How much of the first spot card the peek leaves showing, under the fade.
 * This is the whole discoverability budget for "there is a list down here".
 */
const PEEK_SLIVER = 36;

/** Pointer travel below which a drag on the header counts as a tap. */
const TAP_SLOP = 6;

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
  previewForecastModel,
  selectedIso,
  onSelectDay,
  signedIn,
  onLockedAdDay,
  freshCatches,
  selectedSlug = null,
  previewAnchorSlug = null,
  onPreviewSlug,
  onClosePreview,
  aboveSheet,
}: {
  spots: RailSpot[];
  tz: string;
  locationName?: string | null;
  onSelectSpot: (slug: string) => void;
  forecastModel: ForecastStripModel | null;
  /**
   * The same fortnight re-pointed at the previewed spot, for the carousel
   * dock. `forecastModel` is a viewport fold — the best score across every
   * spot in view — which is right for the browse list and wrong beside a
   * single card, where it showed one spot's name over another spot's number.
   * Falls back to the fold when absent.
   */
  previewForecastModel?: ForecastStripModel | null;
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
  /**
   * Map chrome that rides on the browse sheet's top edge: the layers button
   * and the hour bar. Rendered here rather than positioned from outside
   * because the sheet's height is its own business (detents, a live drag),
   * and chrome pinned to a guessed offset either buried itself under the
   * sheet or floated in the water above it. Hidden at the full detent, where
   * there is no map left to be chrome for, and not shown at all under the
   * preview dock, where the card takes the map.
   */
  aboveSheet?: ReactNode;
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
      // Header, plus a deliberate slice of the first card. The header alone
      // closed on its own bottom edge, which said "this is the whole thing":
      // the count promised 15 spots and nothing on screen showed one. A card
      // cut mid-row under the fade is the strongest way to say a list is
      // there, and it is the only one that costs no words.
      //
      // The comment on `headerRef` warns that a card sticking into the peek
      // reads as a rendering fault. That was a HARDCODED peek cutting at
      // wherever the card happened to be. This is measured and deliberate,
      // and the gradient below is what makes it read as a fold.
      peek: (headerH || 132) + PEEK_SLIVER,
      // Leave ~132px of map (+ the floating location header) visible up top.
      half: Math.round(h * 0.5),
      full: Math.max(240, h - 132),
    };
  }, [vh, headerH]);

  const [detent, setDetent] = useState<Detent>("peek");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{
    startY: number;
    startH: number;
    moved: boolean;
  } | null>(null);

  // Collapsed folds the sheet down to a slim bar (handle + count + reopen
  // chevron), clearing the map. A tap on the chevron toggles it; a tap or drag
  // anywhere on the bar reopens to peek.
  const [collapsed, setCollapsed] = useState(false);

  const height = collapsed ? COLLAPSED_H : dragHeight ?? detents[detent];

  // "Open" = the list is actually on screen, which is what the chevron's
  // direction and the sort control both key off.
  const open = !collapsed && detent !== "peek";

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = {
        startY: e.clientY,
        startH: detents[detent],
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [detent, detents],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - e.clientY; // drag up = grow
      if (Math.abs(dy) > TAP_SLOP) dragRef.current.moved = true;
      // Floors at the collapsed bar, not at peek: the chevron now expands
      // rather than collapses, so dragging down past peek is what folds the
      // sheet away. Without this that capability had nowhere left to live.
      const next = Math.min(
        detents.full,
        Math.max(COLLAPSED_H, dragRef.current.startH + dy),
      );
      setDragHeight(next);
    },
    [detents],
  );

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const moved = dragRef.current.moved;
    dragRef.current = null;

    // A tap on the header opens the list. People tap a bottom sheet before
    // they think to drag one, and at peek there was nothing a tap could do —
    // the count said 15 spots and the whole header was inert.
    if (!moved) {
      setDragHeight(null);
      if (detent === "peek") setDetent("half");
      return;
    }

    const h = dragHeight ?? detents[detent];
    const opts: [Detent | "collapsed", number][] = [
      ["collapsed", COLLAPSED_H],
      ["peek", detents.peek],
      ["half", detents.half],
      ["full", detents.full],
    ];
    let best: Detent | "collapsed" = "peek";
    let bestD = Infinity;
    for (const [d, v] of opts) {
      const dd = Math.abs(v - h);
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    setDragHeight(null);
    if (best === "collapsed") {
      // Reopening from the slim bar goes back to peek, so park the detent
      // there rather than wherever the drag started.
      setCollapsed(true);
      setDetent("peek");
      return;
    }
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
  //
  // The deck is FROZEN for the life of a preview session, because the carousel
  // moves the very list it would otherwise be built from. `spots` is the spots
  // in the viewport, and swiping re-centres the map on the card in hand, so a
  // live deck re-membered and re-sorted itself under the swipe: "3 of 11"
  // became "4 of 14" between one card and the next, and a spot two swipes out
  // fell off the far edge of the new viewport entirely — no index, no deck,
  // and the dock unmounted mid-gesture back to the browse list. Membership and
  // order are captured once, when the anchor is set; only the card DATA stays
  // live (below), so a score that refreshes still lands.
  const deckRef = useRef<{ key: string; order: RailSpot[] } | null>(null);
  if (selectedSlug == null) {
    deckRef.current = null;
  } else if (previewAnchorSlug && previewAnchorSlug !== deckRef.current?.key) {
    // Freeze only once the anchor is actually in hand, or a first paint with
    // no payload yet would capture an empty deck and hold it all session.
    // What that leaves is deterministic on both routes in: a pin tap freezes
    // the spots in view, because the map reported its viewport long ago; a
    // `?spot=` deep link freezes the home city's spots, because the anchor
    // first appears in the pre-viewport fallback, before MapLibre has
    // reported. That is the better deck of the two for a deep link — the
    // camera settles tight around the linked spot, and the viewport by then
    // holds little but the spot itself.
    const anchor = spots.find((sp) => sp.slug === previewAnchorSlug);
    if (anchor) {
      deckRef.current = {
        key: previewAnchorSlug,
        order: [...spots].sort((a, b) => spotDist2(anchor, a) - spotDist2(anchor, b)),
      };
    }
  }
  const frozenDeck = deckRef.current?.order ?? null;
  // Which deck is on screen. A new anchor is a new deck, not a move within the
  // one in hand, and the two want opposite scroll behaviour (below).
  const deckKey = deckRef.current?.key ?? null;

  // Frozen membership, live contents: each card re-reads itself from the spots
  // currently loaded and falls back to the snapshot when it has panned out of
  // view. That fallback is what keeps a card rendering instead of blanking
  // once the camera has walked away from where the deck was cut.
  const spotsById = useMemo(() => {
    const m = new Map<string, RailSpot>();
    for (const sp of spots) m.set(sp.id, sp);
    return m;
  }, [spots]);
  const previewOrder = useMemo(
    () => (frozenDeck ? frozenDeck.map((sp) => spotsById.get(sp.id) ?? sp) : sorted),
    [frozenDeck, spotsById, sorted],
  );

  // A selection the frozen deck has never heard of. It happens in the seam
  // between a pin tap and the payload that proves the pin: the deck only
  // refreezes once the new anchor is actually in `spots`, so for a render or
  // two the slug is the new pin and the deck is still the old one. Falling
  // through to `previewing === false` there tore the whole dock down and
  // flashed the browse list up in its place — another way "things just
  // disappear". Hold the card that IS in hand until the deck catches up.
  const rawIndex = previewOrder.findIndex((sp) => sp.slug === selectedSlug);
  const lastIndex = useRef(0);
  if (rawIndex >= 0) lastIndex.current = rawIndex;
  const previewIndex = rawIndex >= 0 ? rawIndex : Math.min(lastIndex.current, previewOrder.length - 1);
  const previewing = selectedSlug != null && previewOrder.length > 0 && previewIndex >= 0;

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
  // What the chrome above the sheet covers, measured the same way, so the
  // camera and the ⓘ keep clear of the hour bar as well as the sheet. Folded
  // into the resting height the sheet reports rather than declared as its own
  // inset panel: the slot is pinned to the sheet's top edge and moves with a
  // drag, and a panel measured off its live top would chase the drag exactly
  // the way the sheet itself is careful not to.
  const [slotH, setSlotH] = useState(0);
  const slotRO = useRef<ResizeObserver | null>(null);
  const slotRef = useCallback((el: HTMLDivElement | null) => {
    slotRO.current?.disconnect();
    slotRO.current = null;
    if (!el || typeof ResizeObserver === "undefined") {
      setSlotH(0);
      return;
    }
    setSlotH(Math.round(el.offsetHeight));
    const ro = new ResizeObserver(() => setSlotH(Math.round(el.offsetHeight)));
    ro.observe(el);
    slotRO.current = ro;
  }, []);
  // Click-through gutter with live children, so the map beside the layers
  // button still pans. `bottom-full` keeps it on the sheet's top edge at every
  // detent and through a drag.
  const slot = aboveSheet ? (
    <div
      ref={slotRef}
      className="pointer-events-none absolute inset-x-0 bottom-full px-3 pb-2 [&>*]:pointer-events-auto"
    >
      {aboveSheet}
    </div>
  ) : null;

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

  // ── Where the rail is NOW, vs. what the map has selected ────────────────
  // These are two different clocks and the dock needs both. The map's
  // selection is deliberately debounced — re-selecting on every frame of a
  // fling would fire a camera move per card — but the CARDS have to keep up
  // with the thumb, and they used to be mounted off the debounced one.
  //
  // What that looked like: the mount window is the card in hand ±1, so a slow
  // one-at-a-time swipe always had its next card ready. A real fling doesn't
  // go one at a time. Flicking from card 4 to card 7 put cards 5 and 6 outside
  // a window still centred on 4, and they are width-holding spacers with
  // nothing in them — so the deck ran blank under the thumb for as long as the
  // settle took to fire, measured at 358ms. That is the "things just
  // disappear". The counter lied along with it, still reading "4 of 49" over
  // card 6.
  //
  // So the live index drives what is mounted and what the counter says, and the
  // debounced slug drives only the map. Setting it per scroll event is cheap:
  // it's a bail-out when unchanged, and `SpotCard`'s subscription and
  // favourites reads are both module-scoped stores fetched once per session,
  // not per instance.
  const [railIndex, setRailIndex] = useState(-1);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRailScroll = useCallback(() => {
    const i = centredIndex();
    if (i >= 0) setRailIndex((cur) => (cur === i ? cur : i));
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const j = centredIndex();
      const next = previewOrder[j];
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

  // A fresh dock — and a fresh deck under an existing one — starts wherever
  // the selection says, not where the last one was left. Without this the
  // counter opens on the previous deck's card number for the frame before the
  // first scroll event lands, and the mount window opens around it.
  const previewClosed = selectedSlug == null;
  useEffect(() => {
    setRailIndex(-1);
  }, [deckKey, previewClosed]);

  // Selection changed from the map → bring that card into view. Instant when
  // this deck is new, smooth when moving within the deck already on screen.
  //
  // The two directions are told apart by where the rail already sits, not by a
  // "who moved last" flag: a flag that is set but never consumed (the settle
  // fired, the slug did not change) stays set, and swallows the scroll for the
  // NEXT pin the angler taps. The rail's own position can't go stale.
  //
  // Deck identity, not just "was previewing", decides smooth vs instant.
  // Tapping a second pin while the first is docked rebuilds the deck around
  // the new anchor, which puts the tapped spot back at index 0 — and a smooth
  // scroll there from card 7 of the OLD deck whooshed backwards through seven
  // unrelated cards to arrive. A new deck has nothing to animate from, same as
  // a fresh dock.
  const scrolledDeck = useRef<string | null>(null);
  useEffect(() => {
    if (!previewing) {
      scrolledDeck.current = null;
      return;
    }
    const el = railRef.current;
    const card = el?.children[previewIndex] as HTMLElement | undefined;
    if (!el || !card) return;
    const sameDeck = scrolledDeck.current !== null && scrolledDeck.current === deckKey;
    if (sameDeck && centredIndex() === previewIndex) {
      // Already the card in hand — this is the swipe that set the slug.
      return;
    }
    el.scrollTo({
      left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2,
      behavior: sameDeck ? "smooth" : "auto",
    });
    scrolledDeck.current = deckKey;
  }, [previewing, previewIndex, centredIndex, deckKey]);

  // What the counter and the mount window read: where the rail actually sits,
  // falling back to the selection before the first scroll event of a session.
  const liveIndex = railIndex >= 0 && railIndex < previewOrder.length ? railIndex : previewIndex;

  if (previewing) {
    const spot = previewOrder[previewIndex];
    return (
      <>
        {/* No white base under this dock, unlike the browse sheet below. A
            preview card is a card floating on the map, not a panel attached to
            the bottom edge, so the strip the tab bar floats over stays water.
            Filling it painted a band of panel white across the bottom of the
            screen with nothing in it — the one thing on this surface that did
            not read like a map. */}
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
          {/* No layer chrome here, deliberately. With a card in hand the card
              is the thing, the way a tapped home on Zillow clears the map's
              controls, and the layers keep drawing whatever was chosen. The
              button and the hour bar come back with the browse sheet. */}
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
            <span
              data-rc-preview-count=""
              className="rounded-full bg-rc-ink/70 px-2.5 py-1 font-rc-mono text-[11px] font-semibold text-white backdrop-blur"
            >
              {liveIndex + 1} of {previewOrder.length}
            </span>
          </div>

          {/* One card per spot in view, snapped. Only a window around the card
              in hand actually mounts — 49 of them behind a swipe is a lot of
              card to build for spots nobody has scrolled to. The rest hold
              their width so the snap offsets stay honest.

              The window is ±2 around where the rail IS, not ±1 around what the
              map has selected. Two changes, both needed: the live index keeps
              the mounted set under the thumb during a fling, and the extra card
              either side means a one-card overshoot lands on something already
              painted rather than on a spacer. */}
          <div
            ref={railRef}
            onScroll={onRailScroll}
            // Named, because the fortnight rail docked directly below is also a
            // `snap-x` scroller — "the snapping thing in the dock" matches two
            // elements, and the one a test means is always this one.
            data-rc-preview-rail=""
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-hide px-[7vw] pb-2"
          >
            {previewOrder.map((sp, i) => (
              <div
                key={sp.id}
                className="w-[86vw] shrink-0 snap-center"
              >
                {(Math.abs(i - liveIndex) <= 2 ||
                  Math.abs(i - previewIndex) <= 1) && (
                  <SpotCard
                    spot={sp}
                    tz={tz}
                    onSelect={() => onSelectSpot(sp.slug)}
                    fresh={freshCatches?.spots[sp.id]}
                    reportsLayout="row"
                  />
                )}
              </div>
            ))}
          </div>

          {/* The fortnight, docked between the card and the tab bar. With a
              card in hand the day is what gets changed most, and the browse
              sheet's answer — a picker that covers the card — is the wrong
              trade here. Sized like the nav pill it sits on. */}
          <DatePillRail
            model={previewForecastModel ?? forecastModel}
            selectedIso={selectedIso}
            onSelectDay={onSelectDay}
            signedIn={signedIn}
            onLockedAdDay={onLockedAdDay}
            // The same city this sheet already puts in its own header, so a
            // locked day and the list above it name the same place.
            placeName={locationName ?? undefined}
          />
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
        {...{ [MAP_INSET_ATTR]: "bottom", [MAP_INSET_RESTING_ATTR]: String((collapsed ? COLLAPSED_H : detents.peek) + slotH) }}
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
      {/* The map chrome, on the top edge. Gone at full, where the sheet has
          taken the map, and gone on a short screen (a phone on its side) while
          the sheet is open: peek plus the tab bar already cover a landscape
          phone to the top row, and the layers button was landing on the
          Search pill. Folding the sheet to its slim bar brings it back, since
          that is the only way to see the map there anyway. */}
      {(collapsed || (vh || 800) >= 600) && !(detent === "full" && !collapsed) && slot}

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
          {/* Sort + the open/close chevron. Both must swallow the pointer so
              a tap doesn't start a sheet drag.

              Sort is hidden at peek. A control for reordering a list you
              cannot see is noise, and it was competing for the tap that
              should be opening the list. It returns the moment the list is
              on screen, which is the moment it means anything. It is the same
              8x8 box as the chevron, so hiding it never moves the row and the
              measured peek stays put. */}
          <div
            className="flex items-center gap-1.5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {spots.length > 1 && open && (
              <SortControl sort={sort} onSort={setSort} />
            )}
            {/* The arrow points where it takes you. It used to point down and
                collapse from every state, so at peek the only arrow on screen
                argued against the one thing worth doing, next to a count of
                spots that were all hidden. */}
            <button
              type="button"
              onClick={() => {
                if (!open) {
                  setDetent("half");
                  return;
                }
                // Park at peek on the way down, so reopening from the slim
                // bar lands on peek every time. Without the reset it restored
                // whatever detent you collapsed FROM, which skipped peek —
                // and peek is now the state that shows the fortnight and the
                // sliver, so skipping it skips the whole orientation.
                setCollapsed(true);
                setDetent("peek");
              }}
              aria-label={open ? "Collapse spot list" : "Show spot list"}
              aria-expanded={open}
              className="flex h-8 w-8 items-center justify-center rounded-md text-rc-ink-mute transition-colors hover:bg-rc-surface"
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* The fortnight itself, in the header, the same rail the preview dock
            carries. It replaces a date caption beside a "Change date" button
            that opened the ledger in a sheet over this one.

            Two surfaces asking the same question should not answer it two
            ways, and the caption was the weaker half anyway: it said which day
            the list is ranked for without saying whether any other day is
            better, which is the only reason to change it. The rail says both,
            and picking a day re-ranks the list underneath in place instead of
            covering it.

            Stops pointer events so scrolling the days doesn't drag the sheet
            (this block sits inside the drag handle). */}
        <div
          className="mt-2.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DatePillRail
            variant="inline"
            model={forecastModel}
            selectedIso={selectedIso}
            onSelectDay={onSelectDay}
            signedIn={signedIn}
            onLockedAdDay={onLockedAdDay}
            // The same city this sheet already puts in its own header, so a
            // locked day and the list above it name the same place.
            placeName={locationName ?? undefined}
          />
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
                    reportsLayout="row"
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
          At peek this is the fold itself: it is what turns the cut card into
          "keep pulling" rather than a card that failed to render. It used to
          be suppressed here, back when peek ended on the header's own bottom
          edge and there was no card under it to fade. */}
      {!collapsed && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-rc-panel to-transparent"
        />
      )}
      </div>

    </>
  );
}
