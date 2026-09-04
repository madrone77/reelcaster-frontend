"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import type { MapRef } from "react-map-gl/maplibre";
import type { MapSpotsPayload } from "@/lib/bluecaster";
import {
  cityIndexFromLocations,
  extraRailSpotsFromPayload,
  railSpotsFromPayload,
  speciesOptionsFromPayload,
  zonedHourToUtcIso,
  type CityNode,
  type ExploreData,
  type RailSpot,
  type SpeciesOption,
} from "./lib/explore-data";
import {
  ANON_STRIP_DAYS,
  buildViewportForecastDays,
  type ForecastDay,
  DESKTOP_STRIP_H,
  buildSpotStripFromOutlook,
  type ForecastStripModel,
  type ForecastTier,
} from "./lib/forecast-strip";
import { boundsOf, paddedBbox, SPOT_LINK_ZOOM } from "./lib/viewport-bbox";
import { useMountedOnce } from "@/hooks/use-mounted-once";
import { useUpgradeNag } from "@/hooks/use-upgrade-nag";
import { noteEngagement } from "@/lib/upgrade-nag";
import { clearPaywallContext, setPaywallContext } from "@/lib/paywall-context";
import {
  depthLocked as isDepthLocked,
  stampPreviewGrant,
  writePreviewCookie,
  PREVIEW_GATE_ENABLED,
  type PreviewState,
} from "@/lib/preview-gate";
import DepthGatePrompt from "./components/depth-gate-prompt";
import {
  fetchFreshCatches,
  fetchMapForecast14d,
  fetchMapSpotsAsViewer,
  fetchMapSpotsCached,
  fetchMyCustomSpots,
  fetchSpotCoords,
  fetchSpotsOutlook14d,
} from "@/lib/bluecaster-client";
import type {
  MapForecast14dPayload,
  SpotOutlookDayPeak,
} from "@/lib/bluecaster";
import type { FreshCatchesResponse } from "./lib/fresh-catch-types";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/contexts/auth-context";
import { useExploreState } from "./lib/use-explore-state";
import { useFlowLayer } from "./lib/use-flow";
import { readExploreView, writeExploreView, type ExploreView } from "./lib/view-memory";
import {
  MAP_INSET_ATTR,
  mapInsetOffsetY,
  mapVisibleBand,
  sheetSafeCenter,
} from "./lib/sheet-safe-center";
import ExploreTopBar from "./components/explore-top-bar";
import {
  cameFromLandingPage,
  useCampaignHit,
  type CampaignTarget,
} from "@/app/lp/_shared/lp-telemetry";
import { viaAngle } from "@/app/lp/_shared/lp-via";
import type { AdWall } from "@/lib/ad-mode";
import { BLEED_MEASURE } from "@/app/components/layout/page-measure";
import ExploreMap, { type StationPick, type CustomSpotPin } from "./components/explore-map";

import { setFavorite, useSavedSpots } from "./lib/use-favorite";
import type { ScoreFloor } from "./components/mobile-filter-sheet";
import { X } from "lucide-react";
import LeftRail from "./components/left-rail";
import LocationSelector from "./components/location-selector";
import MobileMapSheet from "./components/mobile-map-sheet";
import MobileTopRow from "./components/mobile-top-row";
import MobileLayersControl from "./components/mobile-layers-control";
import MobileHourBar from "./components/mobile-hour-bar";
import type { FlowKind } from "./lib/use-flow";
import ForecastStrip from "./components/forecast-strip";
import { legacySpotPath, spotHref } from "@/lib/paths";
import { withAdParams } from "@/lib/ad-mode";
import { AdFrameProvider } from "./lib/ad-frame";

// ── Loaded on demand ─────────────────────────────────────────────────────
//
// Everything below opens behind a tap: a pin drop, a station click, the
// filter button, "create alert", an upgrade prompt. Statically imported they
// were in the chunks /explore has to fetch and parse before it can hydrate —
// and `ProTrialModal` drags Stripe in behind it, so a map that never sells
// anything was paying for a checkout form on every load.
//
// `ssr: false` is free here: ExploreShell is a client component and each of
// these renders nothing until its state flips, so the server markup they
// contribute today is already empty.
const CreateCustomSpotDialog = dynamic(
  () => import("./components/create-custom-spot-dialog"),
  { ssr: false },
);
const StationDrawer = dynamic(() => import("./components/station-drawer"), {
  ssr: false,
});
const MobileFilterSheet = dynamic(
  () => import("./components/mobile-filter-sheet"),
  { ssr: false },
);
const CreateAlertDialog = dynamic(
  () => import("./spot/components/create-alert-dialog"),
  { ssr: false },
);
const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

const MAP_TZ = "America/Vancouver";

/**
 * Shape + vertical rhythm shared by the two pills that float over the map's top
 * band: the "Create custom spot" action and the placement banner that replaces
 * it. Keeping them on one line means arming pin-drop mode swaps the chrome in
 * place instead of jumping it.
 *
 * `top` is the whole point of the constant. Mobile floats the location header
 * (Filters button included) over the map's own top edge, so anything pinned
 * near `top-0` lands on it and `top-16` clears it. Both are measured from the
 * map box, which is the element that moves when the top bar comes and goes, so
 * this offset holds at every tier. Desktop has no header there and instead has the left rail at
 * viewport `top-[72px]` — the map box starts at `top-16`, so `lg:top-2` puts
 * these on the rail's top edge, and `right-6` on the button mirrors the rail's
 * `left-6` gutter.
 *
 * Callers own horizontal placement and colour.
 */
const MAP_ACTION_PILL =
  // top-16 on mobile clears the floating location pill (which starts 8px below
  // the map's top edge and stands ~44px tall).
  "absolute z-20 top-16 lg:top-2 flex items-center rounded-full " +
  "text-white text-[13px] lg:text-sm font-semibold px-3 lg:px-4 py-1.5 lg:py-2";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// `paddedBbox` and `boundsOf` moved to ./lib/viewport-bbox so the server can
// compute the opening box with the same arithmetic and prefetch its strip.

