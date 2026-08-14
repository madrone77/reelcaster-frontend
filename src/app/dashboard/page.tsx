"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Home, Plus, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  fetchMyCustomSpots,
  fetchMapSpotsAsViewer,
  fetchMapSpotsCached,
  fetchSpotLive,
  fetchFreshCatches,
  fetchSpotsOutlook14d,
  type OwnedCustomSpot,
  type SpotsOutlook14dPayload,
} from "@/lib/bluecaster-client";
import type { FreshCatchesResponse } from "@/app/explore/lib/fresh-catch-types";
import {
  TIER_PILL,
  tierFor,
  railSpotFromEntry,
  type RailSpot,
} from "@/app/explore/lib/explore-data";
import SpotCard from "@/app/explore/components/spot-card";
import { spotDaysFrom } from "@/app/explore/components/spot-day-strip";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import HomeSpotHero from "./home-spot-hero";
import AroundYou, { aroundYouFrom } from "./around-you";
import MarketingFooter from "@/app/components/marketing/marketing-footer";
import type { MapSpotsPayload } from "@/lib/bluecaster";
import { useHomeSpotSlug } from "@/app/explore/lib/use-home-spot";
import { useSavedSpots, setFavorite } from "@/app/explore/lib/use-favorite";
import { storedFirstName, NAME_FALLBACK } from "@/lib/display-name";
import { supabase } from "@/lib/supabase";
import { DailyReportCard } from "./daily-report-card";
import { fetchAlertProfiles } from "@/lib/alerts-client";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";
import type { AlertProfile } from "@/lib/custom-alert-engine";
import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";

// The whole covered extent — favourites can live anywhere in it.
const COVERED_BBOX_ALL = "-139.06,41.99,-114.03,60";

/** A real spot id, as opposed to the slug `unscoredRailSpot` stands in with. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "victoria-waterfront-ad3f9b" → "Victoria Waterfront" (strip id suffix, title-case).
function prettify(slug: string): string {
  return slug
    .replace(/-(?=[a-z0-9]*\d)[a-z0-9]{5,10}$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * A RailSpot for a saved/custom spot the map payload didn't carry (a custom
 * spot awaiting its first score, or a favourite gone unpublished). Renders as
 * the same shared card, just "NO SCORE" with empty KPIs.
 */
function unscoredRailSpot(
  slug: string,
  name: string,
  extra: Partial<RailSpot> = {},
): RailSpot {
  return {
    id: slug,
    slug,
    name,
    lat: 0,
    lng: 0,
    citySlug: "",
    cityName: "",
    regionSlug: "",
    regionName: "",
    provinceCode: "",
    score: null,
    bestSpeciesId: null,
    driverSpecies: null,
    peakHour: null,
    distanceKm: null,
    conditions: { wind: null, sea: null, tide: null, current: null, sky: null, air: null },
    condStrip: null,
    hours24: new Array(24).fill(null),
    scoresBySpecies: {},
    ...extra,
  };
}


function todayVancouver(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" });
}

function longDate(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "America/Vancouver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function kgToLb(kg: number | null | undefined): number | null {
  if (typeof kg !== "number") return null;
  return Math.round(kg * 2.2046);
}

type Scored = { score: number; species: string | null };
type GridSpot = {
  slug: string;
  name: string;
  score: number | null;
  species: string | null;
  tag: "home" | "private" | null;
};
type CatchRow = {
  species_name?: string | null;
  weight_kg?: number | null;
  location_name?: string | null;
  caught_at: string;
};

/**
 * Logged-in home / dashboard — the angler's saved + custom spots with today's
 * scores, a pinned home-spot hero, and a rail of alerts, fresh catches, and
 * regulation changes. Auth-gated by the global AuthGate.
 */
