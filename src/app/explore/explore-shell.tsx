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
  type ForecastStripModel,
  type ForecastTier,
} from "./lib/forecast-strip";
import { boundsOf, paddedBbox } from "./lib/viewport-bbox";
import { useMountedOnce } from "@/hooks/use-mounted-once";
import {
  fetchFreshCatches,
  fetchMapForecast14d,
  fetchMapSpotsAsViewer,
  fetchMapSpotsCached,
  fetchMyCustomSpots,
  fetchSpotCoords,
} from "@/lib/bluecaster-client";
import type { MapForecast14dPayload } from "@/lib/bluecaster";
import type { FreshCatchesResponse } from "./lib/fresh-catch-types";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/contexts/auth-context";
import { useExploreState } from "./lib/use-explore-state";
import { readExploreView, writeExploreView, type ExploreView } from "./lib/view-memory";
import ExploreTopBar from "./components/explore-top-bar";
import { BLEED_MEASURE } from "@/app/components/layout/page-measure";
import ExploreMap, { type StationPick, type CustomSpotPin } from "./components/explore-map";

import { setFavorite } from "./lib/use-favorite";
import { Plus, X } from "lucide-react";
import LeftRail from "./components/left-rail";
import LocationSelector from "./components/location-selector";
import MobileMapSheet from "./components/mobile-map-sheet";
import ForecastStrip from "./components/forecast-strip";

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
  initialForecast,
  initialForecastBbox,
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
   * The 14-day viewport strip for `initialForecastBbox`, fetched by the page so
   * the strip can paint from the first response instead of waiting out the JS
   * bundle. Anonymous-horizon only — see the prefetch comment in page.tsx.
   */
  initialForecast?: MapForecast14dPayload | null;
  /** The box `initialForecast` covers; matches the shell's own mount-time seed. */
  initialForecastBbox?: string | null;
}) {
  const mapRef = useRef<MapRef>(null);
  const router = useRouter();
  const { isPaid, loading: tierLoading } = useSubscription();
  const { user } = useAuth();
  // Key data fetches on the id, not the object: `useAuth` hands back a fresh
  // `user` on every onAuthStateChange (including token refresh), so an effect
  // depending on the object refetches the same URL for no reason.
  const userId = user?.id ?? null;
  // `tierLoading` matters: before it clears, `isPaid` is still its initial
  // `false`, so a Pro account would render as "free" and lock days 8–14 behind
  // an upgrade CTA. The strip renders the days it is sure of and marks the rest
  // pending until the tier lands — see the `stripModel` memo.
  const accessTier: ForecastTier = isPaid ? "pro" : user ? "free" : "anonymous";
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
  // A URL that names its own place always wins: `?loc` is a city pick, `?spot`
  // a spot deep link, `?stn` a station — all of them somebody asking for a
  // specific frame, not for the one they left. Only a bare /explore, which is
  // what "Back to map" and the nav both point at, restores.
  const restoredRef = useRef<ExploreView | null | undefined>(undefined);
  if (restoredRef.current === undefined) {
    restoredRef.current = citySlug || spotSlug || stn ? null : readExploreView();
  }
  const restored = restoredRef.current;
  /** The blob last written, so a handler can amend it without rebuilding it. */
  const savedRef = useRef<ExploreView | null>(restored);

  /**
   * Is the page's prefetch about the water this URL is going to?
   *
   * This used to be the blunter question "does the URL name a place at all",
   * because the server always prefetched the default city: on `?loc=vancouver-bc`
   * showing Victoria's numbers for a beat before Vancouver's arrived would be a
   * worse first paint than showing none, so the prefetch was thrown away.
   *
   * The server honours `?loc` now, so the common deep link arrives with a
   * prefetch that IS Vancouver's, and discarding it would re-introduce exactly
   * the wait this prop was added to remove. The three cases that still discard:
   *
   *   - `?spot` / `?stn` — the frame is one spot or one station, not a city
   *     box, and the shell flies somewhere the prefetch does not cover.
   *   - a `?loc` the server could not resolve (renamed or hand-edited slug, a
   *     covered city with no published spots yet) — it fell back to the default
   *     city, and so does `selectedCity`, but the two agreeing is not something
   *     this component should assume, so it refetches rather than guess.
   *   - no `initialCitySlug` at all — an older cached document from before the
   *     prop existed, or a payload the page could not resolve a city for.
   */
  const prefetchIsOurWater =
    !spotSlug && !stn && !!initialCitySlug && (!citySlug || citySlug === initialCitySlug);

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
  const [labels, setLabels] = useState(true);
  const [currents, setCurrents] = useState(false);
  const [wind, setWind] = useState(false);
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
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

  const activeCitySlug = citySlug ?? data.defaultCitySlug;

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
  const railSpots = useMemo(() => {
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

  // Per-species best scores across the spots in view (and for the viewed
  // date) so the filter chips reflect the water the user is looking at.
  const speciesWithScores = useMemo<SpeciesOption[]>(() => {
    const best: Record<string, number> = {};
    for (const spot of railSpots) {
      for (const [sid, score] of Object.entries(spot.scoresBySpecies)) {
        if (!(sid in best) || score > best[sid]) best[sid] = score;
      }
    }
    return allSpecies
      .map((s) => ({ ...s, bestScore: best[s.id] ?? null }))
      .sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
  }, [railSpots, allSpecies]);

  // Jurisdiction auto-switch: the WDFW marine-area grid + MPAs (shipped hidden
  // in the relief style, Canada-first) turn on when the viewport sits in
  // Washington. DFO layers stay on — each grid only covers its own waters.
  const wdfwRegs =
    (labelCity?.provinceCode ?? railSpots[0]?.provinceCode) === "WA";

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

  const selectedSpot = useMemo(
    () =>
      railSpots.find((s) => s.slug === spotSlug) ??
      displaySpots.find((s) => s.slug === spotSlug) ??
      null,
    [railSpots, displaySpots, spotSlug],
  );

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
  const skipInitialFit = useRef(restored !== null);
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
  const flownToSpot = useRef<string | null>(null);
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

  const handleSelectSpot = useCallback(
    (slug: string) => {
      // Mobile (<lg) has no rail/drawer — go straight to the responsive spot
      // page. Desktop keeps the in-rail drawer + flyTo.
      const spot = displaySpots.find((s) => s.slug === slug);
      if (
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width:1024px)").matches
      ) {
        // Leave the memory centred on this spot — the same frame desktop's
        // flyTo below would have left. Mobile taps a card and goes straight to
        // the page, so without this "Back to map" returns to whatever the list
        // happened to be scrolled over rather than to the spot just viewed.
        const base = savedRef.current;
        if (base && spot) {
          writeExploreView({
            ...base,
            lat: spot.lat,
            lng: spot.lng,
            zoom: Math.max(base.zoom, 11),
            // Recentring invalidates them; the map reports real ones on load.
            bounds: null,
            spot: slug,
          });
        }
        router.push(`/explore/spot/${slug}`);
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
    [router, setQuery, displaySpots],
  );

  // ── Search picks ────────────────────────────────────────────────────
  // A searched spot is usually NOT in the loaded payload — that's the whole
  // point of searching — so these fly to coordinates the result carried rather
  // than looking anything up in `displaySpots`. Once the camera lands, the
  // viewport refetch pulls the spot in and the drawer fills itself.

  const handleSearchSelectSpot = useCallback(
    (slug: string, lat: number, lng: number) => {
      if (
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width:1024px)").matches
      ) {
        router.push(`/explore/spot/${slug}`);
        return;
      }
      setQuery({ spot: slug, stn: null });
      mapRef.current?.flyTo({
        center: [lng, lat],
        zoom: Math.max(mapRef.current.getZoom() ?? 9, 11),
        duration: 700,
      });
    },
    [router, setQuery],
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
      setSpeciesFilter(id);
      setPickedSpeciesName(name);
    },
    [],
  );

  const handleCloseSpot = useCallback(() => {
    setQuery({ spot: null });
  }, [setQuery]);

  const handleSelectStation = useCallback(
    (pick: StationPick) => {
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
      setQuery({ day: d.iso === today ? null : d.iso });
    },
    [setQuery, today],
  );

  // The remembered camera outranks the city one — see the restore block up
  // top. `initialViewState` is read once by MapLibre at mount, so this is the
  // only place the return trip can land in the right frame without a visible
  // jump from the default city.
  const initialCenter = restored
    ? { lat: restored.lat, lng: restored.lng }
    : selectedCity
      ? { lat: selectedCity.lat, lng: selectedCity.lng }
      : { lat: 50.5, lng: -126.5 };
  const initialZoom = restored ? restored.zoom : selectedCity ? 9 : 4.5;

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
    if (restored.labels != null) setLabels(restored.labels);
    if (restored.currents != null) setCurrents(restored.currents);
    if (restored.wind != null) setWind(restored.wind);
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

  return (
    // Explore pins itself to the viewport: the map fills the box and the rail
    // and forecast strip scroll inside it, so the document itself never
    // scrolls. This height + clip used to come from ExploreLayout, but that
    // layout is shared with the spot page, which is a long document — so the
    // surface that wants the lock owns it.
    <div className="relative h-[calc(100dvh-3.5rem)] lg:h-dvh lg:min-h-0 overflow-hidden">
      {/* The one surface that stays off the app gridline: the map runs to both
          edges, and a centred row would strand the mark in the middle of it. */}
      <ExploreTopBar containerClassName={BLEED_MEASURE} />

      {/* Mobile-only location header — floats over the top of the full-screen
          map (Zillow-style), just under the fixed top bar. Desktop shows the
          same selector inside the rail. */}
      <div className="lg:hidden absolute top-16 inset-x-0 z-20 bg-rc-panel border-b border-rc-rule">
        <LocationSelector
          locations={data.locations}
          selectedCity={labelCity}
          onSelectCity={handleSelectCity}
          onSelectSpot={handleSearchSelectSpot}
          onSelectRegion={handleSearchSelectRegion}
          onSelectSpecies={handleSearchSelectSpecies}
          near={searchNear}
          onFilterClick={() => setFilterOpen(true)}
        />
      </div>

      {/* The single map instance — full-screen on every breakpoint. Mobile
          floats the location header + a pull-up spot sheet over it; desktop
          keeps the rail + docked forecast strip. */}
      <div className="absolute inset-x-0 top-16 bottom-0">
        <ExploreMap
          mapRef={mapRef}
          spots={uniqueSpots}
          selectedSlug={selectedSpot?.slug ?? null}
          onSelect={handleSelectSpot}
          onSelectStation={handleSelectStation}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          relief={relief}
          labels={labels}
          currents={currents}
          wind={wind}
          hour={scrubHour}
          flowTimeIso={flowTimeIso}
          stripVisible={!stripHidden}
          wdfwRegs={wdfwRegs}
          onViewportChange={handleViewportChange}
          pinDropMode={customMode}
          onMapPick={handleMapPick}
        />

        {/* Pro-only "Create custom spot" action (top-right of the map). */}
        {isPaid && !customMode && (
          <button
            type="button"
            onClick={() => setCustomMode(true)}
            className="absolute z-20 top-3 right-3 flex items-center gap-1.5 rounded-full bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold px-4 py-2 shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create custom spot
          </button>
        )}

        {/* Placement banner while pin-drop mode is armed. */}
        {customMode && (
          <div className="absolute z-20 top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-rc-ink text-white text-sm font-semibold px-4 py-2 shadow-md">
            <span>Tap the map to place your spot</span>
            <button
              type="button"
              onClick={() => setCustomMode(false)}
              className="flex items-center gap-1 text-white/80 hover:text-white"
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

      {/* Mobile-only pull-up spot sheet over the map (Zillow-style). */}
      <MobileMapSheet
        spots={railSpots}
        tz={MAP_TZ}
        locationName={labelCity?.name ?? null}
        onSelectSpot={handleSelectSpot}
        forecastModel={stripModel}
        selectedIso={selectedIso}
        selectedDayHours={selectedDayHours}
        scrubHour={scrubHour}
        onScrubHour={setScrubHour}
        onSelectDay={handleSelectDay}
        signedIn={!!user}
        freshCatches={freshCatches}
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
        bottomInset={stripHidden ? 64 : 152}
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
        mapControls={{
          relief,
          labels,
          currents,
          wind,
          onToggleRelief: () => setRelief((v) => !v),
          onToggleLabels: () => setLabels((v) => !v),
          onToggleCurrents: () => setCurrents((v) => !v),
          onToggleWind: () => setWind((v) => !v),
          species: speciesWithScores,
          speciesFilter,
          onSpeciesChange: setSpeciesFilter,
          onNearMe: handleNearMe,
          locating,
        }}
      />

      {/* Mobile-only station/buoy sheet — the rail (and its drawer slot) is
          desktop-only, so stations get a bottom sheet on small screens. */}
      {selectedStation && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 h-[60dvh] bg-rc-panel border-t border-rc-rule rounded-t-xl shadow-rc-panel overflow-hidden">
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
        relief={relief}
        labels={labels}
        currents={currents}
        onToggleRelief={() => setRelief((v) => !v)}
        onToggleLabels={() => setLabels((v) => !v)}
        onToggleCurrents={() => setCurrents((v) => !v)}
        species={allSpecies}
        speciesFilter={speciesFilter}
        onSpeciesChange={setSpeciesFilter}
        onNearMe={handleNearMe}
        locating={locating}
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
    </div>
  );
}