export default function ExploreShell({
  data,
  bbox,
  initialCitySlug,
  initialSpot,
  initialZoomOverride = null,
  initialForecast,
  initialForecastBbox,
  marketing = false,
  initialPreview = null,
  ad = null,
  via = null,
}: {
  data: ExploreData;
  bbox: string;
  /**
   * The city the server actually framed: `?loc` when it named a covered city,
   * the default city otherwise. `data.spots` and `initialForecast` are both
   * about this city, so it is the only honest way to tell whether the first
   * response is about the water this URL is asking for.
   */
  initialCitySlug?: string | null;
  /**
   * The spot a `?spot` link named, resolved to coordinates by the page.
   *
   * Present only when the slug resolved to a published spot, so its presence is
   * the signal that the server framed this spot: `data.spots` covers a box
   * around it and the camera should open on it rather than on a city.
   */
  initialSpot?: { slug: string; lat: number; lng: number } | null;
  /** Opening zoom from `?z`. Loses to a restored view and to a
   *  server-framed spot, so only a cold arrival is framed by it. */
  initialZoomOverride?: number | null;
  /**
   * The 14-day viewport strip for `initialForecastBbox`, fetched by the page so
   * the strip can paint from the first response instead of waiting out the JS
   * bundle. Anonymous-horizon only — see the prefetch comment in page.tsx.
   */
  initialForecast?: MapForecast14dPayload | null;
  /** The box `initialForecast` covers; matches the shell's own mount-time seed. */
  initialForecastBbox?: string | null;
  /**
   * Set when this render is the destination of a paid ad (`?ad=<wall>`).
   *
   * Null is the product, and every branch below is `ad && …` or `!ad && …`,
   * so the map renders exactly what it rendered before this prop existed. Same
   * split rule the spot page's ad frame uses.
   */
  ad?: { wall: AdWall; angle: string } | null;
  /**
   * The landing page that sent this visit, from the `via` stamp on its
   * button. Null when no page stamped it. Only ever reaches the counter.
   */
  via?: string | null;
  /**
   * True on /m/explore — the paid-marketing frame. The only surface that asks
   * the depth-gate question; /explore renders the answer but never poses it.
   */
  marketing?: boolean;
  /**
   * The preview cookie as the server read it, so a visitor who declined never
   * watches the depth map paint and then vanish. Null is no grant, which is the
   * generous reading — see @/lib/preview-gate.
   */
  initialPreview?: PreviewState | null;
}) {
  const mapRef = useRef<MapRef>(null);
  const router = useRouter();
  const { isPaid, loading: tierLoading } = useSubscription();
  const { user } = useAuth();

  // ── The depth gate ───────────────────────────────────────────────────────
  //
  // Seeded from the server's cookie read so the first paint is already right.
  // `isDepthLocked` folds in the one rule that outranks everything: signing in
  // brings depth back, immediately and on both routes, because a free account
  // is the advertised way out of this.
  const [preview, setPreview] = useState<PreviewState | null>(initialPreview);
  const depthLocked = isDepthLocked({ state: preview, signedIn: !!user });
  // Key data fetches on the id, not the object: `useAuth` hands back a fresh
  // `user` on every onAuthStateChange (including token refresh), so an effect
  // depending on the object refetches the same URL for no reason.
  const userId = user?.id ?? null;
  // `tierLoading` matters: before it clears, `isPaid` is still its initial
  // `false`, so a Pro account would render as "free" and lock days 8–14 behind
  // an upgrade CTA. The strip renders the days it is sure of and marks the rest
  // pending until the tier lands — see the `stripModel` memo.
  // A signed-in viewer keeps the tier they paid for, ad link or not: nobody is
  // shown less than their account entitles them to because they clicked their
  // own ad. The wall applies to cold traffic, which is what an ad buys.
  const accessTier: ForecastTier = isPaid
    ? "pro"
    : user
      ? "free"
      : ad
        ? ad.wall === "today"
          ? "today"
          : "anonymous"
        : "anonymous";
  // Where the phone's map starts. A Pro viewer has no top bar, so the map and
  // the floating location pill both begin at the screen edge; everyone else
  // begins under the 64px bar. One value, so the two cannot drift apart, and
  // every pill measured from the map box keeps its offset at either tier.
  // The ad frame's bar is at the TOP of the screen too (Casey's call,
  // 2026-09-04: never at the bottom), so the offset is the same as the
  // product bar's. A FULL REPORT press on a card is a separate thing: it
  // stays on the map and opens the trial modal.
  const [adOfferOpen, setAdOfferOpen] = useState(false);
  const [adOfferSpotName, setAdOfferSpotName] = useState<string | undefined>();
  const adOfferMounted = useMountedOnce(adOfferOpen);
  const onAdFullReport = useCallback((spot: { name: string }) => {
    setAdOfferSpotName(spot.name);
    setAdOfferOpen(true);
  }, []);
  const mobileTop = isPaid ? "top-0" : "top-16";
  const { citySlug, spotSlug, day, stn, setQuery } = useExploreState();

  // ── Return-trip memory ──────────────────────────────────────────────────
  //
  // Read in the first render, not an effect: `initialViewState` is read once
  // by MapLibre at mount, so a camera arriving a tick later would already have
  // lost the race to the default city and its `fitBounds`.
  //
  // Rendering off browser storage is normally a hydration hazard, and this
  // component does server-render — so ONLY the camera comes from here. The
  // camera never reaches the HTML (react-map-gl emits a bare container on the
  // server and builds the map in an effect), which is exactly why it is safe
  // to read early. Everything else the memory holds — the species filter, the
  // layer toggles, the viewport seed, `?spot`/`?day` — does show up in the
  // markup, so it is applied in the mount effect further down, after
  // hydration has matched.
  //
  // A URL that names its own place normally wins: `?loc` is a city pick,
  // `?spot` a spot deep link, `?stn` a station, all of them somebody asking
  // for a specific frame, not for the one they left. A bare /explore, which is
  // what "Back to map" and the nav both point at, restores.
  //
  // The exception is a `fromSpotPage` hand-off, and it exists because the
  // browser's Back button is not "Back to map". Back returns to the history
  // entry this shell was last on, and the restore before it called `setQuery`
  // to keep the URL honest, so that entry reads `/explore?spot=<the previous
  // spot>`. Deferring to it framed the spot the angler had already finished
  // with instead of the pin they just tapped. When the memory was written on
  // the way out to a spot page it is the newer of the two intents, so it wins.
  // The mount effect below then rewrites `?spot` to match.
  const restoredRef = useRef<ExploreView | null | undefined>(undefined);
  if (restoredRef.current === undefined) {
    const remembered = readExploreView();
    restoredRef.current =
      remembered && (remembered.fromSpotPage || !(citySlug || spotSlug || stn))
        ? remembered
        : null;
  }
  const restored = restoredRef.current;
  /** The blob last written, so a handler can amend it without rebuilding it. */
  const savedRef = useRef<ExploreView | null>(restored);

  /**
   * Did the server frame the spot this URL names?
   *
   * The slug comparison is the point: `initialSpot` is only trustworthy if it
   * describes the spot currently in the URL. They come from one request today,
   * but `?spot` also changes under client navigation (a rail click calls
   * `setQuery`), and then the prop is about the spot we just left.
   */
  const serverFramedSpot = !!initialSpot && !!spotSlug && initialSpot.slug === spotSlug;

  /**
   * Is the page's prefetch about the water this URL is going to?
   *
   * This used to be the blunter question "does the URL name a place at all",
   * because the server always prefetched the default city: on `?loc=vancouver-bc`
   * showing Victoria's numbers for a beat before Vancouver's arrived would be a
   * worse first paint than showing none, so the prefetch was thrown away.
   *
   * The server honours `?loc` and `?spot` now, so the common deep links arrive
   * with a prefetch that IS about where they are going, and discarding it would
   * re-introduce exactly the wait this prop was added to remove. What still
   * discards:
   *
   *   - `?stn` — the frame is one station, and the shell flies somewhere the
   *     prefetch does not cover.
   *   - a `?spot` the server could not resolve (unpublished, renamed, invented)
   *     — it fell through to a city frame, which is not where the client is
   *     about to fly.
   *   - a `?loc` the server could not resolve (renamed or hand-edited slug, a
   *     covered city with no published spots yet) — it fell back to the default
   *     city, and so does `selectedCity`, but the two agreeing is not something
   *     this component should assume, so it refetches rather than guess.
   *   - no `initialCitySlug` at all — an older cached document from before the
   *     prop existed, or a payload the page could not resolve a city for.
   *
   * A spot frame's box is a guess at the viewport (see `spotViewBox`), so its
   * key will not match the one the camera eventually mints. It still seeds: the
   * strip paints from it now and is replaced by the tier-correct payload when
   * the map reports, which is the same two-stage life a city frame has.
   */
  const prefetchIsOurWater =
    !stn &&
    (serverFramedSpot ||
      (!spotSlug &&
        !!initialCitySlug &&
        (!citySlug || citySlug === initialCitySlug)));

  // ── Custom spots (Pro): a "Create custom spot" button arms pin-drop mode;
  //    the next map click opens a modal to name it + pick species. The user's
  //    own custom spots render as distinct markers (fetched on sign-in, plus
  //    an optimistic add on create so a new pin shows immediately). ──────────
  const [customMode, setCustomMode] = useState(false);
  // Deep-link into create mode from the dashboard's "New spot" button
  // (/explore?create=1). Arms once, only for Pro (the create action is Pro-only).
  const searchParams = useSearchParams();
  const armedFromUrl = useRef(false);
  useEffect(() => {
    if (armedFromUrl.current) return;
    if (searchParams.get("create") === "1" && isPaid) {
      armedFromUrl.current = true;
      setCustomMode(true);
    }
  }, [searchParams, isPaid]);
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const customModalMounted = useMountedOnce(customModalOpen);
  // The wall behind the same button for everyone else. The action is on the map
  // whatever your tier — hiding it meant the one feature that answers "my spot
  // isn't on here" was invisible to exactly the people asking.
  const [customUpgradeOpen, setCustomUpgradeOpen] = useState(false);
  const customUpgradeMounted = useMountedOnce(customUpgradeOpen);
  const handleCreateCustomSpot = useCallback(() => {
    if (isPaid) setCustomMode(true);
    else setCustomUpgradeOpen(true);
  }, [isPaid]);
  const [customSpots, setCustomSpots] = useState<CustomSpotPin[]>([]);

  useEffect(() => {
    if (!userId) {
      setCustomSpots([]);
      return;
    }
    let cancelled = false;
    fetchMyCustomSpots()
      .then((rows) => {
        if (cancelled) return;
        setCustomSpots(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            visibility: r.visibility,
            slug: r.slug,
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleMapPick = useCallback((c: { lat: number; lng: number }) => {
    setPinCoords(c);
    setCustomMode(false);
    setCustomModalOpen(true);
  }, []);

  // Mobile (<lg) map-filter sheet (species + layer toggles + near-me),
  // opened by the location header's filter button.
  const [filterOpen, setFilterOpen] = useState(false);
  const filterSheetMounted = useMountedOnce(filterOpen);

  // ── Map-layer toggles + species filter (MapControls) ────────────────
  const [relief, setRelief] = useState(true);
  /** Shows the single "depth is part of a Member account" line, once, on the way
   *  down. A jump cut reads as the map breaking; a sentence reads as a choice. */
  const [depthNarrated, setDepthNarrated] = useState(false);
  // Labels are always on. They were a toggle in the phone filter sheet and
  // nowhere else, which made them a setting one surface could turn off and no
  // other surface could turn back on. A saved view that still carries
  // `labels: false` is ignored for the same reason.
  const labels = true;
  // Currents and Wind share one piece of state, so only ever one of them draws.
  const { flow, currents, wind, toggleCurrents, toggleWind, setFlow } = useFlowLayer();
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);

  // ── Map filters (the phone filter sheet) ────────────────────────────
  // Deliberately NOT part of the saved view. Layers and species persist
  // because they describe how you like to read the map; a score floor
  // describes one search. Restoring it a week later would open Explore on an
  // empty map with nothing on screen explaining why.
  const [scoreFloor, setScoreFloor] = useState<ScoreFloor>(0);
  const [reportsOnly, setReportsOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const { slugs: savedSlugs } = useSavedSpots();
  const savedSet = useMemo(() => new Set(savedSlugs), [savedSlugs]);
  // Label fallback for a species pinned from search that no in-view spot
  // carries, so the strip header can still name it.
  const [pickedSpeciesName, setPickedSpeciesName] = useState<string | null>(null);

  // ── Viewport tracking: the map viewport is the source of truth for which
  //    spots the rail/list/strip reflect. `viewBounds` updates on every
  //    moveend (client-side spot filter); `vpBbox` is the same box padded
  //    20% and rounded, debounced, and drives the strip's forecast fetch. ──
  //    On a return trip the mount effect seeds all of these from the
  //    remembered frame, so the rail, the pill label and the strip open on the
  //    water the angler left rather than on the default city's spots for the
  //    second or two before MapLibre reports.
  const [viewBounds, setViewBounds] = useState<{ w: number; s: number; e: number; n: number } | null>(null);
  const [viewCenter, setViewCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [viewZoom, setViewZoom] = useState<number | null>(null);
  // Seeded in the initial state, not an effect: on a cold load the server has
  // already told us which box it prefetched, and on a return trip the
  // remembered frame is readable in the first render. Either way the strip's
  // fetch key exists before the first effect runs, so nothing waits a tick for
  // it. The mount effect below still covers the case where neither applies.
  const [vpBbox, setVpBbox] = useState<string | null>(
    restored?.bounds
      ? paddedBbox(restored.bounds)
      : prefetchIsOurWater
        ? initialForecastBbox ?? null
        : null,
  );
  const vpTimerRef = useRef<number | null>(null);
  const vpReported = useRef(false);

  const handleViewportChange = useCallback(
    (b: { w: number; s: number; e: number; n: number }, c: { lat: number; lng: number }) => {
      vpReported.current = true;
      setViewBounds(b);
      setViewCenter(c);
      const z = mapRef.current?.getZoom();
      if (typeof z === "number") setViewZoom(z);
      if (vpTimerRef.current) window.clearTimeout(vpTimerRef.current);
      vpTimerRef.current = window.setTimeout(() => setVpBbox(paddedBbox(b)), 300);
    },
    [],
  );

  const today = data.date;
  const selectedIso = day ?? today;

  // ── Fresh catch reports: scraped intel per spot, joined onto the rail by
  //    spot id. Date-independent (keyed on the spot, not the scrubber day), so
  //    this fetches once and is reused across date and hour changes. The Pro
  //    gate lives in the route — a free caller gets `{ locked: true }` per spot
  //    and no numbers ever reach the browser. ───────────────────────────────
  const [freshCatches, setFreshCatches] = useState<FreshCatchesResponse | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    fetchFreshCatches()
      .then((p) => {
        if (!cancelled && p) setFreshCatches(p);
      })
      .catch(() => {
        // Intel is additive — if it fails the rail is still the rail.
      });
    return () => {
      cancelled = true;
    };
    // Re-runs when the session resolves: the first pass often fires before
    // Supabase has rehydrated, which would leave a Pro viewer holding the
    // anonymous (locked) payload for the rest of the visit.
  }, [userId]);

  // ── Spots follow the map ─────────────────────────────────────────────────
  //
  // The page ships the opening city and nothing else. Everywhere the angler
  // pans to is loaded here and kept, so the rail, the pins and the species
  // filter fill in as the map moves and panning back is free.
  //
  // Keyed by DATE as well as box: a payload fetched for Thursday says nothing
  // about Friday's scores, and quietly reusing it would show the wrong numbers
  // on a spot the angler had already visited.
  const cityIndex = useMemo(
    () => cityIndexFromLocations(data.locations),
    [data.locations],
  );
  const [loadedByDate, setLoadedByDate] = useState<
    Map<string, Map<string, RailSpot>>
  >(() => new Map());
  const [loadedSpecies, setLoadedSpecies] = useState<SpeciesOption[]>([]);
  /** "bbox|date" already requested — one request per box per date, ever. */
  const spotFetchRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!vpBbox) return;
    // The Set itself never changes identity, so holding it across the cleanup
    // is safe (and is what the cleanup needs) — the lint rule is warning about
    // DOM refs.
    const claimed = spotFetchRef.current;
    const key = `${vpBbox}|${selectedIso}`;
    if (claimed.has(key)) return;
    claimed.add(key);
    const isToday = selectedIso === today;
    let cancelled = false;
    let landed = false;
    fetchMapSpotsCached(vpBbox, selectedIso)
      .then((p) => {
        if (cancelled || !p) return;
        landed = true;
        const rows = railSpotsFromPayload(p, cityIndex, isToday);
        if (rows.length === 0) return;
        setLoadedByDate((prev) => {
          const next = new Map(prev);
          const forDate = new Map(next.get(selectedIso) ?? []);
          for (const row of rows) forDate.set(row.slug, row);
          next.set(selectedIso, forDate);
          return next;
        });
        const opts = speciesOptionsFromPayload(p, rows);
        setLoadedSpecies((prev) => {
          const byId = new Map(prev.map((s) => [s.id, s]));
          for (const o of opts) {
            const seen = byId.get(o.id);
            if (!seen || (o.bestScore ?? -1) > (seen.bestScore ?? -1)) byId.set(o.id, o);
          }
          return [...byId.values()];
        });
      })
      .catch(() => {
        // Let a later pass over the same water try again.
        claimed.delete(key);
      });
    return () => {
      cancelled = true;
      // A request that never landed must not leave its key claimed, or the box
      // it was for would stay empty forever. Strict mode's double-invoke and a
      // fast pan both take this path.
      if (!landed) claimed.delete(key);
    };
  }, [vpBbox, selectedIso, today, cityIndex]);

  /** The loaded set for the date on screen. */
  const loadedSpots = useMemo(
    () => [...(loadedByDate.get(selectedIso)?.values() ?? [])],
    [loadedByDate, selectedIso],
  );

  // Day re-scoring used to live here: a second map/spots fetch for the picked
  // date, overlaid onto the opening set via `rescoreSpots`. The viewport loader
  // above already fetches per (box, date) and its rows win in `effectiveSpots`,
  // so that was a third request for the same URL on every forecast-day tap —
  // one from the loader, one from here, one from the viewer read.
  //
  // What it covered and this does not: spots in the opening payload that are
  // OUTSIDE the current viewport keep today's score on a future date. They are
  // off screen — the rail filters to the viewport — and panning to them loads
  // that box for the selected date, which recolours them on arrival.

  // ── The viewer's own custom spots, as rail spots ────────────────────────
  //
  // data.spots comes from the server render, which is anonymous and therefore
  // published-only. Refetch the same payload WITH the session token — BlueCaster
  // adds this angler's own spots — and keep the extras. Everything downstream
  // (ranking, species filter, pin colour, the drawer) then treats them as
  // ordinary spots, which is what makes the pin clickable at all: selection is
  // slug-keyed off this list.
  // Bumped on create so a brand-new spot appears without a reload — it can't be
  // in a payload fetched before it existed.
  const [ownSpotsRefresh, setOwnSpotsRefresh] = useState(0);
  const [viewerPayload, setViewerPayload] = useState<MapSpotsPayload | null>(null);

  // Only what the request URL actually depends on belongs in these deps.
  // `customSpots` and the `user` object used to be here too, and both change
  // identity after the first render — `customSpots` when its own fetch
  // resolves, `user` on every onAuthStateChange — so this fired three times
  // with a byte-identical URL on every /explore load. `customSpots` only
  // decorates the result, which is derivation, not fetching (see the memo
  // below).
  //
  // Scoped to the VIEWPORT, not to the page's covered-region box. This asks
  // one question — "which spots here are this angler's own?" — and the answer
  // only matters for water on screen, but it used to be asked over the whole
  // of BC, WA and OR: a 685 KB payload, 2.9 s on the wire, re-downloading every
  // published spot the server render had already sent, on every signed-in load.
  // The viewport box answers the same question in a fraction of that, and
  // follows the map, so a custom spot is loaded by the time it is in frame.
  // Cached per box+date, the same way the forecast strip is: following the map
  // means asking repeatedly, and panning back over water already visited should
  // not re-ask. Cleared whenever the answer could have changed underneath —
  // signing in or out, or creating a spot.
  const viewerCacheRef = useRef<Map<string, MapSpotsPayload>>(new Map());
  useEffect(() => {
    viewerCacheRef.current.clear();
  }, [userId, ownSpotsRefresh]);

  const viewerBbox = vpBbox ?? bbox;
  useEffect(() => {
    if (!userId) {
      setViewerPayload(null);
      return;
    }
    const key = `${viewerBbox}|${selectedIso}`;
    const cached = viewerCacheRef.current.get(key);
    if (cached) {
      setViewerPayload(cached);
      return;
    }
    let cancelled = false;
    fetchMapSpotsAsViewer(viewerBbox, selectedIso)
      .then((payload) => {
        if (cancelled || !payload) return;
        if (viewerCacheRef.current.size > 50) viewerCacheRef.current.clear();
        viewerCacheRef.current.set(key, payload);
        setViewerPayload(payload);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, viewerBbox, selectedIso, ownSpotsRefresh]);

  // Everything the viewer-scoped payload carries that the server render didn't:
  // this angler's own custom spots, plus any spot published since the hierarchy
  // the base set was built from was cached. Only the former are flagged
  // `isCustom` — see extraRailSpotsFromPayload.
  //
  // Diffed against the loaded set too, not just the page's opening payload.
  // Now that spots arrive as the map moves, a published spot the angler panned
  // to is already known here; leaving it out of the "known" set would have this
  // re-add it as an extra with borrowed, blank region metadata.
  const knownSpots = useMemo(
    () => (loadedSpots.length === 0 ? data.spots : [...data.spots, ...loadedSpots]),
    [data.spots, loadedSpots],
  );
  const extraRailSpots = useMemo<RailSpot[]>(() => {
    if (!viewerPayload) return [];
    return extraRailSpotsFromPayload(
      knownSpots,
      viewerPayload,
      selectedIso === today,
      new Map(customSpots.map((c) => [c.slug ?? "", c.visibility])),
    );
  }, [viewerPayload, knownSpots, selectedIso, today, customSpots]);

  // Nothing stars spots on sight any more. This is where a spot you'd created
  // on another device used to be re-starred on arrival, because the star lived
  // in localStorage and a second browser had no way to know about it — the same
  // effect that, when it mistook freshly published spots for yours, filled
  // everyone's Saved spots with things they never chose (#259). Favourites are
  // server-side now, so the account already knows; there is nothing to infer.

  const effectiveSpots = useMemo(() => {
    const base = data.spots;
    if (loadedSpots.length === 0 && extraRailSpots.length === 0) return base;
    // Later writers win, cheapest source first: the page's opening payload,
    // then whatever the map has loaded since (fetched for THIS date, so its
    // scores beat a rescore of the opening set), then the angler's own spots.
    const bySlug = new Map(base.map((s) => [s.slug, s]));
    for (const s of loadedSpots) bySlug.set(s.slug, s);
    for (const s of extraRailSpots) bySlug.set(s.slug, s);
    // Sorted together — a custom spot earns its rail position by score.
    return [...bySlug.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [data.spots, loadedSpots, extraRailSpots]);

  // The filter list grows with the map: species carried by the opening payload,
  // plus any the angler has panned into. Scores here are only a seed — the
  // chips re-derive them from what is actually in view (`speciesWithScores`).
  const allSpecies = useMemo<SpeciesOption[]>(() => {
    if (loadedSpecies.length === 0) return data.species;
    const byId = new Map(data.species.map((s) => [s.id, s]));
    for (const s of loadedSpecies) if (!byId.has(s.id)) byId.set(s.id, s);
    return [...byId.values()].sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
  }, [data.species, loadedSpecies]);

  // Species filter: re-score each spot to the chosen species (pins recolor,
  // rail re-ranks, forecast strip keys off it). "Best bet" (null) = unchanged.
  const displaySpots = useMemo(() => {
    if (!speciesFilter) return effectiveSpots;
    const name = allSpecies.find((s) => s.id === speciesFilter)?.name ?? null;
    return effectiveSpots
      .map((s) => {
        const score = s.scoresBySpecies[speciesFilter] ?? null;
        return { ...s, score, bestSpeciesId: speciesFilter, driverSpecies: name };
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [effectiveSpots, speciesFilter, allSpecies]);

  // Belt-and-braces dedupe by slug. buildExploreData now builds RailSpots from
  // the map payload, which carries one entry per spot, so this should be a
  // no-op — it used to walk city memberships and emit a shared spot (Race
  // Rocks ∈ Victoria + Sooke) once per member city. Kept because a duplicate
  // slug reaching the rail trips a React key warning and can drop a card, and
  // the guard costs one pass.
  const uniqueSpots = useMemo(() => {
    const seen = new Set<string>();
    return displaySpots.filter((s) => {
      if (seen.has(s.slug)) return false;
      seen.add(s.slug);
      return true;
    });
  }, [displaySpots]);

  // `initialCitySlug` sits between the two on a `?spot` link: the URL names no
  // city, but the payload is not the default city's either — it is the box
  // around the linked spot, and the spot's own home city is the honest scope for
  // the rail and the location pill. Without this a shared spot link read
  // "Victoria" over a rail of Vancouver water until the map reported.
  const activeCitySlug = citySlug ?? initialCitySlug ?? data.defaultCitySlug;

  const selectedCity = useMemo<CityNode | null>(() => {
    const find = (slug: string | null) => {
      if (!slug) return null;
      for (const prov of data.locations) {
        for (const region of prov.regions) {
          const city = region.cities.find((c) => c.slug === slug);
          if (city) return city;
        }
      }
      return null;
    };
    // An unresolvable `?loc` — a renamed city, a hand-edited URL, a link from
    // before a slug changed — falls back to the default city rather than to no
    // city at all. "No city" opens the map at zoom 4.5, spanning most of the
    // continent, and now that spots load with the viewport that camera asks for
    // every spot in it. A bad slug should land somewhere sensible, not fetch
    // the world.
    return find(activeCitySlug) ?? find(data.defaultCitySlug);
  }, [data.locations, activeCitySlug, data.defaultCitySlug]);

  // The rail (and mobile list) show what the map shows: spots inside the
  // current viewport. Until the map reports its first viewport (SSR, map
  // still booting) fall back to the selected city's spots so the first paint
  // isn't empty.
  const viewportSpots = useMemo(() => {
    if (viewBounds) {
      return uniqueSpots.filter(
        (s) =>
          s.lng >= viewBounds.w &&
          s.lng <= viewBounds.e &&
          s.lat >= viewBounds.s &&
          s.lat <= viewBounds.n,
      );
    }
    if (!selectedCity) return uniqueSpots;
    // Pre-viewport fallback (first paint): the city's spots, deduped — the
    // hierarchy can list a shared spot under several cities.
    const seen = new Set<string>();
    return displaySpots.filter((s) => {
      if (s.citySlug !== selectedCity.slug || seen.has(s.slug)) return false;
      seen.add(s.slug);
      return true;
    });
  }, [displaySpots, uniqueSpots, viewBounds, selectedCity]);

  // ── Map filters ──────────────────────────────────────────────────────
  // Every one of these runs on a RailSpot the shell already holds, so
  // narrowing the map costs no request. The open spot is always kept: a
  // `?spot=` link, or a card you are reading, must not vanish underneath you
  // because a filter you set afterwards excludes it.
  const filtersActive = scoreFloor > 0 || reportsOnly || savedOnly;

  const keepSpot = useCallback(
    (s: RailSpot) => {
      if (s.slug === spotSlug) return true;
      if (scoreFloor > 0 && (s.score ?? -1) < scoreFloor) return false;
      if (reportsOnly && !s.hasReports) return false;
      if (savedOnly && !savedSet.has(s.slug)) return false;
      return true;
    },
    [scoreFloor, reportsOnly, savedOnly, savedSet, spotSlug],
  );

  /** Everything loaded, filtered — what the map draws pins for. */
  const filteredSpots = useMemo(
    () => (filtersActive ? uniqueSpots.filter(keepSpot) : uniqueSpots),
    [uniqueSpots, filtersActive, keepSpot],
  );

  /** In view AND surviving the filters — the rail, the strip, the count. */
  const railSpots = useMemo(
    () => (filtersActive ? viewportSpots.filter(keepSpot) : viewportSpots),
    [viewportSpots, filtersActive, keepSpot],
  );

  // What each switch would leave, given everything else that is on. Shown
  // beside the switch so its cost is visible before it is paid.
  const reportsAvailable = useMemo(
    () =>
      viewportSpots.filter(
        (s) =>
          (scoreFloor === 0 || (s.score ?? -1) >= scoreFloor) &&
          (!savedOnly || savedSet.has(s.slug)) &&
          s.hasReports,
      ).length,
    [viewportSpots, scoreFloor, savedOnly, savedSet],
  );
  const savedAvailable = useMemo(
    () =>
      viewportSpots.filter(
        (s) =>
          (scoreFloor === 0 || (s.score ?? -1) >= scoreFloor) &&
          (!reportsOnly || s.hasReports) &&
          savedSet.has(s.slug),
      ).length,
    [viewportSpots, scoreFloor, reportsOnly, savedSet],
  );

  // Species counts as an active filter here even though it lives in its own
  // row: it is the one that has always narrowed the map, and the badge would
  // read as a lie if picking a species left it at zero.
  const activeFilters =
    (speciesFilter ? 1 : 0) +
    (scoreFloor > 0 ? 1 : 0) +
    (reportsOnly ? 1 : 0) +
    (savedOnly ? 1 : 0);

  const resetFilters = useCallback(() => {
    setSpeciesFilter(null);
    setScoreFloor(0);
    setReportsOnly(false);
    setSavedOnly(false);
  }, []);

  // City the viewport "is" — labels the location pill ("Victoria · South
  // Vancouver Island" → pan → "Vancouver · Lower Mainland") and anchors
  // city-derived toggles while the user roams. Prefer the city owning the
  // most spots in view (a wide frame's centre can sit over open water nearer
  // some other town); fall back to nearest-to-centre when nothing's in view.
  const nearestCity = useMemo<CityNode | null>(() => {
    if (!viewCenter) return null;
    const cityBySlug = new Map<string, CityNode>();
    for (const prov of data.locations)
      for (const region of prov.regions)
        for (const city of region.cities) cityBySlug.set(city.slug, city);

    // Vote over EVERY (city, spot) membership of the in-view spots — the
    // deduped rail keeps one arbitrary copy per spot, and shared spots would
    // skew the vote toward whichever member city's copy happened to survive
    // (Victoria's frame labelling itself "Cowichan").
    const counts = new Map<string, number>();
    if (viewBounds) {
      for (const s of displaySpots) {
        if (
          s.lng >= viewBounds.w &&
          s.lng <= viewBounds.e &&
          s.lat >= viewBounds.s &&
          s.lat <= viewBounds.n
        ) {
          counts.set(s.citySlug, (counts.get(s.citySlug) ?? 0) + 1);
        }
      }
    }
    let topSlug: string | null = null;
    let topCount = 0;
    for (const [slug, n] of counts) {
      if (n > topCount && cityBySlug.has(slug)) {
        topCount = n;
        topSlug = slug;
      }
    }
    if (topSlug) return cityBySlug.get(topSlug) ?? null;

    let best: CityNode | null = null;
    let bestKm = Infinity;
    for (const city of cityBySlug.values()) {
      const km = haversineKm(viewCenter.lat, viewCenter.lng, city.lat, city.lng);
      if (km < bestKm) {
        bestKm = km;
        best = city;
      }
    }
    return best;
  }, [data.locations, viewCenter, viewBounds, displaySpots]);

  const labelCity = nearestCity ?? selectedCity;

  // ── Ad frame bookkeeping ─────────────────────────────────────────────────
  //
  // `target_city` is the city the SERVER framed, not wherever the map has been
  // panned to since: it is the city the ad chose, and it is fixed for the
  // visit. The hit fires once per tab at mount, when the two are the same
  // anyway; taking it from the live camera would make a report about targeting
  // into a report about browsing.
  const adTarget: CampaignTarget | null = ad
    ? {
        landing: "explore",
        target_city: initialCitySlug ?? data.defaultCitySlug ?? "",
        target_spot: "",
        wall: ad.wall,
        angle: ad.angle,
      }
    : null;
  useCampaignHit(adTarget);

  // A SECOND target, for arrivals that carry no ad frame at all.
  //
  // The live CTA on every /lp page points at /explore?loc=<slug>&z=10 with no
  // `?ad=`, so `adTarget` was null on all of them and Explore counted nothing:
  // 128 CTA presses recorded over 29-31 Aug against 0 explore hits. Every
  // landing='explore' row ever written carries wall='today', which is the same
  // fact from the other side -- only ad-framed links were ever counted.
  //
  // Kept separate from `adTarget` on purpose. That value is also what decides
  // whether the paid ad bar renders, and widening it to cover plain arrivals
  // would put the bar in front of organic traffic. This one only ever reaches
  // the counter.
  //
  // wall='' is the discriminator: landing='explore' with a wall is an
  // ad-framed arrival, landing='explore' with an empty wall is someone who
  // walked in off a landing page. `!ad` keeps the two mutually exclusive, so
  // one arrival is never counted in both buckets.
  //
  // Since the buttons open the ad frame, `ad` is set on those arrivals and
  // this target is null; the stamp then rides on `adTarget.angle` instead.
  // Kept for a link without the frame, where the stamp is the better
  // evidence and the referrer is the fallback.
  const lpArrivalTarget: CampaignTarget | null =
    !ad && (via || cameFromLandingPage())
      ? {
          landing: "explore",
          target_city: initialCitySlug ?? data.defaultCitySlug ?? "",
          target_spot: "",
          wall: "",
          angle: via ? viaAngle(via) : "",
        }
      : null;
  useCampaignHit(lpArrivalTarget);

  // A locked day on the ad frame now does what a locked day does everywhere
  // else in the product: it opens the trial modal.
  //
  // It used to be the exception. `onLockedAdDay` was a callback that put the
  // cursor in the pinned bar's email field, and every locked surface checked
  // whether that callback was defined to decide between "one offer down there"
  // and the product's own dialogs. With the bar gone there is no field to
  // focus and no second way to buy, so the exception is gone with it: the
  // prop is simply not passed, which is the same thing it meant off the ad
  // frame all along.

  // Per-species best scores across the spots in view (and for the viewed
  // date) so the filter chips reflect the water the user is looking at.
  const speciesWithScores = useMemo<SpeciesOption[]>(() => {
    const best: Record<string, number> = {};
    // The unfiltered viewport on purpose: this list answers "what is worth
    // chasing in this water", and a score floor must not hide the species it
    // is currently filtering out.
    for (const spot of viewportSpots) {
      for (const [sid, score] of Object.entries(spot.scoresBySpecies)) {
        if (!(sid in best) || score > best[sid]) best[sid] = score;
      }
    }
    return allSpecies
      .map((s) => ({ ...s, bestScore: best[s.id] ?? null }))
      .sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
  }, [viewportSpots, allSpecies]);

  // Jurisdiction auto-switch: the WDFW marine-area grid + MPAs (shipped hidden
  // in the relief style, Canada-first) turn on when the viewport sits in
  // Washington. DFO layers stay on — each grid only covers its own waters.
  const wdfwRegs =
    (labelCity?.provinceCode ?? viewportSpots[0]?.provinceCode) === "WA";

  // Whole 14-day strip hide/show (collapses to a "Show" chip).
  const [stripHidden, setStripHidden] = useState(false);

  // Regional peak hour across the mapped spots — with no hour scrubber, every
  // surface rests at day-peak scores; this hour only anchors the animated
  // currents field to a representative time for the selected day.
  const peakHour = useMemo(() => {
    let best = -1;
    let hr = 12;
    for (const s of railSpots) {
      for (let h = 0; h < 24; h++) {
        const v = s.hours24[h];
        if (typeof v === "number" && v > best) {
          best = v;
          hr = h;
        }
      }
    }
    return best >= 0 ? hr : null;
  }, [railSpots]);

  // The hour scrubbed on the 14-day strip's selected day (or hover-scrubbed on
  // a rail card's mini-chart). null = rest at day-peak. Drives the map-pin
  // recolor, the rail re-rank, and the currents animation.
  const [scrubHour, setScrubHour] = useState<number | null>(null);

  // Reset the scrub to day-peak whenever the selected day changes — a fresh day
  // opens at its peak, not the previous day's hour.
  useEffect(() => {
    setScrubHour(null);
  }, [selectedIso]);

  // Regional best score per hour for the SELECTED day (max across mapped
  // spots). The strip's selected cell expands into a scrub lane over this
  // series; its argmax is the day peak the collapsed cell already shows.
  const selectedDayHours = useMemo(() => {
    const out: (number | null)[] = new Array(24).fill(null);
    for (const s of railSpots) {
      for (let h = 0; h < 24; h++) {
        const v = s.hours24[h];
        if (typeof v === "number" && (out[h] == null || v > (out[h] as number)))
          out[h] = v;
      }
    }
    return out;
  }, [railSpots]);

  // The rail re-scored + re-ranked to the scrubbed hour — each card shows its
  // own hours24[hour] and the list re-sorts by it. At rest (null) it stays the
  // day-peak ranking. The strip's hour detents mean this recomputes once per
  // hour-step, not per pointer frame.
  const railDisplaySpots = useMemo(() => {
    if (scrubHour == null) return railSpots;
    const h = scrubHour;
    return railSpots
      .map((s) => ({
        ...s,
        score: typeof s.hours24[h] === "number" ? (s.hours24[h] as number) : null,
      }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [railSpots, scrubHour]);

  // A UTC instant for the animated currents field — the flow layer
  // re-predicts the tidal field for this time, so picking another day moves
  // the animation with the pins, and hover-scrubbing the drawer's 24h chart
  // plays the flow at the hovered hour (reverting to day-peak on leave).
  const flowHour = scrubHour ?? peakHour;
  const flowTimeIso = useMemo(
    () =>
      flowHour !== null
        ? zonedHourToUtcIso(selectedIso, flowHour, MAP_TZ)
        : null,
    [flowHour, selectedIso],
  );

  // The phone's layers button. Turning the flow field off also lets go of the
  // scrubbed hour: the hour bar is the only control that shows the hour on a
  // phone, and it leaves with the field, so pins held at 4 PM with nothing on
  // screen saying so would read as the wrong scores.
  const handleMobileFlow = useCallback(
    (next: FlowKind | null) => {
      setFlow(next);
      if (next === null) setScrubHour(null);
    },
    [setFlow],
  );

  // The map's bearing, for the compass in the phone's top row. Reported by the
  // map on every rotate frame; kept to whole degrees and only written when the
  // degree changes, so a two-finger turn re-renders this shell once per degree
  // rather than once per frame. The needle cannot show a fraction anyway.
  const [bearing, setBearing] = useState(0);
  const handleBearingChange = useCallback((b: number) => {
    const deg = Math.round(b);
    setBearing((cur) => (cur === deg ? cur : deg));
  }, []);
  const handleResetNorth = useCallback(() => {
    mapRef.current?.getMap().resetNorth({ duration: 300 });
  }, []);

  // Selecting a spot flies the camera, and the drawer opening resizes the map;
  // both report a new viewport, which mints new bbox keys and refetches the
  // spot list. Those fetches take 0.5-2.6s, and while they are in flight the
  // rail's set is being replaced — so a spot that was on screen when it was
  // clicked can briefly be in NEITHER list, and the drawer had nothing to
  // render until the network settled.
  //
  // Measured before this: click to card was 151ms when the spot happened to
  // survive the refetch, and 1481-1814ms when it did not.
  //
  // The clicked spot is in hand at click time, so hold it. `lastSelected` keeps
  // the most recent match and is used only as a fallback, so a fresh payload
  // still wins the moment it lands and the card upgrades in place rather than
  // waiting. Keyed on the slug, so it never answers for a different spot.
  const lastSelected = useRef<RailSpot | null>(null);
  const selectedSpot = useMemo(() => {
    const found =
      railSpots.find((s) => s.slug === spotSlug) ??
      displaySpots.find((s) => s.slug === spotSlug) ??
      null;
    if (found) {
      lastSelected.current = found;
      return found;
    }
    if (spotSlug && lastSelected.current?.slug === spotSlug) {
      return lastSelected.current;
    }
    return null;
  }, [railSpots, displaySpots, spotSlug]);

  // ── Create-alert modal — opened in place from the drawer's "Set alert",
  //    the same score-slider modal the spot page uses. Signed-out anglers hit
  //    the sign-up gate first (parity with the spot page). ────────────────
  const [alertSpot, setAlertSpot] = useState<RailSpot | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertUpgradeOpen, setAlertUpgradeOpen] = useState(false);
  const alertUpgradeMounted = useMountedOnce(alertUpgradeOpen);

  const handleSetAlert = useCallback(
    (spot: RailSpot) => {
      setAlertSpot(spot);
      // Pro-only feature → the full trial modal, not the sign-up gate.
      if (!user) {
        setAlertUpgradeOpen(true);
        return;
      }
      setAlertOpen(true);
    },
    [user],
  );

  // The drawer spot's scored species → modal pills (id + name + slug).
  const alertSpeciesOptions = useMemo(() => {
    if (!alertSpot) return [];
    const scored = new Set(Object.keys(alertSpot.scoresBySpecies));
    return allSpecies
      .filter((s) => scored.has(s.id))
      .map((s) => ({ id: s.id, name: s.name, slug: s.slug }));
  }, [alertSpot, allSpecies]);

  // ── Station/buoy selection (?stn=<chs|noaa|ndbc>:<sid>). The URL only
  //    carries source:sid; the click handler stashes the richer feature
  //    (name, coords) so the drawer header paints instantly. On a deep link
  //    the name arrives with the data fetch instead. ─────────────────────
  const [lastPick, setLastPick] = useState<StationPick | null>(null);

  const selectedStation = useMemo<StationPick | null>(() => {
    if (!stn) return null;
    const idx = stn.indexOf(":");
    if (idx < 1) return null;
    const source = stn.slice(0, idx);
    const sid = stn.slice(idx + 1);
    if ((source !== "chs" && source !== "noaa" && source !== "ndbc") || !sid) {
      return null;
    }
    if (lastPick && lastPick.source === source && lastPick.sid === sid) {
      return lastPick;
    }
    return {
      kind: source === "ndbc" ? "buoy" : "tide",
      source,
      sid,
      name: "",
      lat: 0,
      lng: 0,
    };
  }, [stn, lastPick]);

  // ── Forecast strip: per-day best across the spots in the current viewport
  //    (the new map/forecast-14d endpoint). Cached per bbox — panning back
  //    over familiar water doesn't refetch. ────────────────────────────────
  const fcCacheRef = useRef<Map<string, MapForecast14dPayload>>(new Map());
  const [fcPayload, setFcPayload] = useState<MapForecast14dPayload | null>(null);
  const [fcLoading, setFcLoading] = useState(false);

  // The page's prefetch, held separately from `fcCacheRef` on purpose: it is
  // stripped to the anonymous horizon, so caching it under its bbox would let a
  // Pro viewer score a cache hit and never fetch the days they pay for. It only
  // ever stands in until a tier-correct payload arrives for the same box.
  // Captured once: the prop is fixed for the life of the page, and a ref keeps
  // the fetch effect below from having to take it as a dependency.
  const seedRef = useRef<MapForecast14dPayload | null>(
    initialForecastBbox && initialForecast?.days && prefetchIsOurWater
      ? initialForecast
      : null,
  );
  const seedForecast = seedRef.current;
  const displayForecast = fcPayload ?? seedForecast;
  const onSeed = fcPayload === null && seedForecast !== null;

  useEffect(() => {
    if (!vpBbox) return;
    const cached = fcCacheRef.current.get(vpBbox);
    if (cached) {
      setFcPayload(cached);
      setFcLoading(false);
      return;
    }
    let cancelled = false;
    // A seeded strip is already showing real days, so the skeleton would be a
    // step backwards — the refetch that upgrades it happens underneath.
    setFcLoading(fcCacheRef.current.size === 0 && seedRef.current === null);
    fetchMapForecast14d(vpBbox)
      .then((p) => {
        if (cancelled || !p?.days) return;
        if (fcCacheRef.current.size > 50) fcCacheRef.current.clear();
        fcCacheRef.current.set(vpBbox, p);
        setFcPayload(p);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFcLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vpBbox]);

  // The strip no longer waits for the tier before rendering anything.
  //
  // It used to return null while `tierLoading`, which was the safe answer when
  // the payload could only arrive after hydration anyway — the tier always won
  // that race. With the page prefetching the strip, the payload is now the
  // early one, and blocking on the tier would hand the whole saving back.
  //
  // Instead the two facts are separated. Days inside the anonymous horizon are
  // true for everyone, so they render immediately. Days past it depend on who
  // is asking, so while that is unknown — or known to be more than anonymous
  // while we are still holding the anonymous seed — they render pending rather
  // than locked. Nothing is shown that a later answer would have to retract.
  const pendingFrom =
    !tierLoading && (!onSeed || accessTier === "anonymous")
      ? null
      : ANON_STRIP_DAYS;

  const stripModel: ForecastStripModel | null = useMemo(() => {
    if (!displayForecast) return null;
    return buildViewportForecastDays(
      displayForecast,
      speciesFilter,
      accessTier,
      pendingFrom,
    );
  }, [displayForecast, speciesFilter, accessTier, pendingFrom]);

  // ── The previewed spot's own fortnight ──────────────────────────────────
  //
  // `stripModel` above is a viewport FOLD: each day is the best score across
  // every spot in view. Right for the browse list; wrong under a preview card,
  // where it put "Oak Bay Flats 80" a thumb above a strip reading 87 — a
  // number belonging to a different spot, with nothing on screen saying so.
  //
  // Bulk, lazy, and cached by spot id: one request covers the whole deck the
  // carousel can swipe through, it only fires once a preview is actually
  // opened (the browse list never needs it), and swiping never refetches.
  // Keyed by species AND spot: the same spot's fortnight is a different set of
  // numbers under a filter than without one, so a filtered read must never be
  // served an unfiltered entry.
  const outlookRef = useRef<Map<string, (SpotOutlookDayPeak | null)[]>>(
    new Map(),
  );
  const [outlookVersion, setOutlookVersion] = useState(0);
  const outlookKey = useCallback(
    (spotId: string) => `${speciesFilter ?? "best"}:${spotId}`,
    [speciesFilter],
  );

  useEffect(() => {
    const id = selectedSpot?.id;
    if (!id || outlookRef.current.has(outlookKey(id))) return;
    // Ask for the whole deck, not just this spot: the carousel is ordered by
    // distance from the tapped pin and swiping walks it, so the next card is
    // already known. The route caps the id list itself.
    const ids = railSpots.map((sp) => sp.id);
    if (!ids.includes(id)) ids.unshift(id);
    let cancelled = false;
    // Scoped to the pinned species when there is one, so the strip under a
    // filtered card reads that species rather than whatever outscored it.
    fetchSpotsOutlook14d({ spotIds: ids, speciesId: speciesFilter ?? undefined })
      .then((p) => {
        if (cancelled || !p?.by_spot) return;
        if (outlookRef.current.size > 400) outlookRef.current.clear();
        for (const [spotId, cells] of Object.entries(p.by_spot)) {
          outlookRef.current.set(outlookKey(spotId), cells);
        }
        setOutlookVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedSpot?.id, railSpots, speciesFilter, outlookKey]);

  // The strip the preview dock gets. Same calendar, same locks, same weather
  // as the viewport model — only the numbers are re-pointed at this spot, and
  // the selected day is pinned to the card's own series so the two can never
  // disagree on the day being read. Falls back to the fold while the outlook
  // is still in flight, which keeps the strip's shape steady.
  const previewStripModel: ForecastStripModel | null = useMemo(() => {
    if (!stripModel || !selectedSpot) return stripModel;
    const cells = outlookRef.current.get(outlookKey(selectedSpot.id));
    if (!cells) return stripModel;
    return buildSpotStripFromOutlook(stripModel, cells, {
      speciesFilter,
      // The override pins the selected day to the card's own series so the two
      // can never disagree — but ONLY when no species is pinned. Under a
      // filter the card's score is remapped from `scoresBySpecies`, while
      // `hours24` is left as the BEST-species series, so pinning to it puts
      // the wrong fish's number on the day: a coho card read 86 over a tile
      // reading the day's 89 crab peak, which is the exact contradiction this
      // whole path exists to remove. Filtered, the outlook cell is already
      // scored for the pinned species and is the better authority.
      override: speciesFilter
        ? null
        : { iso: selectedIso, hours: selectedSpot.hours24 },
    });
    // outlookVersion is the signal that `outlookRef` gained this spot's cells.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripModel, selectedSpot, speciesFilter, selectedIso, outlookVersion, outlookKey]);

  // Viewport centre, handed to search purely as a tie-break between equally
  // good text matches. Search stays global — this never hides a distant hit.
  const searchNear = useMemo(
    () =>
      viewBounds
        ? {
            lat: (viewBounds.s + viewBounds.n) / 2,
            lng: (viewBounds.w + viewBounds.e) / 2,
          }
        : undefined,
    [viewBounds],
  );

  // Strip header label: the pinned species, else the cross-species best fold.
  const stripSpeciesName = speciesFilter
    ? allSpecies.find((s) => s.id === speciesFilter)?.name ??
      pickedSpeciesName
    : "Best species";

  // Frame the picked city's spots when the selection changes (search pick,
  // Near me, ?loc deep link). Panning afterwards never re-triggers this —
  // the viewport stays wherever the user takes it.
  //
  // On a restored view the mount pass is skipped: `selectedCity` is the
  // default city (a bare /explore carries no `?loc`), so letting this run
  // would fit Victoria's spots right over the frame we just restored. Later
  // city picks still fit, because by then the skip is spent.
  //
  // A server-framed `?spot` skips it for the same reason and more sharply. The
  // camera opens tight on the spot, and `activeCitySlug` now resolves to that
  // spot's city, so without the skip this effect would immediately fit the
  // whole city over it — zooming out from the one piece of water the link was
  // about. That is the failure shipping the spots would otherwise have caused:
  // before, the fit was harmless because the city had no spots loaded to fit to.
  const skipInitialFit = useRef(restored !== null || serverFramedSpot);
  useEffect(() => {
    if (skipInitialFit.current) {
      skipInitialFit.current = false;
      return;
    }
    const citySpots = selectedCity
      ? displaySpots.filter((s) => s.citySlug === selectedCity.slug)
      : displaySpots;
    const bounds = boundsOf(citySpots);
    if (!bounds) {
      // Spots load with the viewport now, so picking a city we have never
      // looked at gives us nothing to frame. Its centre is in the location
      // tree regardless, so fly there and let the move load the spots. Without
      // this the camera would sit still, and a camera that never moves never
      // asks for the spots that would have let it move.
      if (selectedCity) {
        mapRef.current?.flyTo({
          center: [selectedCity.lng, selectedCity.lat],
          zoom: 10,
          duration: 800,
        });
      }
      return;
    }
    const desktop = typeof window !== "undefined" && window.innerWidth >= 1024;
    mapRef.current?.fitBounds(bounds, {
      padding: desktop
        ? { left: 460, top: 40, right: 80, bottom: 200 }
        : { left: 24, top: 24, right: 24, bottom: 24 },
      maxZoom: 12,
      duration: 800,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity?.slug]);

  // A `?spot=` deep link can name a spot in water this session has not loaded
  // — an "open in map" from a spot page, or a search hit two cities away. Ask
  // for its coordinates alone (a few bytes, no scores) and fly there; the move
  // pulls in the spots, and the ordinary slug-keyed selection below then finds
  // it. Runs once per slug, and only when the spot really is missing.
  //
  // On a hand-off restore the slug this history entry still carries is the
  // PREVIOUS spot, and the mount effect is about to replace it. Count it as
  // already flown so it can't pull the camera off the restored frame in the
  // tick before that happens.
  const flownToSpot = useRef<string | null>(
    restored?.fromSpotPage && spotSlug && restored.spot !== spotSlug
      ? spotSlug
      : null,
  );
  useEffect(() => {
    if (!spotSlug || flownToSpot.current === spotSlug) return;
    if (effectiveSpots.some((s) => s.slug === spotSlug)) {
      flownToSpot.current = spotSlug;
      return;
    }
    let cancelled = false;
    flownToSpot.current = spotSlug;
    fetchSpotCoords([spotSlug])
      .then((coords) => {
        const hit = coords[0];
        if (cancelled || !hit) return;
        mapRef.current?.flyTo({
          center: [hit.lng, hit.lat],
          zoom: 12,
          duration: 800,
        });
      })
      .catch(() => {
        flownToSpot.current = null;
      });
    return () => {
      cancelled = true;
    };
    // `effectiveSpots` is read, not tracked: it changes on every load, and this
    // only ever needs the answer at the moment the slug appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotSlug]);

  // Seed the strip's bbox from those same bounds, immediately, instead of
  // waiting for the map to report one.
  //
  // The map's first viewport comes from MapLibre's `load`, which blocks on the
  // relief-tile CDN, and then moves again when the `fitBounds` above finishes
  // animating. Measured on prod: the forecast request started somewhere between
  // 0.9s and 1.9s and a second one fired around 5s when the camera finally
  // settled — so the strip could be empty for several seconds on a page whose
  // spot rail had rendered long before.
  //
  // Nothing about that wait was necessary. `boundsOf(citySpots)` is exactly
  // what the map is about to fit to, and it is known from `data.spots` at
  // mount. Seeding from it starts the fetch in the first frame and shows the
  // right area, not a wider stand-in — and because both paths now round to the
  // same 2dp key, the map's own report usually lands on the cached payload
  // rather than refetching it.
  // Already seeded when a remembered view brought its own bounds, or when the
  // server handed us the box it prefetched.
  const vpSeeded = useRef(
    restored?.bounds != null || (prefetchIsOurWater && initialForecastBbox != null),
  );
  useEffect(() => {
    if (vpSeeded.current || vpReported.current) return;
    const citySpots = selectedCity
      ? displaySpots.filter((s) => s.citySlug === selectedCity.slug)
      : displaySpots;
    const bounds = boundsOf(citySpots);
    vpSeeded.current = true;
    setVpBbox((prev) =>
      prev ??
      (bounds
        ? paddedBbox({ w: bounds[0][0], s: bounds[0][1], e: bounds[1][0], n: bounds[1][1] })
        : // No spots to frame (empty viewport / failed payload): the
          // server-rendered bbox still beats rendering nothing.
          bbox),
    );
  }, [displaySpots, selectedCity, bbox]);

  // The map is a single instance whose container flips between an in-flow
  // block (<lg) and a full-screen absolute pane (lg+). trackResize handles
  // size changes, but the positioning-scheme swap on a live breakpoint cross
  // needs one nudge so tiles don't stay blank.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width:1024px)");
    const onChange = () =>
      requestAnimationFrame(() => mapRef.current?.getMap()?.resize());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const handleSelectCity = useCallback(
    (city: CityNode) => {
      setQuery({ loc: city.slug, spot: null });
    },
    [setQuery],
  );

  /**
   * Point the return-trip memory at a spot, on the way out to its page.
   *
   * Amends the last settled blob where there is one, and builds a whole one
   * where there isn't. The first viewport report comes from MapLibre's `load`,
   * which waits on the relief-tile CDN, so an angler who taps a card in the
   * first second or two gets here before anything has been remembered. Bailing
   * out then, as this used to, left the return trip with no memory at all and
   * sent the map home to the default city.
   */
  const writeSpotHandoff = useCallback(
    (spot: { slug: string; lat: number; lng: number }) => {
      const base = savedRef.current;
      const zoom = Math.max(base?.zoom ?? mapRef.current?.getZoom() ?? 0, 11);
      // Aim at the middle of the water the angler can see rather than the middle
      // of the map pane, which the location header and the spot sheet push down
      // out of. Measured here, where both panels are on screen, because the
      // return trip has to open already framed and cannot pan after the fact.
      const center = sheetSafeCenter(spot.lat, spot.lng, zoom, mapInsetOffsetY());
      writeExploreView({
        species: speciesFilter,
        relief,
        labels,
        currents,
        wind,
        day,
        ...base,
        lat: center.lat,
        lng: center.lng,
        zoom,
        // Recentring invalidates them; the map reports real ones on load.
        bounds: null,
        spot: spot.slug,
        fromSpotPage: true,
      });
    },
    [speciesFilter, relief, labels, currents, wind, day],
  );

  /**
   * A tap on a MAP PIN. Desktop opens the rail drawer; mobile opens the
   * preview card docked in the sheet — it does NOT navigate.
   *
   * It used to route straight to `/explore/spot/<slug>`, which meant the only
   * way to find out what a pin was worth was to leave the map, and the only
   * way back was the back button. Comparing two pins cost four navigations.
   * Selection is a URL param either way, so the card paints from the spot
   * already in hand (see `selectedSpot`) with nothing to wait for.
   */
  const focusSpotOnMap = useCallback(
    (slug: string) => {
      setQuery({ spot: slug, stn: null });
      const spot = displaySpots.find((s) => s.slug === slug);
      if (!spot) return;
      const map = mapRef.current;
      if (!map) return;
      // Desktop's flyTo zooms in on the pick. Mobile keeps the zoom it has:
      // the preview card is a browsing surface, and pulling the camera in a
      // notch on every pin tap walks the viewport away from the water the
      // angler was reading.
      const phone = !window.matchMedia("(min-width:1024px)").matches;
      if (!phone) {
        map.flyTo({
          center: [spot.lng, spot.lat],
          zoom: Math.max(map.getZoom() ?? 9, 11),
          duration: 700,
        });
        return;
      }
      // ── Frame the pin in the water, not in the pane ──────────────────────
      // A bare `center` puts the pin in the geometric middle of the map pane,
      // and on a phone the bottom ~270px of that pane is the preview dock. So
      // tapping a pin dropped it from wherever it was down to 39px above the
      // card that had just appeared over it — the "jump". `sheetSafeCenter`
      // already existed for exactly this and was only wired into the remembered
      // view, never into the tap.
      //
      // Measured after the dock has mounted, not before: the inset at tap time
      // is the browse sheet's peek, and the sheet is about to be replaced by a
      // dock four times its height. Two frames is the cheapest way to ask the
      // question after the answer exists, and it is invisible against a 450ms
      // flight.
      const zoom = map.getZoom() ?? 9;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const c = sheetSafeCenter(spot.lat, spot.lng, zoom, mapInsetOffsetY());
          map.flyTo({ center: [c.lng, c.lat], zoom, duration: 450 });
        }),
      );
    },
    [setQuery, displaySpots],
  );

  /**
   * The preview carousel was swiped onto a different card. Same selection
   * change as a pin tap, but deliberately NOT the same camera move.
   *
   * Flying on every settle meant the map lurched once per card: four swipes,
   * four 450ms flights, and the water under the deck never stopped moving
   * while the angler was reading it. Most of those flights were also pointless
   * — the next spot along is usually the next pin over, already on screen and
   * already clear of the dock. So the camera only moves when the card in hand
   * is genuinely somewhere you can't see: off the pane, or down behind the
   * card. When it does move it eases rather than flies, because this is
   * following a gesture, not answering a tap.
   */
  const followPreviewSlug = useCallback(
    (slug: string) => {
      setQuery({ spot: slug, stn: null });
      const spot = displaySpots.find((s) => s.slug === slug);
      const map = mapRef.current;
      if (!spot || !map) return;
      if (window.matchMedia("(min-width:1024px)").matches) return;

      const band = mapVisibleBand();
      const canvas = map.getCanvas().getBoundingClientRect();
      const p = map.project([spot.lng, spot.lat]);
      const x = p.x + canvas.left;
      const y = p.y + canvas.top;
      // A margin so a pin technically inside the band but hard against an edge
      // still gets re-centred — a puck half under the card reads as hidden.
      const M = 48;
      const visible =
        band != null &&
        y > band.top + M &&
        y < band.bottom - M &&
        x > canvas.left + M &&
        x < canvas.right - M;
      if (visible) return;

      const zoom = map.getZoom() ?? 9;
      const c = sheetSafeCenter(spot.lat, spot.lng, zoom, mapInsetOffsetY());
      map.easeTo({ center: [c.lng, c.lat], zoom, duration: 320 });
    },
    [setQuery, displaySpots],
  );

  /**
   * Which spot the mobile preview carousel measures distance from — the pin
   * the angler actually tapped, held still while they swipe.
   *
   * Only a MAP tap sets it. If swiping re-anchored, the deck would re-sort
   * around whatever card you had just landed on: the card in hand would always
   * be "1 of n", and swiping back would walk a different list than the one you
   * came down. The anchor is the question ("what else is near THIS?"), and the
   * question can't move every time you look at an answer.
   */
  const [previewAnchor, setPreviewAnchor] = useState<string | null>(null);

  const handleMapSelectSpot = useCallback(
    (slug: string) => {
      noteEngagement("browse", "spot_preview");
      setPaywallContext({ spotSlug: slug, page: "explore" });
      setPreviewAnchor(slug);
      focusSpotOnMap(slug);
    },
    [focusSpotOnMap],
  );

  /**
   * A preview session can open without a pin tap — a `?spot=` deep link, or
   * the return trip from a spot page, which restores the selection out of the
   * URL. Seed the anchor from whatever opened the session, ONCE, so those
   * sessions get the same held-still anchor a pin tap gets.
   *
   * This used to be an inline `previewAnchor ?? selectedSpot.slug` fallback at
   * the call site, which is a different thing: with no pin tap to set
   * `previewAnchor`, the anchor was simply the current selection, and the
   * current selection is what swiping changes. So the deck re-sorted around
   * the card just landed on — every swipe put the card in hand back at "1 of
   * n", and the neighbours either side changed under the gesture.
   */
  useEffect(() => {
    if (!spotSlug) return;
    setPreviewAnchor((cur) => cur ?? spotSlug);
  }, [spotSlug]);

  const handleSelectSpot = useCallback(
    (slug: string) => {
      // Counted before the mobile branch below navigates away: the count lives
      // in sessionStorage precisely so the click that leaves /explore is still
      // banked when they come back to it.
      noteEngagement("browse", "spot_open");
      // The wall that opens two taps from here should know which water they
      // were reading. Published rather than threaded: see @/lib/paywall-context.
      setPaywallContext({ spotSlug: slug, page: "explore" });
      // Mobile (<lg) has no rail/drawer — go straight to the responsive spot
      // page. Desktop keeps the in-rail drawer + flyTo.
      const spot = displaySpots.find((s) => s.slug === slug);
      if (
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width:1024px)").matches
      ) {
        // Leave the memory centred on this spot, the same frame desktop's
        // flyTo below would have left. Mobile taps a card and goes straight to
        // the page, so without this the return trip lands on whatever the list
        // happened to be scrolled over rather than on the spot just viewed.
        if (spot) writeSpotHandoff(spot);
        // Mobile opens the spot page directly instead of the desktop
        // drawer, so this push is the ad frame's most-taken exit and the one
        // that most needs to not be one. `withAdParams` puts `?ad=` back on
        // it; middleware does the rest.
        router.push(
          withAdParams(spot ? spotHref(spot) : legacySpotPath(slug), ad),
        );
        return;
      }
      setQuery({ spot: slug, stn: null });
      if (spot) {
        mapRef.current?.flyTo({
          center: [spot.lng, spot.lat],
          zoom: Math.max(mapRef.current.getZoom() ?? 9, 11),
          duration: 700,
        });
      }
    },
    [router, setQuery, displaySpots, writeSpotHandoff, ad],
  );

  // ── Search picks ────────────────────────────────────────────────────
  // A searched spot is usually NOT in the loaded payload — that's the whole
  // point of searching — so these fly to coordinates the result carried rather
  // than looking anything up in `displaySpots`. Once the camera lands, the
  // viewport refetch pulls the spot in and the drawer fills itself.

  const handleSearchSelectSpot = useCallback(
    (slug: string, lat: number, lng: number) => {
      noteEngagement("browse", "search_spot");
      setPaywallContext({ spotSlug: slug, page: "explore" });
      if (
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width:1024px)").matches
      ) {
        // The result carries its own coordinates, so a searched spot gets the
        // same return-trip frame a tapped card does. Otherwise coming back
        // from it landed on the water the search was typed over.
        writeSpotHandoff({ slug, lat, lng });
        // A search result can name a spot outside the loaded viewport, so
        // there is no rail row to read a path off. The retired URL resolves it
        // server-side and 308s, which is one hop and always right.
        router.push(legacySpotPath(slug));
        return;
      }
      setQuery({ spot: slug, stn: null });
      mapRef.current?.flyTo({
        center: [lng, lat],
        zoom: Math.max(mapRef.current.getZoom() ?? 9, 11),
        duration: 700,
      });
    },
    [router, setQuery, writeSpotHandoff],
  );

  const handleSearchSelectRegion = useCallback(
    (bbox: number[]) => {
      const [w, s, e, n] = bbox;
      setQuery({ spot: null, stn: null });
      const desktop = typeof window !== "undefined" && window.innerWidth >= 1024;
      mapRef.current?.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        {
          padding: desktop
            ? { left: 460, top: 40, right: 80, bottom: 200 }
            : { left: 24, top: 24, right: 24, bottom: 24 },
          maxZoom: 10,
          duration: 800,
        },
      );
    },
    [setQuery],
  );

  // Species is a filter, not a place — picking one pins the chip and leaves the
  // camera alone. The name is kept alongside because a species can be searched
  // that isn't on any spot in the current viewport, in which case the loaded
  // species dict can't supply a label for the strip header.
  const handleSearchSelectSpecies = useCallback(
    (id: string, name: string) => {
      noteEngagement("browse", "search_species");
      setPaywallContext({ speciesId: id, page: "explore" });
      setSpeciesFilter(id);
      setPickedSpeciesName(name);
    },
    [],
  );

  const handleCloseSpot = useCallback(() => {
    // Closed means no spot is in front of them any more, and a wall opened
    // after this should not claim one. `page` survives; the selection does not.
    clearPaywallContext({ page: "explore" });
    setPreviewAnchor(null);
    setQuery({ spot: null });
  }, [setQuery]);

  const handleSelectStation = useCallback(
    (pick: StationPick) => {
      noteEngagement("browse", "station_pick");
      setLastPick(pick);
      setQuery({ stn: `${pick.source}:${pick.sid}`, spot: null });
      mapRef.current?.flyTo({
        center: [pick.lng, pick.lat],
        zoom: Math.max(mapRef.current.getZoom() ?? 9, 10),
        duration: 700,
      });
    },
    [setQuery],
  );

  const handleCloseStation = useCallback(() => {
    setQuery({ stn: null });
  }, [setQuery]);

  // ── "Near me": geolocate → jump to the nearest covered city (client-side
  //    haversine over the loaded hierarchy — no API round-trip). ────────────
  const [locating, setLocating] = useState(false);

  const handleNearMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let best: CityNode | null = null;
        let bestKm = Infinity;
        for (const prov of data.locations)
          for (const region of prov.regions)
            for (const city of region.cities) {
              const km = haversineKm(latitude, longitude, city.lat, city.lng);
              if (km < bestKm) {
                bestKm = km;
                best = city;
              }
            }
        if (best) setQuery({ loc: best.slug, spot: null });
        else mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 9, duration: 800 });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [data.locations, setQuery]);

  const handleSelectDay = useCallback(
    (d: ForecastDay) => {
      noteEngagement("browse", "day_pick");
      setQuery({ day: d.iso === today ? null : d.iso });
    },
    [setQuery, today],
  );

  // ── The filter setters, as the UI calls them ─────────────────────────────
  //
  // Wrappers rather than `setSpeciesFilter` itself, because the raw setters are
  // also called by the mount-time restore and by "reset filters", and neither
  // of those is a click anyone made. Only the chips, the search and the mobile
  // sheet come through here, so only real picks are counted.
  const chooseSpecies = useCallback((id: string | null) => {
    noteEngagement("browse", "species_filter");
    setPaywallContext({ speciesId: id ?? undefined, page: "explore" });
    setSpeciesFilter(id);
  }, []);

  const chooseScoreFloor = useCallback((floor: ScoreFloor) => {
    noteEngagement("browse", "score_filter");
    setScoreFloor(floor);
  }, []);

  // The remembered camera outranks the city one — see the restore block up
  // top. `initialViewState` is read once by MapLibre at mount, so this is the
  // only place the return trip can land in the right frame without a visible
  // jump from the default city.
  //
  // A server-framed `?spot` outranks the city too, and for the same reason it
  // has to be here rather than in an effect: this is the map's one chance to be
  // born pointing at the spot. The `flyTo` in the deep-link effect below still
  // covers the slug the server could not resolve — it just no longer runs for
  // the ones it could, so the shared link opens on its water instead of
  // animating there 800 ms after the bundle lands.
  //
  // `restored` is already null whenever `?spot` is set (a URL that names a
  // place never restores), so the order between them is belt and braces.
  const initialCenter = restored
    ? { lat: restored.lat, lng: restored.lng }
    : serverFramedSpot && initialSpot
      ? { lat: initialSpot.lat, lng: initialSpot.lng }
      : selectedCity
        ? { lat: selectedCity.lat, lng: selectedCity.lng }
        : { lat: 50.5, lng: -126.5 };
  const initialZoom = restored
    ? restored.zoom
    : serverFramedSpot
      ? SPOT_LINK_ZOOM
      : (initialZoomOverride ??
        (selectedCity ? 9 : 4.5));

  // ── Writing the return-trip memory ──────────────────────────────────────
  //
  // Every settled move, plus any change to what the canvas is showing. Cheap:
  // `moveend` fires once per gesture, not per frame.
  useEffect(() => {
    if (!viewCenter || viewZoom == null) return;
    const view: ExploreView = {
      lat: viewCenter.lat,
      lng: viewCenter.lng,
      zoom: viewZoom,
      bounds: viewBounds,
      spot: spotSlug,
      day,
      species: speciesFilter,
      relief,
      labels,
      currents,
      wind,
    };
    savedRef.current = view;
    writeExploreView(view);
  }, [
    viewCenter,
    viewZoom,
    viewBounds,
    spotSlug,
    day,
    speciesFilter,
    relief,
    labels,
    currents,
    wind,
  ]);

  // The rest of the restore — everything the camera block up top deliberately
  // left alone because it shows up in the server-rendered markup. Applying it
  // here, one tick after hydration, is invisible to the eye and keeps the
  // first client render byte-identical to the server's.
  //
  // Seeding the viewport by hand matters as much as the camera does: without
  // it the rail, the pill and the 14-day strip spend the tile-load wait
  // showing the default city's water while the map sits over somewhere else.
  //
  // `?spot`/`?day` go through `setQuery` so the URL stays honest about what's
  // selected — reload, or copy the link, and you get the same canvas. A stale
  // day is dropped rather than restored: a tab left open overnight would
  // otherwise come back selecting a day the strip no longer has.
  useEffect(() => {
    if (!restored) return;
    if (restored.species != null) setSpeciesFilter(restored.species);
    if (restored.relief != null) setRelief(restored.relief);
    // A view saved before the single-flow rule can carry both layers on.
    // Currents wins that tie — it is the layer the rail has always led with.
    if (restored.currents != null || restored.wind != null) {
      setFlow(restored.currents ? "currents" : restored.wind ? "wind" : null);
    }
    if (restored.bounds) {
      setViewBounds(restored.bounds);
      setVpBbox(paddedBbox(restored.bounds));
    }
    setViewCenter({ lat: restored.lat, lng: restored.lng });
    setViewZoom(restored.zoom);

    const next: Record<string, string | null> = {};
    if (restored.spot) next.spot = restored.spot;
    if (restored.day && restored.day > today) next.day = restored.day;
    if (Object.keys(next).length > 0) setQuery(next);
    // Mount only — `restored` is fixed for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember the last viewed city (nearest to the viewport) — the catch
  // wizard's location fallback (geo-fallback.ts) centers its pin here when a
  // photo has no GPS.
  useEffect(() => {
    if (!labelCity) return;
    try {
      localStorage.setItem(
        "rc:lastCity",
        JSON.stringify({ lat: labelCity.lat, lng: labelCity.lng, name: labelCity.name }),
      );
    } catch {
      /* storage unavailable (private mode) — fallback chain continues */
    }
  }, [labelCity]);

  // ── The engagement count, and the one ask still riding it ────────────────
  //
  // This used to open <ProTrialModal feature="whole-map" from="explore-nag">
  // unprompted, once a visitor had clicked enough to look interested. It was
  // removed: over seven days it took 27 impressions and produced zero clicks,
  // while every wall someone walked into on their own converted — the top-bar
  // ask 33%, a locked day 6-10%, custom spots 12%. The headline was "Unlock
  // the whole map" and the map was never locked, so it interrupted a browsing
  // visitor to announce a restriction they had not hit, which is the one thing
  // none of the converting asks do.
  //
  // The COUNT stays, because it is not only the nag's. The depth gate below
  // reads the same `nag.open` to decide when to ask an ad visitor for a free
  // account, and that is an ask with something behind it — depth goes away if
  // they say no. Deleting the trigger rather than raising its threshold is
  // deliberate: a nag that converts at zero is not badly tuned, it is asking
  // for something nobody was stopped from having.
  //
  // `tierLoading` is in the gate, not just `isPaid`: the tier reads as free
  // until it resolves, and a Pro member asked to buy Pro has been told the
  // product does not know who they are. Deferred, not skipped, so a slow
  // subscription answer only delays the ask to the next click.
  //
  // Not on the ad frame. That page is built around one offer that is already
  // fixed to the screen, and a modal over it would be two asks competing.
  //
  // PREVIEW_GATE_ENABLED is in the gate too, now that the depth prompt is the
  // only thing left that opens. Without it the hook would still spend the
  // visit's one ask on every visit while the gate is off, silently, opening
  // nothing — a flag in storage saying an ask was made that nobody saw.
  const nag = useUpgradeNag({
    enabled: PREVIEW_GATE_ENABLED && !isPaid && !tierLoading && !ad,
    // The dialogs and sheets this shell owns. Walls are absent on purpose:
    // opening <ProTrialModal> zeroes the count, so they cannot be stacked on.
    suppressed:
      alertOpen ||
      alertUpgradeOpen ||
      customUpgradeOpen ||
      customModalOpen ||
      filterOpen ||
      customMode,
  });

  // ── Stamp the grant, here rather than on the landing page ────────────────
  //
  // The route owns this so the deferred direct-to-/m/explore arm needs no new
  // code when it is switched on — an ad pointed straight here stamps exactly
  // what the /lp CTA stamps. Never overwrites a decline (see preview-gate), so
  // clicking a second ad does not buy back the map.
  //
  // Client side because a page render may not write cookies in this Next
  // version, and because there is nothing the FIRST render needs it for: no
  // grant and no decline both mean depth stays on.
  useEffect(() => {
    if (!marketing) return;
    setPreview((current) => current ?? stampPreviewGrant());
  }, [marketing]);

  // ── Which ask this visit earns ───────────────────────────────────────────
  //
  // One engagement count, two possible modals. On the marketing frame a
  // signed-out visitor who has not yet answered gets the depth gate; everyone
  // else gets the Pro trial modal the count was originally written for. Sharing
  // the counter is what stops the two stacking, and keeps "one ask per visit"
  // meaning one ask rather than one of each.
  // One line, once, on the way down. Cleared on a timer rather than left for a
  // dismiss button: it is an explanation, not a decision, and the permanent
  // explanation is the unlock control the map keeps from here on.
  useEffect(() => {
    if (!depthNarrated) return;
    const t = window.setTimeout(() => setDepthNarrated(false), 5200);
    return () => window.clearTimeout(t);
  }, [depthNarrated]);

  // The engagement count's only remaining consumer. `nag.open` was shared with
  // the unprompted Pro ask, which is why this reads as one of two; it is now
  // the whole of it, and PREVIEW_GATE_ENABLED is also in `enabled` above so
  // the count is not spent while the gate is off.
  const depthAsk =
    PREVIEW_GATE_ENABLED &&
    nag.open &&
    marketing &&
    !user &&
    preview !== "declined";

  /**
   * The way back, from the affordance the locked map keeps.
   *
   * A real route to /signup rather than a link to a marketing page: the whole
   * promise is that registering switches the depth on, and `next` brings them
   * straight back to the water they were reading.
   */
  const handleUnlockDepth = useCallback(() => {
    const here =
      typeof window === "undefined"
        ? "/explore"
        : `${window.location.pathname}${window.location.search}`;
    router.push(`/signup?next=${encodeURIComponent(here)}`);
  }, [router]);

  /** They said no. Record it, strip depth, and let the map narrate it once. */
  const declineDepth = useCallback(() => {
    setPreview("declined");
    writePreviewCookie("declined");
    setDepthNarrated(true);
    nag.setOpen(false);
  }, [nag]);

  return (
    // Every spot link rendered under here carries the frame with it, so a tap
    // on a pin opens the spot page framed rather than dropping the reader onto
    // the app's own chrome. See ./lib/ad-frame.
    //
    // Explore pins itself to the viewport: the map fills the box and the rail
    // and forecast strip scroll inside it, so the document itself never
    // scrolls. This height + clip used to come from ExploreLayout, but that
    // layout is shared with the spot page, which is a long document — so the
    // surface that wants the lock owns it.
    <AdFrameProvider
      value={
        ad ? { wall: ad.wall, angle: ad.angle, onFullReport: onAdFullReport } : null
      }
    >
    <div
      /* The map runs the full height of the viewport on every surface, phone
         included, the ad frame too: its bar sits on the TOP edge now, in the
         same 4rem band the product's bar takes, and the map box below starts
         under it. It used to be cut short by the bar's height as well, from
         when the bar was pinned to the bottom, and once the bar moved up that
         cut left a white strip across the bottom of the screen with nothing in
         it, under the preview card and the fortnight rail.

         Everything runs the map the full height of the viewport, phone
         included. It used to stop 3.5rem short to hold a strip open for the
         floating tab bar, and that strip was dead space: page background under
         a bar that is already translucent and already floats. Tapping a pin
         made it obvious — the preview card lifts off the bottom edge, and
         behind it sat a white band instead of the water the card is about. The
         bar keeps its own room via `--rc-tabbar-clearance`, which is what the
         sheet and the preview dock sit above; nothing needs the map to be
         short as well. */
      className="relative overflow-hidden lg:min-h-0 h-dvh"
      /* Marks this render as the ad frame for the one piece of chrome outside
         this tree: the mobile tab bar in the root layout. */
      data-ad-frame={ad ? "" : undefined}
    >
      {/* Hidden on a phone for Pro, and only for Pro. A phone gives the map
          about 500px of height, and 64px of that going to a bar carrying a
          logo and one avatar is the worst trade on the screen: the bottom tab
          bar already does the navigating, and the avatar moves into the
          floating header below. Anyone we still have something to sell keeps
          the bar, because for them it is carrying the offer (the trial signed
          out, Pro signed in), and that earns the band back. Desktop keeps it
          for all three, since that is where the nav itself lives. The one
          surface that stays off the app gridline: the map runs to both edges,
          and a centred row would strand the mark in the middle of it.

          `isPaid` is false until the tier resolves, so the bar paints first
          and clears a beat later for a Pro viewer. That is the right way
          round: the viewers this bar now exists for get it immediately. */}
      {/* The ad frame keeps the bar, empties it, and puts it at the bottom.
          It used to have none at all: the mark and the offer both rode in a
          strip pinned under the map, and a bar would only have added exits.
          With the offer moved into the trial modal the bar is the thing that
          opens it, so it comes back in `adFrame` dress — mark, one button, and
          none of the nav, search, sign-in or avatar that made it an exit — on
          the top edge, where the product's bar is (Casey's call, 2026-09-04:
          never at the bottom). It shows at every width and for every tier,
          because on this page it is the only ask there is.

          Same `placeName` either way: the city under the camera, which the
          modal sets in brand blue behind its headline. */}
      {/* Rendered here rather than at the foot of the tree because it reads as
          the page's header and is one: `fixed` takes it out of the flow, and
          where it lands on screen is the `adFrame` branch's business. */}
      {ad ? (
        <ExploreTopBar
          adFrame
          adBarEdge="top"
          containerClassName={BLEED_MEASURE}
          upgradeCta={!isPaid}
          placeName={labelCity?.name ?? undefined}
        />
      ) : (
        <div className={isPaid ? "hidden lg:block" : undefined}>
          {/* The bar's trial CTA names the city under the camera, the same
              `labelCity` the floating location header and the mobile sheet
              already show. Nothing to name before the camera settles, and the
              headline simply drops the phrase until it does. */}
          <ExploreTopBar
            containerClassName={BLEED_MEASURE}
            upgradeCta={!isPaid}
            placeName={labelCity?.name ?? undefined}
          />
        </div>
      )}

      {/* Mobile-only top row — floats over the top of the full-screen map, on
          the map's own top edge when there is no bar and just under it when
          there is: Search, Filters, a compass, and Add spot across the rest.
          Desktop shows the location selector inside the rail instead.

          Four separate controls on the water, not one white bar: as a bar it
          read as a second header stacked under the top bar, and between the
          two of them a phone gave up its first 110px before any water showed.
          The outer div is click-through so dragging the map between the
          pills still works, and it is what carries MAP_INSET_ATTR, so the
          camera keeps correcting for the whole band the row sits in.

          The Pro avatar that used to sit here is gone with the bar's width;
          the More tab's Account row is the way to the account now. */}
      <div
        {...{ [MAP_INSET_ATTR]: "top" }}
        className={`lg:hidden pointer-events-none absolute ${mobileTop} inset-x-0 z-20 px-3 pt-2`}
      >
        <div className="pointer-events-auto">
          <MobileTopRow
            search={
              <LocationSelector
                compact
                locations={data.locations}
                selectedCity={labelCity}
                onSelectCity={handleSelectCity}
                onSelectSpot={handleSearchSelectSpot}
                onSelectRegion={handleSearchSelectRegion}
                onSelectSpecies={handleSearchSelectSpecies}
                near={searchNear}
                onNearMe={handleNearMe}
                locating={locating}
              />
            }
            onFilterClick={() => setFilterOpen(true)}
            activeFilters={activeFilters}
            bearing={bearing}
            onResetNorth={handleResetNorth}
            onAddSpot={
              !customMode && !tierLoading ? handleCreateCustomSpot : undefined
            }
          />
        </div>
      </div>

      {/* The single map instance — full-screen on every breakpoint. Mobile
          floats the location header + a pull-up spot sheet over it; desktop
          keeps the rail + docked forecast strip. */}
      {/* `lg:top-16` is the desktop top bar's band. The ad frame wears its bar
          in the same band at every width (`adBarEdge="top"`), so the map
          starts under it there too. */}
      <div className={`absolute inset-x-0 bottom-0 ${mobileTop} lg:top-16`}>
        <ExploreMap
          mapRef={mapRef}
          spots={filteredSpots}
          selectedSlug={selectedSpot?.slug ?? null}
          onSelect={handleMapSelectSpot}
          onSelectStation={handleSelectStation}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          /* The toggle keeps its own state so it is exactly where they left it
             the moment they register; the gate simply outranks it while it
             applies. */
          relief={relief && !depthLocked}
          labels={labels}
          currents={currents}
          wind={wind}
          flowTimeIso={flowTimeIso}
          stripVisible={!stripHidden}
          wdfwRegs={wdfwRegs}
          onViewportChange={handleViewportChange}
          pinDropMode={customMode}
          onMapPick={handleMapPick}
          // `isPaid` is false until `useSubscription` resolves, so the report
          // signals stay hidden until the tier is known and then appear. That
          // is the right way round: a Pro viewer waits a beat, a free one never
          // sees them.
          showReports={isPaid}
          onBearingChange={handleBearingChange}
        />

        {/* The "Create custom spot" action no longer floats over the map: on
            desktop it lives in the rail header, and on mobile/tablet it sits
            beside the Filters button in the floating location header. Only the
            placement banner remains over the map, while pin-drop is armed. */}

        {/* Placement banner while pin-drop mode is armed. It takes the button's
            exact slot rather than centring: the map box runs the full width,
            but the left rail floats over its first 408px, so a centred banner
            reads off-centre on desktop. Swapping in place also means arming the
            mode doesn't move anything. */}
        {customMode && (
          <div
            className={`${MAP_ACTION_PILL} right-3 lg:right-6 max-w-[calc(100%-1.5rem)] gap-3 bg-rc-ink shadow-md`}
          >
            <span className="truncate">Place your spot on the map</span>
            <button
              type="button"
              onClick={() => setCustomMode(false)}
              className="flex items-center gap-1 shrink-0 text-white/80 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {customModalMounted && (
      <CreateCustomSpotDialog
        open={customModalOpen}
        onOpenChange={setCustomModalOpen}
        coords={pinCoords}
        speciesOptions={allSpecies}
        onCreated={(spot) => {
          // A spot you placed and named starts favorited — it appears starred
          // in the rail and in Saved spots without a second click.
          if (spot.slug) void setFavorite(spot.slug, spot.id);
          setOwnSpotsRefresh((n) => n + 1);
          setCustomSpots((prev) => [
            {
              id: spot.id,
              name: spot.name,
              slug: spot.slug,
              lat: spot.lat,
              lng: spot.lng,
              visibility: spot.visibility ?? "private",
            },
            ...prev.filter((p) => p.id !== spot.id),
          ]);
        }}
      />
      )}

      {/* Mobile-only pull-up spot sheet over the map (Zillow-style). Takes the
          hour-scored list, like the desktop rail, so dragging the hour bar
          re-ranks the cards under it. */}
      <MobileMapSheet
        spots={railDisplaySpots}
        tz={MAP_TZ}
        aboveSheet={
          <div className="flex flex-col items-start gap-2">
            <MobileLayersControl
              flow={flow}
              onFlowChange={handleMobileFlow}
              relief={relief && !depthLocked}
              onToggleRelief={() => setRelief((v) => !v)}
              depthLocked={depthLocked}
              onUnlockDepth={handleUnlockDepth}
            />
            {flow && (
              <div className="w-full">
                <MobileHourBar
                  kind={flow}
                  hours={selectedDayHours}
                  scrubHour={scrubHour}
                  peakHour={peakHour}
                  onScrubHour={setScrubHour}
                  onReset={() => setScrubHour(null)}
                  onClose={() => handleMobileFlow(null)}
                />
              </div>
            )}
          </div>
        }
        locationName={labelCity?.name ?? null}
        onSelectSpot={handleSelectSpot}
        forecastModel={stripModel}
        previewForecastModel={previewStripModel}
        selectedIso={selectedIso}
        onSelectDay={handleSelectDay}
        signedIn={!!user}
        freshCatches={freshCatches}
        selectedSlug={selectedSpot?.slug ?? null}
        previewAnchorSlug={previewAnchor}
        onPreviewSlug={followPreviewSlug}
        onClosePreview={handleCloseSpot}
      />

      <LeftRail
        locations={data.locations}
        selectedCity={labelCity}
        spots={railDisplaySpots}
        selectedSpot={selectedSpot}
        selectedStation={selectedStation}
        date={selectedIso}
        tz={MAP_TZ}
        scrubHour={scrubHour}
        freshCatches={freshCatches}
        bottomInset={stripHidden ? 64 : DESKTOP_STRIP_H + 24}
        onSelectCity={handleSelectCity}
        onSelectSpot={handleSelectSpot}
        onSearchSelectSpot={handleSearchSelectSpot}
        onSearchSelectRegion={handleSearchSelectRegion}
        onSearchSelectSpecies={handleSearchSelectSpecies}
        searchNear={searchNear}
        onCloseSpot={handleCloseSpot}
        onCloseStation={handleCloseStation}
        onSpotHourHover={setScrubHour}
        onSetAlert={handleSetAlert}
        onCreateCustomSpot={
          !customMode && !tierLoading ? handleCreateCustomSpot : undefined
        }
        mapControls={{
          relief: relief && !depthLocked,
          depthLocked,
          onUnlockDepth: handleUnlockDepth,
          currents,
          wind,
          onToggleRelief: () => setRelief((v) => !v),
          onToggleCurrents: toggleCurrents,
          onToggleWind: toggleWind,
          species: speciesWithScores,
          speciesFilter,
          onSpeciesChange: chooseSpecies,
          onNearMe: handleNearMe,
          locating,
        }}
      />

      {/* Mobile-only station/buoy sheet — the rail (and its drawer slot) is
          desktop-only, so stations get a bottom sheet on small screens. */}
      {selectedStation && (
        <div
          style={{ bottom: "var(--rc-tabbar-clearance)" }}
          className="lg:hidden fixed inset-x-0 z-40 h-[60dvh] bg-rc-panel border-t border-rc-rule rounded-t-xl shadow-rc-panel overflow-hidden"
        >
          <StationDrawer
            pick={selectedStation}
            tz={MAP_TZ}
            onBack={handleCloseStation}
          />
        </div>
      )}

      <ForecastStrip
        model={stripModel}
        speciesName={stripSpeciesName}
        selectedIso={selectedIso}
        loading={fcLoading}
        onSelectDay={handleSelectDay}
        selectedDayHours={selectedDayHours}
        scrubHour={scrubHour}
        onScrubHour={setScrubHour}
        signedIn={!!user}
        hidden={stripHidden}
        onHide={() => setStripHidden(true)}
        onShow={() => setStripHidden(false)}
      />

      {/* Mobile-only map-filter sheet (species + layers + near-me). */}
      {filterSheetMounted && (
      <MobileFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        // The in-view scores, like the desktop chips — the sheet's species rows
        // exist to say which fish is worth chasing HERE, and `allSpecies`
        // carries the opening payload's seed scores for water that may be a
        // province away by now.
        species={speciesWithScores}
        speciesFilter={speciesFilter}
        onSpeciesChange={chooseSpecies}
        scoreFloor={scoreFloor}
        onScoreFloorChange={chooseScoreFloor}
        reportsOnly={reportsOnly}
        onToggleReports={() => setReportsOnly((v) => !v)}
        reportsCount={reportsAvailable}
        savedOnly={savedOnly}
        onToggleSaved={() => setSavedOnly((v) => !v)}
        savedCount={savedAvailable}
        // Offered only to someone with saved spots in view to find. For
        // everyone else the row is a switch whose only outcome is an empty map.
        savedAvailable={savedSet.size > 0}
        matchCount={railSpots.length}
        activeFilters={activeFilters}
        onReset={resetFilters}
      />
      )}

      {/* Create-alert modal + sign-up gate, opened from the drawer's "Set alert". */}
      {alertSpot && (
        <CreateAlertDialog
          open={alertOpen}
          onOpenChange={setAlertOpen}
          spot={{
            name: alertSpot.name,
            slug: alertSpot.slug,
            lat: alertSpot.lat,
            lng: alertSpot.lng,
            city: alertSpot.cityName,
          }}
          speciesOptions={alertSpeciesOptions}
          initialSpeciesId={alertSpot.bestSpeciesId}
          onUpgradeRequired={() => setAlertUpgradeOpen(true)}
        />
      )}

      {alertUpgradeMounted && (
      <ProTrialModal
        open={alertUpgradeOpen}
        onOpenChange={setAlertUpgradeOpen}
        feature="alerts"
        from="explore"
        spotName={alertSpot?.name}
      />
      )}

      {/* The wall behind "Create custom spot" for a free or signed-out angler.
          Same modal and same plan matrix as every other wall on /explore, on
          the row that actually got hit. */}
      {customUpgradeMounted && (
      <ProTrialModal
        open={customUpgradeOpen}
        onOpenChange={setCustomUpgradeOpen}
        feature="custom-spots"
        from="explore-map"
      />
      )}

      {/* The ad frame's offer, made on a FULL REPORT press. Same modal as
          the bar's button, named after the spot that was pressed. */}
      {adOfferMounted && (
      <ProTrialModal
        open={adOfferOpen}
        onOpenChange={setAdOfferOpen}
        feature="forecast-14d"
        from="explore-ad-full-report"
        spotName={adOfferSpotName}
        placeName={labelCity?.name ?? undefined}
      />
      )}

      {/* The depth gate's own ask. Dismissing it IS the decline — see
          declineDepth — which is why it does not share ProTrialModal's
          onOpenChange. */}
      <DepthGatePrompt open={depthAsk} onDismiss={declineDepth} />

      {/* Says what just happened, once. Without it the relief simply vanishing
          reads as the map failing rather than as the answer they gave. */}
      {depthNarrated && (
        <div
          role="status"
          data-testid="depth-gate-narration"
          className="fixed inset-x-4 top-20 z-40 mx-auto max-w-sm rounded-xl bg-rc-ink/90 px-4 py-2.5 text-center text-[13px] leading-relaxed text-white shadow-rc-panel backdrop-blur lg:left-[420px] lg:right-auto lg:top-6 lg:mx-0 lg:text-left"
        >
          Depth comes back with a Member account. Scores and today stay free.
        </div>
      )}

    </div>
    </AdFrameProvider>
  );
}