export default function DashboardPage() {
  const { user, session } = useAuth();
  const [custom, setCustom] = useState<OwnedCustomSpot[] | null>(null);
  const [scoreBySlug, setScoreBySlug] = useState<Record<string, Scored>>({});
  // Raw map payload kept so the grid can render the shared Explore card from
  // the same numbers (railSpotFromEntry), not a forked card.
  const [payload, setPayload] = useState<MapSpotsPayload | null>(null);
  // Whether the cached map read has come back at all, hit or miss. The outlook
  // request waits on this so it fires once with the home spot's id included
  // rather than twice — and, being a settled flag rather than `payload !== null`,
  // it still releases if that read fails outright.
  const [payloadSettled, setPayloadSettled] = useState(false);
  // Undo snackbar for an un-starred spot.
  const [undo, setUndo] = useState<{ slug: string; name: string } | null>(null);
  // Pinned home spot. Hydrates from the saved profile copy, so the hero is
  // populated on a device that never set the pin itself.
  const homeSlug = useHomeSpotSlug(true);
  const [homeLive, setHomeLive] = useState<SpotPageInitial | null>(null);
  const [alerts, setAlerts] = useState<AlertProfile[] | null>(null);
  // Scraped catch reports per spot — the "N reports" badge on the grid cards.
  // Distinct from `catches` below, which is the angler's OWN catch log.
  const [spotReports, setSpotReports] = useState<FreshCatchesResponse | null>(
    null,
  );
  // Every card's next 14 days, in one request. undefined = still reading, and
  // the cards hold the strip's space rather than growing under the cursor.
  const [outlook, setOutlook] = useState<SpotsOutlook14dPayload | null | undefined>(
    undefined,
  );
  const [catches, setCatches] = useState<CatchRow[] | null>(null);
  const [catchTotal, setCatchTotal] = useState<number | null>(null);
  // Server fallback name (Stripe name → "Angler") when no first_name is stored.
  const [serverName, setServerName] = useState<string | null>(null);
  // Inline name edit (triggered by the pencil).
  const [localName, setLocalName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // When the angler has no stored first name, resolve the fallback server-side
  // (Stripe customer name for paid users, else "Angler"). Skipped entirely once
  // a name exists on the auth user.
  useEffect(() => {
    if (!user || storedFirstName(user)) {
      setServerName(null);
      return;
    }
    const token = session?.access_token;
    let cancelled = false;
    fetch(
      "/api/profile/display-name",
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          setServerName(
            typeof d?.firstName === "string" && d.firstName ? d.firstName : NAME_FALLBACK,
          );
        }
      })
      .catch(() => !cancelled && setServerName(NAME_FALLBACK));
    return () => {
      cancelled = true;
    };
    // Keyed on the IDENTIFIERS, not the objects: AuthProvider re-emits a fresh
    // user/session on every auth event (INITIAL_SESSION, TOKEN_REFRESHED, …),
    // so an object dep re-runs this on each one — the dashboard was firing
    // every one of its reads two and three times per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  // Auto-dismiss the un-star undo snackbar.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  // Custom spots (owner-scoped).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyCustomSpots()
      .then((rows) => !cancelled && setCustom(rows))
      .catch(() => !cancelled && setCustom([]));
    return () => {
      cancelled = true;
    };
    // Keyed on the IDENTIFIERS, not the objects: AuthProvider re-emits a fresh
    // user/session on every auth event (INITIAL_SESSION, TOKEN_REFRESHED, …),
    // so an object dep re-runs this on each one — the dashboard was firing
    // every one of its reads two and three times per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Saved spots, from the account rather than this browser. `null` until the
  // first read resolves — several things below distinguish "no saved spots"
  // from "don't know yet", and rendering the empty state during the load would
  // tell a user with a full list that they have none.
  //
  // Memoized on the joined slugs because `useSavedSpots` hands back a fresh
  // array each render: passed straight into the dependency arrays below, the
  // coordinate fetch would re-fire on every render forever.
  const {
    slugs: savedSlugs,
    coords: savedCoords,
    ready: savedReady,
  } = useSavedSpots();
  const savedKey = savedSlugs.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const favSlugs = useMemo(() => (savedReady ? savedSlugs : null), [savedReady, savedKey]);

  // Names and coordinates for those favourites, riding along with the saved
  // list itself (/api/saved-spots resolves them server-side). Now that the
  // summary map is gone this is what lets a card show its real name straight
  // away instead of flashing a slug-derived guess until the bulk payload lands.
  const coords = savedReady ? savedCoords : null;

  // Today's best score per spot across the covered extent.
  // The personalized payload wins once it lands; the cached one must never
  // overwrite it afterwards (it lacks this angler's own custom spots).
  const viewerPayloadLanded = useRef(false);
  const applyPayload = useCallback((p: MapSpotsPayload, fromViewer: boolean) => {
    if (!p?.spots) return;
    if (viewerPayloadLanded.current && !fromViewer) return;
    if (fromViewer) viewerPayloadLanded.current = true;
    setPayload(p);
    const species = p.species ?? {};
    const map: Record<string, Scored> = {};
    for (const s of p.spots) {
      let best = 0;
      let bestId: string | null = null;
      for (const [id, strip] of Object.entries(s.scores ?? {})) {
        const peak = (strip as { peak?: number })?.peak;
        if (typeof peak === "number" && peak > best) {
          best = peak;
          bestId = id;
        }
      }
      if (best > 0) {
        map[s.slug] = {
          score: Math.round(best * 100),
          species: (bestId && species[bestId]?.name) || null,
        };
      }
    }
    setScoreBySlug(map);
  }, []);

  // Coordinates and scores for every PUBLISHED spot, from the anonymous read.
  // Same payload, same engine — but it is CDN-cacheable, so it returns in
  // ~140ms against the personalized read's ~3s (which is `private, no-store`
  // and BYPASSes the edge on every single load). Favourites are published
  // spots, so this alone is enough to put the map and the cards on screen.
  // Fires without waiting on auth, since it needs no identity.
  useEffect(() => {
    let cancelled = false;
    fetchMapSpotsCached(COVERED_BBOX_ALL, todayVancouver())
      .then((p) => {
        if (cancelled) return;
        if (p) applyPayload(p, false);
        setPayloadSettled(true);
      })
      .catch(() => !cancelled && setPayloadSettled(true));
    return () => {
      cancelled = true;
    };
  }, [applyPayload]);

  // The personalized read then upgrades it — but ONLY if there is something to
  // upgrade. Its entire delta over the cached read is this angler's own custom
  // spots and their 24-hour strips, so for an angler with none it is a 3-second
  // uncached re-fetch (`private, no-store`, BYPASS on every load) of a payload
  // we already have from the edge in ~140ms. Wait for `custom` to resolve, then
  // skip it unless it came back non-empty.
  useEffect(() => {
    if (!user || !custom || custom.length === 0) return;
    let cancelled = false;
    fetchMapSpotsAsViewer(COVERED_BBOX_ALL, todayVancouver())
      .then((p) => {
        if (!cancelled && p) applyPayload(p, true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Keyed on the IDENTIFIERS, not the objects: AuthProvider re-emits a fresh
    // user/session on every auth event (INITIAL_SESSION, TOKEN_REFRESHED, …),
    // so an object dep re-runs this on each one — the dashboard was firing
    // every one of its reads two and three times per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, custom?.length, applyPayload]);

  // Home-spot live payload — powers the hero conditions, sparkline, and the
  // regulations rail (the spot's own DFO regs). Degrades to null.
  useEffect(() => {
    if (!homeSlug) {
      setHomeLive(null);
      return;
    }
    let cancelled = false;
    fetchSpotLive(homeSlug)
      .then((p) => !cancelled && setHomeLive(p))
      .catch(() => !cancelled && setHomeLive(null));
    return () => {
      cancelled = true;
    };
  }, [homeSlug]);

  // Custom alerts (owner-scoped, token-authed).
  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    // Shared with the top bar's badge count, which asks for the same list on
    // the same paint — see lib/alerts-client.
    fetchAlertProfiles(token)
      .then((profiles) => !cancelled && setAlerts(profiles))
      .catch(() => !cancelled && setAlerts([]));
    return () => {
      cancelled = true;
    };
    // Keyed on the IDENTIFIERS, not the objects: AuthProvider re-emits a fresh
    // user/session on every auth event (INITIAL_SESSION, TOKEN_REFRESHED, …),
    // so an object dep re-runs this on each one — the dashboard was firing
    // every one of its reads two and three times per load.
  }, [session?.access_token]);

  // Scraped catch reports, keyed by spot id — the same payload Explore's rail
  // joins on, so a saved spot wears the same "N reports" badge here as it does
  // there. Date-independent, so one fetch covers the whole grid. Keyed on the
  // session, not just `user`: the Pro gate lives in the route and reads the
  // access token, so a pass fired before Supabase rehydrates would leave a Pro
  // angler holding the locked payload. Degrades to null — the badge is
  // additive, and a card without it is still the card.
  useEffect(() => {
    let cancelled = false;
    fetchFreshCatches()
      .then((p) => {
        if (!cancelled && p) setSpotReports(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Token, not the session object — AuthProvider re-emits a fresh session on
    // every auth event, and an object dep fired this twice per load.
  }, [session?.access_token]);

  // Fresh catches — the angler's own catch log, last 14 days.
  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const qs = new URLSearchParams({
      sort: "caught_at",
      order: "desc",
      limit: "3",
      start_date: since,
    });
    fetch(`/api/catches?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setCatches(data?.catches ?? []);
        setCatchTotal(typeof data?.total === "number" ? data.total : null);
      })
      .catch(() => {
        if (!cancelled) {
          setCatches([]);
          setCatchTotal(null);
        }
      });
    return () => {
      cancelled = true;
    };
    // Keyed on the IDENTIFIERS, not the objects: AuthProvider re-emits a fresh
    // user/session on every auth event (INITIAL_SESSION, TOKEN_REFRESHED, …),
    // so an object dep re-runs this on each one — the dashboard was firing
    // every one of its reads two and three times per load.
  }, [session?.access_token]);

  // The spots shown in the grid — custom (private) + favourites, deduped,
  // scored, tagged, ranked by score. Home spot floats via its tag, not order.
  const spotCards: GridSpot[] | null = useMemo(() => {
    if (custom === null || favSlugs === null) return null;
    const bySlug = new Map<string, GridSpot>();
    for (const c of custom) {
      const score = scoreBySlug[c.slug]?.score ?? (typeof c.score === "number" ? c.score : null);
      bySlug.set(c.slug, {
        slug: c.slug,
        name: c.name,
        score,
        species: c.best_species_name ?? scoreBySlug[c.slug]?.species ?? null,
        tag: c.slug === homeSlug ? "home" : "private",
      });
    }
    for (const slug of favSlugs) {
      if (bySlug.has(slug)) continue;
      bySlug.set(slug, {
        slug,
        name: prettify(slug),
        score: scoreBySlug[slug]?.score ?? null,
        species: scoreBySlug[slug]?.species ?? null,
        tag: slug === homeSlug ? "home" : null,
      });
    }
    // A home spot is PINNED, not saved — onboarding asks anglers to pin their
    // water without also favouriting it, and "your dashboard opens on it" has
    // to hold for them too. Without this the hero silently falls back to the
    // "pin a home spot" prompt for someone who just pinned one. Name and score
    // come off the live payload the hero already fetches.
    if (homeSlug && !bySlug.has(homeSlug)) {
      const best = homeLive?.topScoreTodayBySpecies ?? {};
      const topId = Object.keys(best).sort((a, b) => best[b] - best[a])[0];
      bySlug.set(homeSlug, {
        slug: homeSlug,
        name: homeLive?.spot.name ?? prettify(homeSlug),
        score: scoreBySlug[homeSlug]?.score ?? (topId ? best[topId] : null),
        species:
          scoreBySlug[homeSlug]?.species ??
          homeLive?.species.find((s) => s.id === topId)?.name ??
          null,
        tag: "home",
      });
    }
    return [...bySlug.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [custom, favSlugs, scoreBySlug, homeSlug, homeLive]);

  // The same spots as RailSpots, so the grid renders the shared Explore card
  // (24h bars + WIND/SEA/CURRENT + star) instead of a forked card. Built from
  // the raw payload the score effect already fetched — no extra request.
  const railSpots: RailSpot[] | null = useMemo(() => {
    if (custom === null || favSlugs === null) return null;
    const railBySlug = new Map<string, RailSpot>();
    if (payload) {
      for (const e of payload.spots) {
        railBySlug.set(e.slug, railSpotFromEntry(e, payload, true));
      }
    }
    const bySlug = new Map<string, RailSpot>();
    for (const c of custom) {
      const base =
        railBySlug.get(c.slug) ??
        unscoredRailSpot(c.slug, c.name, {
          id: c.id,
          score: c.score_status === "scored" ? c.score : null,
          driverSpecies: c.best_species_name ?? null,
        });
      bySlug.set(c.slug, {
        ...base,
        name: c.name,
        isCustom: true,
        visibility: c.visibility,
        // The owner-scoped list already carries the coordinates, so a custom
        // spot plots immediately instead of sitting at 0,0 (and being dropped
        // as unplottable) until a map payload happens to include it.
        lat: c.lat,
        lng: c.lng,
      });
    }
    for (const slug of favSlugs) {
      if (bySlug.has(slug)) continue;
      // Before the map payload lands, the coords read is what makes a
      // favourite plottable — and it carries the real name, so the card does
      // not have to flash a slug-derived guess first.
      const c = coords?.[slug];
      bySlug.set(
        slug,
        railBySlug.get(slug) ??
          unscoredRailSpot(
            slug,
            c?.name ?? prettify(slug),
            c ? { id: c.id, lat: c.lat, lng: c.lng } : {},
          ),
      );
    }
    return [...bySlug.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [custom, favSlugs, payload, coords]);

  // The 14-day strip under every card, in one bulk read keyed on the spot ids
  // actually on screen — not a spot-page fetch per card. A card whose id has
  // not resolved yet is skipped: `unscoredRailSpot` falls back to the slug for
  // an id, and a slug is not something the outlook endpoint can key on.
  //
  // Keyed on the access token for the same reason the reports read is: the
  // plan gate lives in the route and reads the token, so a pass fired before
  // Supabase rehydrates would cap a Pro angler's strip at seven days.
  // Today's hourly strip for the home spot, for the hero's bar chart. Read
  // straight off the map payload rather than out of `railSpots`: that list is
  // built from saved + custom spots only, and a home spot can be PINNED
  // without being either — which is precisely the case where the hero is the
  // one place it shows up. Same derivation the grid cards use, so the two
  // never disagree about the peak.
  const homeStrip = useMemo(() => {
    if (!homeSlug || !payload) return null;
    const entry = payload.spots.find((s) => s.slug === homeSlug);
    return entry ? railSpotFromEntry(entry, payload, true) : null;
  }, [homeSlug, payload]);

  // The home spot rides along explicitly. The hero draws its own 14 days now,
  // and a PINNED-but-unsaved home spot is in neither `custom` nor the saved
  // list, so keying only on `railSpots` would leave the one card at the top of
  // the page as the only one without a fortnight.
  const outlookIdsKey = useMemo(
    () =>
      [...(railSpots ?? []).map((s) => s.id), homeStrip?.id]
        .filter((id): id is string => !!id && UUID_RE.test(id))
        .filter((id, i, all) => all.indexOf(id) === i)
        .sort()
        .join(","),
    [railSpots, homeStrip?.id],
  );
  // The home spot's id only exists once the map payload has landed, and
  // `railSpots` is non-null well before that. Firing on `railSpots` alone sent
  // the request once without the home spot and again with it.
  const outlookWaiting = railSpots === null || (!!homeSlug && !payloadSettled);
  useEffect(() => {
    if (outlookWaiting || !outlookIdsKey) {
      // Either an input is still resolving (hold the skeletons) or there is
      // genuinely nothing to draw (drop the row).
      setOutlook(outlookWaiting ? undefined : null);
      return;
    }
    let cancelled = false;
    setOutlook(undefined);
    fetchSpotsOutlook14d({ spotIds: outlookIdsKey.split(",") })
      .then((p) => {
        if (!cancelled) setOutlook(p);
      })
      .catch(() => {
        if (!cancelled) setOutlook(null);
      });
    return () => {
      cancelled = true;
    };
    // `outlookWaiting` only decides the empty-vs-loading branch above; the
    // request itself is keyed on the id list, so a re-sorted grid doesn't
    // refetch.
  }, [outlookIdsKey, outlookWaiting, session?.access_token]);

  // ── derived ────────────────────────────────────────────────────────────────
  const activeAlertCount = alerts ? alerts.filter((a) => a.is_active).length : null;
  // null, not 0, while the saved set is still resolving. The shell is
  // server-rendered now, so whatever this says is on screen for real: "0 spots
  // tracked" to an angler with twelve of them is not a placeholder, it is a
  // wrong answer that happens to get corrected later.
  const trackedCount = spotCards?.length ?? null;

  // Never derive a name from the email; fall back to the Stripe / "Angler" name.
  const greetName = localName ?? storedFirstName(user) ?? serverName ?? NAME_FALLBACK;
  const saveName = async () => {
    const v = nameDraft.trim();
    if (!v) return;
    setSavingName(true);
    try {
      await supabase.auth.updateUser({ data: { first_name: v } });
      setLocalName(v);
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  const scored = (spotCards ?? []).filter(
    (s): s is GridSpot & { score: number } => typeof s.score === "number"
  );
  const spotsHot = spotCards === null ? null : scored.filter((s) => s.score >= 80).length;
  const topScore = scored.length ? Math.max(...scored.map((s) => s.score)) : null;
  const avgScore = scored.length
    ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length)
    : null;

  const spotsLoading = spotCards === null;
  const homeCard = spotCards?.find((s) => s.slug === homeSlug) ?? null;
  // Everything except the home spot — that one is the hero, and listing it
  // again three hundred pixels lower said the same thing twice.
  const otherSpots = (railSpots ?? []).filter((s) => s.slug !== homeSlug);

  // The best water in the cities this angler already fishes, off the payload
  // that is fetched for the scores anyway. `null` until both the spot set and
  // that payload have settled, so the section holds its skeleton rather than
  // rendering a city short.
  const aroundYou = useMemo(
    () =>
      railSpots === null || !payloadSettled
        ? null
        : aroundYouFrom(
            payload,
            [...railSpots.map((s) => s.slug), ...(homeSlug ? [homeSlug] : [])],
            homeSlug,
          ),
    [payload, payloadSettled, railSpots, homeSlug],
  );

  // Regulations rail — a restrictive reg on the home spot, if any.
  const restrictiveReg = (homeLive?.regulations ?? []).find(
    (r) => r.status !== "Open" || r.nextOpenDate
  );

  // Alert rail — the first (active-preferred) alert, with pts-away if we can
  // resolve its spot's current score.
  const watchAlert =
    (alerts ?? []).find((a) => a.is_active) ?? (alerts ?? [])[0] ?? null;
  const watchCurrent = (() => {
    if (!watchAlert?.location_name) return null;
    const hit = Object.entries(scoreBySlug).find(
      ([slug]) => prettify(slug) === watchAlert.location_name
    );
    return hit ? hit[1].score : null;
  })();
  const ptsAway =
    watchAlert?.score_threshold != null && watchCurrent != null
      ? watchAlert.score_threshold - watchCurrent
      : null;

  const customCount = custom?.length ?? 0;
  const favCount = favSlugs?.length ?? 0;

  return (
    <div className="min-h-dvh bg-rc-panel pt-16">
      {/* `variant="brand"` is the default — passing it here implied the other
          surfaces were getting something else. */}
      <ExploreTopBar />
      {/* Was max-w-[1400px] px-5 lg:px-10 — the only body on the site wider
          than the app gridline, which left the top bar visibly inset from the
          content it sits above. Tightened onto the gridline so the mark, the
          "Your dashboard" kicker and the avatar share one left/right edge. */}
      <div className={`${PAGE_MEASURE} py-8 lg:py-10`}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-rc-mono text-[10px] uppercase tracking-[0.16em] text-rc-ink-mute">
              Your dashboard
            </p>
            <h1 className="mt-1.5 text-3xl font-black tracking-[-0.02em] text-rc-ink">
              {editingName ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  Welcome back,
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveName();
                      }
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    placeholder="Your first name"
                    className="w-56 border-0 border-b-2 border-rc-rule bg-transparent px-0.5 text-3xl font-black tracking-[-0.02em] text-rc-ink focus:border-rc-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void saveName()}
                    disabled={savingName || !nameDraft.trim()}
                    className="text-sm font-semibold text-rc-brand disabled:opacity-50"
                  >
                    {savingName ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingName(false)}
                    className="text-sm font-medium text-rc-ink-mute hover:text-rc-ink"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2.5">
                  Welcome back, {greetName}
                  <button
                    type="button"
                    aria-label="Edit your name"
                    onClick={() => {
                      setNameDraft(localName ?? storedFirstName(user) ?? "");
                      setEditingName(true);
                    }}
                    className="text-rc-brand transition-transform hover:scale-110"
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                </span>
              )}
            </h1>
            <p className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-mute">
              {longDate()} · {trackedCount ?? "—"} spot
              {trackedCount === 1 ? "" : "s"} tracked · {activeAlertCount ?? "—"} alert
              {activeAlertCount === 1 ? "" : "s"} armed
            </p>
          </div>
          <div className="flex items-start divide-x divide-rc-rule">
            <Stat n={spotsHot != null ? String(spotsHot) : "—"} label="Spots ≥ 80" tone="good" />
            <Stat n={topScore != null ? String(topScore) : "—"} label="Top score" tone="good" />
            <Stat n={catchTotal != null ? String(catchTotal) : "—"} label="Fresh catches" tone="good" />
            <Stat n={avgScore != null ? String(avgScore) : "—"} label="Avg score" />
          </div>
        </header>

        {/* ── Body ───────────────────────────────────────────────────────
            One column, top to bottom: the home spot, today's report, then
            every other spot, with alerts / catches / regulations at the foot.
            The 360px rail this used to carry only existed on desktop, so the
            phone — where the dashboard is actually read — got a pile of cards
            in an order nobody chose. */}
        <div className="mx-auto max-w-[860px]">
          <div>
            {spotsLoading && homeSlug ? (
              <div className="h-[300px] animate-pulse rounded-2xl bg-rc-navy/90" />
            ) : homeCard ? (
              <HomeSpotHero
                slug={homeCard.slug}
                name={homeCard.name}
                species={homeCard.species}
                score={homeCard.score}
                rightNow={homeLive?.rightNow ?? null}
                hours24={homeStrip?.hours24}
                peakHour={homeStrip?.peakHour}
                days14={
                  outlook === undefined
                    ? undefined
                    : homeStrip
                      ? spotDaysFrom(outlook, homeStrip.id)
                      : null
                }
              />
            ) : (
              <Link
                href="/explore"
                className="flex items-center justify-between rounded-2xl border border-dashed border-rc-rule bg-rc-panel px-6 py-8 text-rc-ink-soft transition-colors hover:border-rc-brand/40"
              >
                <span className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-rc-ink-mute" />
                  <span className="text-sm">
                    Pin a home spot for daily conditions at a glance
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-rc-ink-mute" />
              </Link>
            )}

            {/* Today's report for the home spot's city, headline first. The
                saved-spots map used to sit here; it repeated pins the angler
                can already read on Explore, and it cost a MapLibre instance
                and a tile fetch on every dashboard load to do it. */}
            <div className="mt-4">
              <DailyReportCard />
            </div>

            {/* The city block sits with the report rather than below the spot
                list: both answer "what is happening around me", one in prose
                and one in numbers, and the discovery is worth more before the
                angler has scrolled their own spots than after. Kept to three
                rows a city so it doesn't push that list off the fold. */}
            <div className="mt-8">
              <AroundYou cities={aroundYou} />
            </div>

            {/* The rest of your spots */}
            <div className="mb-3 mt-8 flex items-center justify-between">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-bold text-rc-ink">Your spots</h2>
                <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                  {customCount} created · {favCount} saved
                </span>
              </div>
              <Link
                href="/explore?create=1"
                className="inline-flex h-8 items-center gap-1.5 rounded border border-rc-rule px-3 text-sm font-normal text-rc-ink-soft transition-colors hover:bg-rc-surface hover:text-rc-ink"
              >
                <Plus className="h-4 w-4" />
                New spot
              </Link>
            </div>

            {/* One column, not two. Each card now carries its own 14-day
                strip, and 14 labelled day cells need the full measure — at
                half-width they compress to ~24px and stop being readable. */}
            {spotsLoading ? (
              <div className="grid grid-cols-1 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-52 animate-pulse rounded border border-rc-rule bg-rc-surface"
                  />
                ))}
              </div>
            ) : otherSpots.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {otherSpots.map((rs) => (
                  <SpotCard
                    key={rs.slug}
                    spot={rs}
                    showVisibility
                    fresh={spotReports?.spots[rs.id]}
                    showDayStrip
                    days14={
                      outlook === undefined
                        ? undefined
                        : spotDaysFrom(outlook, rs.id)
                    }
                    onFavoriteChange={(fav) => {
                      // Un-starring a saved (non-custom) spot drops it from the
                      // grid immediately, with an undo. Custom spots persist.
                      // The card already wrote the removal through the
                      // store, so the grid drops it on its own; this only
                      // offers the way back.
                      if (!fav && !rs.isCustom) {
                        setUndo({ slug: rs.slug, name: rs.name });
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-rc-rule bg-rc-panel p-8 text-center">
                <p className="text-sm font-semibold text-rc-ink">
                  {homeCard ? "Nothing else saved yet" : "No spots yet"}
                </p>
                <p className="mt-1 text-sm text-rc-ink-soft">
                  Save a spot or drop your own to see it here.
                </p>
                <Link
                  href="/explore"
                  className="mt-4 inline-flex h-8 items-center gap-1.5 rounded bg-rc-brand px-3 text-sm font-normal text-white transition-colors hover:bg-rc-brand-hover"
                >
                  Explore spots
                </Link>
              </div>
            )}

          </div>

          {/* ── Foot — alerts, catches, regulations ──────────────────────────
              Same three cards as before, moved out of the desktop-only right
              rail to the bottom of the one column. They side by side once
              there's room; on a phone they stack, which is where they already
              ended up. Cards share the Explore spot-card language: a 2px rule,
              a mono status pill top-right, and a plain-English conclusion line
              — no colored top-borders or filled boxes. */}
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Alerts */}
            <RailCard
              title="Alerts"
              pill={
                <Link href="/alerts">
                  <Pill
                    className={
                      (activeAlertCount ?? 0) > 0 ? TIER_PILL.good : TIER_PILL.none
                    }
                  >
                    {activeAlertCount ?? "—"} ARMED
                  </Pill>
                </Link>
              }
            >
              {alerts === null ? (
                <RailSkeleton />
              ) : watchAlert ? (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-rc-ink">
                      {watchAlert.location_name ?? watchAlert.name ?? "Your spot"}
                    </span>
                    {watchCurrent != null && (
                      <Pill className={TIER_PILL[tierFor(watchCurrent)]}>
                        {watchCurrent} {tierFor(watchCurrent).toUpperCase()}
                      </Pill>
                    )}
                  </div>
                  <div className="mt-0.5 font-rc-mono text-[12px] text-rc-ink-soft">
                    {[
                      watchAlert.target_species,
                      watchAlert.score_threshold != null
                        ? `needs ${watchAlert.score_threshold}`
                        : null,
                      ptsAway != null
                        ? ptsAway > 0
                          ? `${ptsAway} to go`
                          : "hitting the mark"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Custom conditions"}
                  </div>
                </div>
              ) : (
                <RailEmpty
                  body="Get pinged when a spot hits your conditions."
                  cta="Create an alert"
                  href="/alerts"
                />
              )}
            </RailCard>

            {/* Fresh catches */}
            <RailCard
              title="Fresh catches"
              pill={
                catches && catches.length > 0 ? (
                  <Pill className={TIER_PILL.none}>
                    {catchTotal ?? catches.length} · 14D
                  </Pill>
                ) : null
              }
            >
              {catches === null ? (
                <RailSkeleton />
              ) : catches.length > 0 ? (
                <ul className="space-y-2.5">
                  {catches.map((c, i) => {
                    const lb = kgToLb(c.weight_kg);
                    return (
                      <li key={i} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-rc-ink">
                            {c.species_name ?? "Catch"}
                            {lb != null ? ` ${lb} lb` : ""}
                          </div>
                          {c.location_name && (
                            <div className="truncate font-rc-mono text-[11px] text-rc-ink-soft">
                              {c.location_name}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 font-rc-mono text-[11px] text-rc-ink-mute">
                          {relTime(c.caught_at)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <RailEmpty
                  body="No catches logged yet."
                  cta="Log a catch"
                  href="/log-catch"
                />
              )}
            </RailCard>

            {/* Regulations */}
            <RailCard
              title="Regulations"
              pill={
                homeLive?.regAreaCode ? (
                  <Pill className={TIER_PILL.none}>AREA {homeLive.regAreaCode}</Pill>
                ) : null
              }
            >
              {restrictiveReg ? (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-rc-ink">
                      {restrictiveReg.speciesCommon}
                    </span>
                    <Pill className={REG_PILL[restrictiveReg.status]}>
                      {restrictiveReg.status.toUpperCase()}
                    </Pill>
                  </div>
                  <div className="mt-0.5 font-rc-mono text-[12px] text-rc-ink-soft">
                    {restrictiveReg.nextOpenSummary ??
                      restrictiveReg.detail ??
                      "See details"}
                  </div>
                  <Link
                    href={`/explore/spot/${homeSlug}`}
                    className="mt-2 inline-block font-rc-mono text-[11px] font-bold text-rc-brand"
                  >
                    View all regulations ›
                  </Link>
                </div>
              ) : (
                <RailEmpty
                  body={
                    homeSlug
                      ? "No retention changes on your home spot right now."
                      : "Pin a home spot to track DFO openings and closures."
                  }
                  cta={homeSlug ? "View regulations" : "Explore spots"}
                  href={homeSlug ? `/explore/spot/${homeSlug}` : "/explore"}
                />
              )}
            </RailCard>
          </div>
        </div>
      </div>

      <MarketingFooter />

      {/* Un-star undo. Cleared above the floating tab bar on phones; back to
          the screen edge on desktop, where that bar isn't rendered. */}
      {undo && (
        <div className="fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6">
          <div className="flex items-center gap-3 rounded-lg bg-rc-navy px-4 py-2.5 text-sm text-white shadow-rc-panel">
            <span className="truncate">Removed {undo.name} from saved</span>
            <button
              type="button"
              onClick={() => {
                if (!undo) return;
                void setFavorite(undo.slug);
                setUndo(null);
              }}
              className="font-rc-mono text-[12px] font-bold uppercase tracking-wide text-rc-brand-soft hover:text-white"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── bits ────────────────────────────────────────────────────────────────────
// Regulation status → the same tier-pill palette the score badges use.
const REG_PILL: Record<string, string> = {
  Open: TIER_PILL.good,
  Release: TIER_PILL.fair,
  Closed: TIER_PILL.poor,
};

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 font-rc-mono text-[11px] font-bold ${className}`}
    >
      {children}
    </span>
  );
}

// Rail card in the Explore spot-card language: 2px rule, a title + status pill
// header, then the body (a divider-led conclusion, list, or empty state).
function RailCard({
  title,
  pill,
  children,
}: {
  title: string;
  pill?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
      <div className="px-4 pb-3.5 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[15px] font-medium text-rc-ink">{title}</span>
          {pill}
        </div>
        <div className="mt-3 border-t border-rc-rule pt-3">{children}</div>
      </div>
    </div>
  );
}

function RailSkeleton() {
  return <div className="h-12 animate-pulse rounded bg-rc-surface" />;
}

function RailEmpty({
  body,
  cta,
  href,
}: {
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div>
      <p className="font-rc-mono text-[12px] text-rc-ink-soft">{body}</p>
      <Link
        href={href}
        className="mt-2 inline-block font-rc-mono text-[11px] font-bold text-rc-brand"
      >
        {cta} ›
      </Link>
    </div>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: string;
  label: string;
  tone?: "good";
}) {
  return (
    // Symmetric padding so the divider rule sits evenly between columns.
    <div className="px-4 first:pl-0 last:pr-0">
      <div
        className={`text-2xl font-black tabular-nums leading-none ${
          tone === "good" ? "text-rc-good" : "text-rc-ink"
        }`}
      >
        {n}
      </div>
      <div className="mt-2 font-rc-mono text-[9px] uppercase tracking-[0.1em] text-rc-ink-mute">
        {label}
      </div>
    </div>
  );
}

