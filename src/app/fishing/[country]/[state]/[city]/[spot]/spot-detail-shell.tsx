"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowUpCircle, ChevronLeft, ChevronRight, Home, Bell, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { noteEngagement } from "@/lib/upgrade-nag";
import { setPaywallContext } from "@/lib/paywall-context";
import AdSlot from "@/app/components/ads/ad-slot";
import { countryDisplayName, regulatorFrom } from "@/lib/regions";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import DayCell from "@/app/explore/components/day-cell";
import { bestWindow } from "@/app/explore/components/hourly-bars";
import UpgradeDialog from "@/app/explore/components/upgrade-dialog";
import { fmtPeak, zonedHourToUtcIso, zoneAbbrev } from "@/app/explore/lib/explore-data";
import { useSpotClock } from "@/app/explore/lib/use-spot-clock";
import { useAutoRefresh } from "@/app/explore/lib/use-auto-refresh";
import { formatHour12, formatTime12 } from "@/lib/time-format";
import {
  buildForecastDays,
  type ForecastDay,
  type ForecastTier,
} from "@/app/explore/lib/forecast-strip";
import {
  fetchForecast14d,
  fetchFreshCatches,
  fetchSpotRecentReports,
  fetchSpotScore,
  fetchPointConditions,
  fetchCurrentsPoint,
  type CurrentSample,
} from "@/lib/bluecaster-client";
import {
  localDayStartUtcMs,
  signCurrentSeries,
} from "@/app/explore/lib/current-series";
import type {
  SpotPageInitial,
  Forecast14dPayload,
  SpotScorePayload,
  PointConditions,
  RightNowSnapshot,
} from "@/lib/bluecaster/live-spot-types";
import SpeciesCardRow from "@/app/explore/spot/components/species-card-row";
import SpotProfile from "@/app/explore/spot/components/spot-profile";
import NeighbourSpots from "@/app/explore/spot/components/neighbour-spots";
import SeasonalityStrip from "@/app/explore/spot/components/seasonality-strip";
import CurrentConditionsStrip from "@/app/explore/spot/components/current-conditions-strip";
import CurrentRegulations from "@/app/explore/spot/components/current-regulations";
import ScoreFactors from "@/app/explore/spot/components/score-factors";
import { useFavorite } from "@/app/explore/lib/use-favorite";
import { useHomeSpot } from "@/app/explore/lib/use-home-spot";
import HomeSpotOffer from "./home-spot-offer";
import {
  buildTerminalHours,
  tideRangeFrom,
} from "@/app/explore/lib/terminal-hours";
import SpotTerminal from "@/app/explore/spot/components/spot-terminal";
import SpotMiniMap from "@/app/explore/spot/components/spot-mini-map";
import ScoreCard from "@/app/explore/spot/components/score-card";
import { RecentReportsBand } from "@/app/explore/components/recent-reports";
import type { RecentReports as RecentReportsData } from "@/lib/bluecaster/live-spot-types";
import type { RailFreshCatch } from "@/app/explore/lib/fresh-catch-types";
import CustomAlertCta from "@/app/explore/spot/components/custom-alert-cta";
import {
  useCampaignHit,
  type CampaignTarget,
} from "@/app/lp/_shared/lp-telemetry";
import type { AdMode, AdWall } from "@/lib/ad-mode";
import MarketingFooter from "@/app/components/marketing/marketing-footer";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";
import LogCatchDialog from "@/app/explore/spot/components/log-catch-dialog";
import PullToRefresh from "@/app/explore/spot/components/pull-to-refresh";
import CreateAlertDialog from "@/app/explore/spot/components/create-alert-dialog";
import ShareCardDialog from "@/app/explore/spot/components/share-card-dialog";

const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

// The page is heavy already and almost nobody opens this. It loads on the tap.
const ReportIssueDialog = dynamic(
  () => import("@/app/explore/components/report-issue-dialog"),
  { ssr: false },
);

/** Catch-report window. Matches FRESH_DAYS in the fresh-catches route. */
const FRESH_DAYS = 21;

/**
 * How often an open page refetches its live numbers.
 *
 * Five minutes because that is what the sub-header has always told readers,
 * and because it is roughly the resolution of what changes underneath: the
 * hourly grids move on the hour, the conditions and currents behind them a
 * good deal slower.
 */
const AUTO_REFRESH_MS = 5 * 60_000;

/**
 * "10:42 AM" in the spot's own timezone, matching every other clock here.
 *
 * Built from parts and handed to `formatTime12` rather than formatted by
 * `Intl` directly: the locale decides the shape of a formatted time, and
 * `en-CA` renders "10:05 a.m.", which the sub-header's `uppercase` would then
 * serve as "10:05 A.M." next to a page that says "10 AM" everywhere else.
 */
function formatClock(at: Date, tz: string): string {
  // Matches `currentLocalHour`: an invalid instant would make Intl throw, and
  // a freshness stamp is not worth taking the page down for.
  const when = Number.isFinite(at.getTime()) ? at : new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(when);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return formatTime12(part("hour") % 24, part("minute"));
}

/**
 * How far an ad page's wall opens the forecast strip, for a visitor with no
 * account. See ad-mode.ts.
 *
 * `day2` and `open` both land on "anonymous" because two days is what an
 * anonymous visitor is ENTITLED to: the horizon is enforced server-side in
 * /api/bluecaster/spots/[slug]/forecast-14d, which nulls out every day past
 * it before the payload leaves the server. A wall here can tighten what is
 * shown; it can never widen what was sent. What `open` opens is the rest of
 * the page.
 */
function tierForWall(wall: AdWall): ForecastTier {
  return wall === "today" ? "today" : "anonymous";
}

/**
 * What actually crosses into the client. `catchSignals` carries verbatim
 * third-party forum text and per-report detail; the server strips both before
 * render, and this type is what stops them being handed back by accident.
 */
export type SpotPageForClient = Omit<
  SpotPageInitial,
  "catchSignals" | "intelVerdict" | "recentReports"
> & {
  /** Truncated headline only. The full report is Pro and is fetched at request
   *  time from the gated route, never serialized into the prerendered HTML. */
  recentReportsTeaser: string | null;
  /** Date of the newest report, so the block can show its freshness even locked. */
  recentReportsUpdatedAt: string | null;
};

const REG_PILL: Record<string, string> = {
  Open: "bg-rc-good-bg text-rc-good-ink",
  Release: "bg-rc-fair-bg text-rc-fair-ink",
  Closed: "bg-rc-poor-bg text-rc-poor-ink",
};

function bestSpeciesId(page: SpotPageForClient): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const s of page.species) {
    const v = page.topScoreTodayBySpecies[s.id] ?? -1;
    if (v > bestScore) {
      bestScore = v;
      best = s.id;
    }
  }
  return best ?? page.species[0]?.id ?? null;
}

/** Where this spot sits in the public /fishing directory; null for custom
 *  spots and spots in cities that aren't published. */
export type SpotCityLink = {
  cityName: string;
  cityPath: string;
  provinceName: string;
  provincePath: string;
  /** Breadcrumb label, not the formal name — "USA", "Canada". */
  countryName: string;
};

export default function SpotDetailShell({
  page,
  slug,
  cityLink,
  freshTracked = false,
  tz: TZ,
  serverNowMs,
  ad = null,
  openOnSpeciesId = null,
  openOnIso = null,
}: {
  page: SpotPageForClient;
  slug: string;
  cityLink: SpotCityLink | null;
  /** Does this spot have scraped catch reports in the window? The only fact
   *  about them the prerendered (free) render is allowed to carry. */
  freshTracked?: boolean;
  /** The spot's IANA timezone, resolved from its region on the server. */
  tz: string;
  /** The instant the server baked into this HTML. Every time-dependent string
   *  on the page derives from it until the component mounts. See
   *  `useSpotClock`. */
  serverNowMs: number;
  /**
   * Set when this render is the destination of a paid ad (see ad-mode.ts).
   *
   * Null is the product. Every branch below is `ad && …` or `!ad && …`, never
   * a rewrite of the shared path, so the public page renders exactly what it
   * rendered before this prop existed. Same split rule as LpShell's
   * `treatment`: the frame varies, the substance does not.
   */
  ad?: AdMode | null;
  /**
   * Open the page on a specific species and day instead of the defaults.
   *
   * Set by /s/<token>, so a recipient lands on the fish and the day they were
   * actually invited to. Without it the page opened on its own best species and
   * today, and a stranger who was told "Chinook, Sunday" got halibut and Monday
   * with no way to tell the two apart.
   *
   * Both are hints, not commands: an id that is not on this spot's roster, or a
   * day outside the horizon, is ignored rather than selecting nothing.
   */
  openOnSpeciesId?: string | null;
  openOnIso?: string | null;
}) {
  const { spot } = page;
  // Which fisheries authority governs this spot.
  //
  // The breadcrumb city's province used to win here, on the assumption that it
  // is the same value when a published city owns the spot. It is not. A spot
  // belongs to the NEAREST city and the nearest city can be across a border:
  // East Point (Saturna Island) is a BC mark in DFO subarea 18-11 sitting on
  // friday-harbor-wa's roster, so the page cited WDFW, printed "Marine Area
  // 18-11" for a number WDFW never issued, and sent an angler to
  // wdfw.wa.gov for Canadian water. The regs themselves were DFO's all along
  // — only the attribution was wrong, which is the worse half to get wrong.
  //
  // So: the agency the payload names, then the SPOT's own province, and the
  // city only as the last resort where neither reaches us.
  const regulator = regulatorFrom({
    agency: page.regAgency,
    region: spot.region ?? cityLink?.provinceName,
  });
  const { hour: nowHour, at: nowAt } = useSpotClock(TZ, serverNowMs);
  // Initial state is fixed at the first render, which is exactly when
  // `nowHour` still holds the server's seeded hour — so this matches what the
  // server rendered without re-deriving it from the raw prop, and inherits the
  // hook's handling of a prop missing from a stale payload.
  const [selectedHour, setSelectedHour] = useState<number>(() => nowHour);
  // Until the angler scrubs, the chart follows the live hour rather than
  // sitting on whatever hour the cached page happened to be built in.
  const [scrubbed, setScrubbed] = useState(false);
  useEffect(() => {
    if (!scrubbed) setSelectedHour(nowHour);
  }, [nowHour, scrubbed]);
  // Any deliberate hour pick pins the chart; the minute ticker stops moving it.
  const selectHour = useCallback((hour: number) => {
    setScrubbed(true);
    setSelectedHour(hour);
  }, []);
  // The way back to the live hour, and the only one. The chart used to do this
  // implicitly whenever a mouse left it, which made a pinned hour impossible to
  // carry anywhere: the map sits a thousand pixels above the chart, so scrolling
  // up to see the wind field at the hour you just picked passed the pointer out
  // of the chart and reset it on the way. It is an explicit "Now" button on the
  // map's time bar instead, and it behaves the same under touch and mouse.
  const clearScrub = useCallback(() => {
    setScrubbed(false);
    setSelectedHour(nowHour);
  }, [nowHour]);

  const species = useMemo(
    () => [...page.species].sort((a, b) => a.rank - b.rank),
    [page.species],
  );
  const [selId, setSelId] = useState<string | null>(() => {
    // A shared link's species wins over the spot's own default, but only if the
    // spot actually carries it — a stale card must not select nothing.
    if (openOnSpeciesId && page.species.some((s) => s.id === openOnSpeciesId)) {
      return openOnSpeciesId;
    }
    return bestSpeciesId(page);
  });
  // Names for the per-species report split. The roster is the species this spot
  // is scored for; anglers report others (crab and lingcod at a salmon spot),
  // and those fold into "Other species" rather than being dropped.
  const selSpecies = species.find((s) => s.id === selId) ?? species[0] ?? null;

  // ── lazy data ─────────────────────────────────────────────────────────
  const [fc, setFc] = useState<Forecast14dPayload | null>(null);
  const [score, setScore] = useState<SpotScorePayload | null>(null);
  const [point, setPoint] = useState<PointConditions | null>(null);
  // Catch reports. The static render is always locked (that's what keeps this
  // page prerenderable); a Pro viewer upgrades it client-side from the gated
  // route, which is also where the entitlement is actually enforced.
  // Starts null, NOT {locked:true}. Seeding it locked was optimistic about the
  // reader being free, so a Pro angler on a spot with reports but no written
  // digest got the upsell painted at them until the counts arrived. Same flash
  // as the report block had, one branch over. The locked state is set below,
  // once entitlement says the reader actually is free.
  const [fresh, setFresh] = useState<RailFreshCatch | null>(null);
  const [saved, toggleSaved] = useFavorite(spot.slug);
  // Hydrated, so the house fills in for an angler who pinned this spot on
  // another device — and so HomeSpotOffer below can tell "no pin" apart from
  // "the pin hasn't been read back yet" before it offers to set one.
  const {
    isHome,
    toggle: toggleHome,
    slug: homeSlug,
    ready: homeReady,
  } = useHomeSpot(spot.slug, true);
  const { isPaid, loading: tierLoading } = useSubscription();
  const { user, loading: authLoading } = useAuth();
  // Until `tierLoading` clears, `isPaid` is still its initial `false` — the
  // strip holds off rather than briefly locking a Pro account's days 8–14.
  // A signed-in viewer keeps the tier they paid for, ad link or not: someone
  // who clicks their own ad while logged in must never be shown less than
  // their account entitles them to. The wall only applies to cold traffic.
  const accessTier: ForecastTier = isPaid
    ? "pro"
    : user
      ? "free"
      : ad
        ? tierForWall(ad.wall)
        : "anonymous";
  const [favUpgradeOpen, setFavUpgradeOpen] = useState(false);
  const [reportsUpgradeOpen, setReportsUpgradeOpen] = useState(false);
  // One-shot "pop" when favoriting (not on un-favorite or load) — mirrors the
  // rail SpotCard star interaction exactly, including the free-tier cap.
  const [savePop, setSavePop] = useState(false);
  const handleToggleSaved = async () => {
    const res = await toggleSaved({ isPaid, spotId: spot.id });
    if (res === "signed-out" || res === "at-cap") {
      setFavUpgradeOpen(true);
      return;
    }
    if (res === "saved") {
      setSavePop(true);
      window.setTimeout(() => setSavePop(false), 600);
    }
  };

  // ── loaders ─────────────────────────────────────────────────────────────────
  //
  // Each live block is fetched by a named loader rather than inline in its
  // effect, so the same code runs on mount AND on a pull-to-refresh, and the
  // gesture can await the real request instead of guessing at a duration.
  //
  // Staleness is guarded by comparing the key a request was made for against
  // the one on screen when it lands, rather than by a per-effect `cancelled`
  // flag. A refresh re-enters the same loader, so "has this effect been torn
  // down" was never the question — "is this still the spot and species being
  // read" is.
  const liveKey = useRef({ slug, selId });
  liveKey.current = { slug, selId };

  /**
   * Publish which spot is on screen, so the walls on this page (alerts, the
   * star, the reports panel) report it without every one of them taking a prop
   * for the benefit of a beacon. Named on the way in rather than in an effect,
   * because a tap on a lock can beat a post-paint effect. See
   * @/lib/paywall-context.
   */
  useEffect(() => {
    setPaywallContext({ spotSlug: slug, spotName: spot.name, page: "spot" });
  }, [slug, spot.name]);

  const loadForecast = useCallback(async () => {
    const forSlug = slug;
    await Promise.allSettled([
      fetchForecast14d(forSlug).then((d) => {
        if (liveKey.current.slug === forSlug) setFc(d);
      }),
      fetchPointConditions(spot.lat, spot.lng).then((d) => {
        if (liveKey.current.slug === forSlug) setPoint(d);
      }),
    ]);
  }, [slug, spot.lat, spot.lng]);

  useEffect(() => {
    void loadForecast();
  }, [loadForecast]);

  // Pro-only upgrade of the locked block. The route re-checks entitlement
  // server-side (and unlike the client's `isPaid`, it honours the grace
  // window), so this call is a request, not the gate.
  const loadFresh = useCallback(async () => {
    if (!freshTracked) return;
    // Not paying, and we now know it: show the locked state.
    if (!tierLoading && !isPaid) {
      setFresh({ locked: true });
      return;
    }
    if (!isPaid) return; // still resolving — show nothing rather than a lock
    const forSlug = slug;
    try {
      const d = await fetchFreshCatches(spot.id);
      const mine = d?.spots?.[spot.id];
      if (mine && liveKey.current.slug === forSlug) setFresh(mine);
    } catch {
      // Stays locked — additive, never blocking.
    }
  }, [freshTracked, isPaid, tierLoading, spot.id, slug]);

  useEffect(() => {
    void loadFresh();
  }, [loadFresh]);

  // The written report. Three states, driven by the REQUEST, not by the client
  // tier: "asking" / "not allowed" / "here it is".
  //
  // Gating the upsell on entitlement was wrong, and is why the lock still
  // flashed after the first attempt at this. Entitlement resolves FASTER than
  // the report does — user_settings is one query, the report is a round trip
  // through BlueCaster — so a Pro angler resolved to "not loading, no report
  // yet" and got the upsell painted at them for the few hundred milliseconds in
  // between. The route already answers the only question that matters, so the
  // block waits for it and nothing else.
  //
  // Fired on mount rather than after `isPaid`, because the route is the gate: a
  // free caller gets {locked:true} and no prose.
  const [reports, setReports] = useState<RecentReportsData | null>(null);
  const [reportsLocked, setReportsLocked] = useState<boolean | null>(null);
  const loadReports = useCallback(async () => {
    if (!page.recentReportsTeaser) {
      setReports(null);
      setReportsLocked(null);
      return;
    }
    const forSlug = spot.slug;
    try {
      const { locked, reports: r } = await fetchSpotRecentReports(forSlug);
      if (liveKey.current.slug !== forSlug) return;
      setReportsLocked(locked);
      setReports((r as RecentReportsData | null) ?? null);
    } catch {
      if (liveKey.current.slug === forSlug) setReportsLocked(true);
    }
  }, [page.recentReportsTeaser, spot.slug]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  // Which species the chart on screen is drawn from, so a refresh can refetch
  // without blanking it. Clearing is for a species SWITCH — showing one
  // species' chart under another's name is the thing being avoided, and a
  // refresh of the same species never risks it.
  const scoredSpecies = useRef<string | null>(null);
  const loadScore = useCallback(async () => {
    if (!selId) return;
    const forSpecies = selId;
    if (scoredSpecies.current !== forSpecies) {
      setScore(null);
      scoredSpecies.current = forSpecies;
    }
    try {
      // days=2: /score keys on UTC days, so the spot's local evening lives in
      // the *next* UTC day. Fetch two and let the chart window a full local day.
      const d = await fetchSpotScore(spot.id, forSpecies, 2);
      if (liveKey.current.selId === forSpecies) setScore(d);
    } catch {
      // The chart keeps whatever it had.
    }
  }, [spot.id, selId]);

  useEffect(() => {
    void loadScore();
  }, [loadScore]);

  // ── derived ───────────────────────────────────────────────────────────
  const todayScore = selId ? (page.topScoreTodayBySpecies[selId] ?? null) : null;
  const seasonState = selId
    ? (page.seasonStateBySpecies[selId] ?? null)
    : null;
  const seasonWeeks = selId ? (page.seasonWeeksBySpecies[selId] ?? []) : [];
  const seasonRegWeeks = selId ? (page.regWeeksBySpecies[selId] ?? undefined) : undefined;
  const regulation = page.regulations.find((r) => r.speciesId === selId) ?? null;

  const fcSource = fc ?? page;
  const stripModel = useMemo(
    () =>
      selId && !tierLoading
        ? buildForecastDays(fcSource, selId, accessTier, null, regulation, page.sun)
        : null,
    [fcSource, selId, tierLoading, accessTier, regulation, page.sun],
  );

  const [selectedIso, setSelectedIso] = useState<string | null>(openOnIso);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Which wall the tapped tile belongs to — highlights the matching matrix row.
  const [lockedTier, setLockedTier] = useState<"free" | "pro">("pro");
  const [alertUpgradeOpen, setAlertUpgradeOpen] = useState(false);

  // 14-day strip scroll affordance — overlaid arrows that fade in/out with
  // scroll position, so it's clear there's more to see in either direction.
  const dayStripRef = useRef<HTMLDivElement>(null);
  const [dayStripScrollable, setDayStripScrollable] = useState(false);
  const [dayStripScrolledLeft, setDayStripScrolledLeft] = useState(false);
  useEffect(() => {
    const el = dayStripRef.current;
    if (!el) return;
    const check = () => {
      setDayStripScrollable(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
      setDayStripScrolledLeft(el.scrollLeft > 4);
    };
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [stripModel]);

  // Sign-up gate: signed-out anglers who tap "Set alert" / "Log catch" (or a
  // locked forecast day) are sent through the sign-up flow; the intent drives
  // the modal copy.
  // Switching species is the other click this page is really for, so it feeds
  // the engagement count the same way a day pick does. A wrapper rather than
  // `setSelId` itself, because the raw setter also runs off the initial
  // best-species pick, which nobody clicked.
  const chooseSpecies = useCallback((id: string | null) => {
    noteEngagement("browse", "species_filter");
    setPaywallContext({ speciesId: id ?? undefined });
    setSelId(id);
  }, []);

  const [logCatchOpen, setLogCatchOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  // ── No proactive ask here ────────────────────────────────────────────────
  //
  // This page used to mount the other half of the engagement nag, opening
  // <ProTrialModal feature="whole-map" from="spot-page-nag"> once the shared
  // click count crossed its threshold. It went with the map's copy: 6
  // impressions and no clicks over the same seven days that the map's copy
  // took 27 and got none either, while every wall on this page that somebody
  // walked into on their own still converts.
  //
  // Removing only the map's half would have moved the nag rather than removed
  // it. The count is shared across both surfaces, so the visitor who would
  // have been asked on the map would simply have been asked here instead, on
  // the click that carried them into a spot.
  //
  // The counting below stays. It is not this page's to switch off: /explore
  // reads the same count to decide when the depth gate asks an ad visitor for
  // a free account, and clicks made down here are most of the evidence it has.

  const handleSetAlert = () => {
    // Alerts are Pro-only, so a signed-out tap gets the full trial modal —
    // matrix, cadence, pay-first checkout, free-tier link at its foot — not
    // the slimmer sign-up gate, which exists for the FREE-tier walls.
    if (!user) {
      setAlertUpgradeOpen(true);
      return;
    }
    setAlertOpen(true);
  };

  // Deep-link: `?alert=1` (e.g. the Explore drawer's "Set alert") auto-opens the
  // create-alert modal once auth resolves — signed-out anglers hit the sign-up
  // gate, same as tapping the button. Reads the query client-side (no
  // useSearchParams, so the shell needs no Suspense boundary). Runs once.
  const alertAutoOpened = useRef(false);
  useEffect(() => {
    if (authLoading || alertAutoOpened.current) return;
    if (new URLSearchParams(window.location.search).has("alert")) {
      alertAutoOpened.current = true;
      handleSetAlert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Sharing is open to everyone, signed in or not, so unlike the alert modal
  // this one never waits on auth and never gates.
  const [shareOpen, setShareOpen] = useState(false);
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  // Deep-link: `?share=<token>` is what the alert email's "send it to someone"
  // link carries. The token was minted when the alert fired, so the modal
  // adopts it instead of creating a second card for a day that already has one.
  //
  // Runs ONCE per mount, which is what "open once per alert" means in practice:
  // the link opens the modal, and a reload or a later visit to the bare spot
  // page does not nag again.
  const shareAutoOpened = useRef(false);
  useEffect(() => {
    if (shareAutoOpened.current) return;
    const token = new URLSearchParams(window.location.search).get("share");
    if (!token) return;
    shareAutoOpened.current = true;
    setShareToken(token);
    setShareOpen(true);
  }, []);

  const activeIso = selectedIso ?? stripModel?.days[0]?.iso ?? null;
  const activeIndex =
    stripModel?.days.findIndex((d) => d.iso === activeIso) ?? 0;
  const dayIndex = activeIndex < 0 ? 0 : activeIndex;
  const todayIso = stripModel?.days[0]?.iso ?? null;

  // ── real tidal-current series (per local day, keyed by ISO date) ───────
  // Hourly signed flood/ebb needs today's series for the RIGHT NOW tile and
  // the selected day's for the terminal chart — fetch each day once.
  const [curByIso, setCurByIso] = useState<
    Record<string, (CurrentSample | null)[] | null>
  >({});
  // Ref-guarded (not state-guarded): effect re-runs land before setCurByIso
  // commits, so a state check would re-fetch the same day.
  const curRequested = useRef<Set<string>>(new Set());
  const loadCurrents = useCallback(async () => {
    await Promise.allSettled(
      [...new Set([todayIso, activeIso])].map(async (iso) => {
        if (!iso || curRequested.current.has(iso)) return;
        curRequested.current.add(iso);
        const fromMs = localDayStartUtcMs(iso, TZ);
        // An unparseable day would make every Date below invalid, and
        // `toISOString()` throws RangeError on those.
        if (!Number.isFinite(fromMs)) return;
        const from = new Date(fromMs).toISOString();
        const to = new Date(fromMs + 23 * 3_600_000).toISOString();
        try {
          const d = await fetchCurrentsPoint(spot.lat, spot.lng, from, to);
          const byHour: (CurrentSample | null)[] = new Array(24).fill(null);
          for (const s of d?.series ?? []) {
            const h = Math.round((Date.parse(s.t) - fromMs) / 3_600_000);
            if (h >= 0 && h < 24) byHour[h] = s;
          }
          setCurByIso((m) => ({ ...m, [iso]: byHour }));
        } catch {
          // A day with no currents draws from the tide-derived fallback.
        }
      }),
    );
  }, [todayIso, activeIso, spot.lat, spot.lng, TZ]);

  useEffect(() => {
    void loadCurrents();
  }, [loadCurrents]);

  /**
   * Pull-to-refresh: refetch everything on this page that moves.
   *
   * The prerendered half (the write-up, the species roster, the seasonality
   * bands) is not refetched — it changes on the scale of weeks, and re-running
   * the server render would repaint the whole page to show the same words. The
   * numbers an angler pulls for — score, forecast, conditions, currents,
   * reports, fresh catches — all arrive through these loaders.
   *
   * `curRequested` is the currents cache; it exists so a day is fetched once,
   * which is exactly what a refresh is asking to undo.
   */
  const refresh = useCallback(async () => {
    curRequested.current.clear();
    await Promise.allSettled([
      loadForecast(),
      loadScore(),
      loadCurrents(),
      loadReports(),
      loadFresh(),
    ]);
  }, [loadForecast, loadScore, loadCurrents, loadReports, loadFresh]);

  /**
   * The "auto-refresh 5 min" the sub-header has always claimed.
   *
   * Both ways of refreshing this page go through `runRefresh` — the timer and
   * the pull gesture — so they share one in-flight guard and one clock, and a
   * pull resets the countdown instead of racing it.
   */
  const { run: runRefresh, at: refreshedAt } = useAutoRefresh(
    refresh,
    AUTO_REFRESH_MS,
  );

  const hours24 = useMemo(() => {
    const grid = selId ? fcSource.hourlyScoreGrid[selId] : undefined;
    return grid?.[dayIndex] ?? grid?.[0] ?? new Array(24).fill(null);
  }, [fcSource, selId, dayIndex]);

  // Per-hour arrays for the terminal, for the day being shown.
  const terminalHours = useMemo(
    () =>
      buildTerminalHours(
        fcSource.hourlyConditionsGrid?.[dayIndex] ??
          fcSource.hourlyConditionsGrid?.[0],
        hours24,
      ),
    [fcSource, dayIndex, hours24],
  );

  // Tide min/max across every forecast day, so the terminal's tide scale stays
  // put while flipping days instead of re-fitting to each day's range.
  const tideRange = useMemo(
    () => tideRangeFrom(fcSource.hourlyConditionsGrid),
    [fcSource],
  );

  // Signed flood/ebb current for the selected day — fed to BOTH the terminal
  // chart and the conditions strip, so the strip's current cell is literally
  // the series the chart plots. Null until it arrives (the chart falls back to
  // its tide-derived shape, the strip to point-conditions).
  //
  // A second series pinned to today (`todayCurrent`, off `tideToday` /
  // `todayHoursGrid`) used to exist purely to feed the strip while it was
  // locked to the live hour. The strip follows the scrub now, so that whole
  // chain was dead — and keeping it would have meant a strip that silently
  // disagreed with the chart whenever the angler picked another day.
  const chartCurrent = useMemo(() => {
    const samples = activeIso ? curByIso[activeIso] : null;
    return samples ? signCurrentSeries(samples, terminalHours.tide) : null;
  }, [curByIso, activeIso, terminalHours.tide]);

  // Merge the two fetched UTC days into one hour list; FactorCharts windows it
  // down to the current local day (fills the local evening that day-0 alone drops).
  const scoreEntry = useMemo(() => {
    if (!selId || !score?.days?.length) return undefined;
    const d0 = score.days[0]?.species?.[selId];
    const d1 = score.days[1]?.species?.[selId];
    if (!d0 && !d1) return undefined;
    return {
      best_score: d0?.best_score ?? null,
      best_hour_utc: d0?.best_hour_utc ?? null,
      hours: [...(d0?.hours ?? []), ...(d1?.hours ?? [])],
    };
  }, [score, selId]);

  const handleDay = (day: ForecastDay) => {
    if (day.locked) {
      // No ad-frame branch here any more. It used to scroll to the inline
      // email form, because opening a modal would have put a SECOND way to buy
      // in front of the reader under a different `from`. There is no inline
      // form now, so a locked day on a paid page does what a locked day does
      // everywhere else, and the two paths have collapsed into one.
      setLockedTier(day.lockTier ?? "pro");
      // Every locked day opens the same modal, including the "Become a Member"
      // days 3–7: the free account they unlock is offered by the link at the
      // foot of that modal rather than by a separate sign-up dialog.
      setUpgradeOpen(true);
      return;
    }
    // Only the unlocked branch counts. A locked day opens <ProTrialModal>,
    // which restarts the engagement count on its own.
    noteEngagement("browse", "day_pick");
    setSelectedIso(day.iso);
  };

  // Conditions for the scrubbed hour (falls back to today's grid / now snapshot).
  const condGrid = (fc ?? page).hourlyConditionsGrid;
  const condCell =
    condGrid?.[dayIndex]?.[selectedHour] ??
    condGrid?.[0]?.[selectedHour] ??
    null;
  const tilesSnapshot: RightNowSnapshot | null = condCell
    ? { ...condCell, hourLocal: "" }
    : page.rightNow;
  // ── headline score card (NOW-based, today index 0) ─────────────────────
  // Now / peak / window all derive from today's hourly grid so they stay
  // internally consistent (and match the 14-day strip's today cell).
  const todayHours =
    (selId ? fcSource.hourlyScoreGrid[selId]?.[0] : null) ?? null;
  const nowScore = todayHours?.[nowHour] ?? null;
  let peakScore: number | null = null;
  let peakHourNum: number | null = null;
  (todayHours ?? []).forEach((v, i) => {
    if (v != null && (peakScore == null || v > peakScore)) {
      peakScore = v;
      peakHourNum = i;
    }
  });
  // Memoized so win.window keeps its identity across renders — it feeds the
  // terminal's rebuild effect, and an unstable array would tear the SVG down
  // on every scrub tick (killing an in-flight touch drag).
  const win = useMemo(() => bestWindow(todayHours ?? []), [todayHours]);
  const peakTideTrend =
    peakHourNum != null
      ? (condGrid?.[0]?.[peakHourNum]?.tideTrend ?? null)
      : null;
  const peakTidePhase =
    peakTideTrend === "rising"
      ? "Tide flooding"
      : peakTideTrend === "falling"
        ? "Tide ebbing"
        : null;
  // Seeded from the server so the first render matches, then recomputed once
  // mounted — the two only differ if a DST boundary fell between the moment
  // this HTML was cached and the moment it was loaded.
  const tzAbbrev = useMemo(() => zoneAbbrev(TZ, nowAt), [nowAt, TZ]);
  // Driver species lives only in the status chip up top — keep it out of this
  // label to avoid repeating it across the panel. The card composes its own
  // wording around the time; what it needs from here is the clock.
  const nowTime = `${formatHour12(nowHour)}${tzAbbrev ? ` ${tzAbbrev}` : ""}`;
  const subtitle = spot.region ?? spot.city ?? spot.country ?? "";

  // ── Log-catch context (current spot + live conditions) ─────────────────
  // Minute precision, so it can never be seeded: a cached page is wrong about
  // the minute within 60 seconds of being built. Empty until mounted, then
  // re-derived on each tick so "captured at" reflects when the angler actually
  // logs the catch rather than when the page happened to load.
  const nowTimeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "numeric",
        minute: "2-digit",
      }).format(nowAt),
    [nowAt, TZ],
  );
  const nowTideTrend =
    condGrid?.[0]?.[nowHour]?.tideTrend ?? page.rightNow?.tideTrend ?? null;
  const catchConditions = {
    score: nowScore ?? todayScore,
    tidePhase:
      nowTideTrend === "rising"
        ? "flood"
        : nowTideTrend === "falling"
          ? "ebb"
          : null,
    windKt: page.rightNow?.windKt ?? tilesSnapshot?.windKt ?? null,
    windDir: page.rightNow?.windDir ?? tilesSnapshot?.windDir ?? null,
    waterTempC: page.rightNow?.seaTempC ?? tilesSnapshot?.seaTempC ?? null,
    airTempC: page.rightNow?.airTempC ?? tilesSnapshot?.airTempC ?? null,
    capturedLabel: nowTimeLabel,
  };
  const catchSpot = {
    id: spot.id,
    name: spot.name,
    slug,
    lat: spot.lat,
    lng: spot.lng,
    region: subtitle || spot.region,
  };
  const speciesOptions = species.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
  }));
  const alertSpot = {
    name: spot.name,
    slug,
    lat: spot.lat,
    lng: spot.lng,
    city: spot.city,
    regAreaCode: page.regAreaCode,
  };
  const dailyScores = stripModel?.days?.map((d) => d.score ?? null) ?? [];

  // What this ad view is counted as. City comes from the published directory
  // link (`/fishing/bc/victoria-bc` → `victoria-bc`), which is the same slug
  // the /lp pages report, so a spot ad and a landing-page ad land in
  // comparable rows.
  const adTarget: CampaignTarget | null = ad
    ? {
        landing: "spot",
        target_city: cityLink?.cityPath.split("/").filter(Boolean).pop() ?? "",
        target_spot: slug,
        wall: ad.wall,
        angle: ad.angle,
      }
    : null;
  useCampaignHit(adTarget);

  // The billing region decides the currency (BC bills CAD, WA bills USD).
  //
  // This one DOES follow the breadcrumb city, unlike the regulator above it: a
  // campaign targets a city and bills the reader it brought, while the
  // regulator is a fact about the water. They part company on a spot whose
  // nearest city is across a border — a BC mark on friday-harbor-wa's roster
  // is DFO water sold to a Washington reader in USD, and both of those are
  // right.
  const pills = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Neutral area label — no open/closed claim. Area-level status isn't
          in the payload, and management areas carry in-season closures we
          can't see here; only the per-species pill below is data-driven.
          The area TERM is jurisdictional, not cosmetic: BC's PFMA 10 and
          Washington's Marine Area 10 are different pieces of water. */}
      {page.regAreaCode && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rc-surface text-rc-ink-mute font-rc-mono text-[10px] font-semibold uppercase tracking-[0.06em]">
          {regulator.areaLabel} {page.regAreaCode}
        </span>
      )}
      {regulation && (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.06em] ${
            regulation.status === "Open"
              ? "bg-rc-brand-soft text-rc-brand"
              : (REG_PILL[regulation.status] ?? "bg-rc-surface text-rc-ink-mute")
          }`}
        >
          {selSpecies?.name} · {regulation.status}
        </span>
      )}
    </div>
  );

  return (
    // The document scrolls, not a nested box. A `h-dvh overflow-y-auto` root
    // would put the scrollbar *inside* this element, so the body would centre
    // in a viewport half a scrollbar narrower than the one the fixed top bar
    // measures against — the mark landing a few px right of the spot name.
    // Nothing here listened to that scroller anyway (only the 14-day strip
    // scrolls, horizontally, on its own).
    <div
      className="min-h-dvh bg-rc-panel"
      /* Marks this render as the ad frame for the one piece of app chrome that
         lives OUTSIDE this tree: the mobile tab bar in the root layout. See
         the note in src/app/components/mobile-bottom-nav.tsx for why it is
         done with an attribute and a CSS rule rather than a prop. */
      data-ad-frame={ad ? "" : undefined}
    >
      {/* The spot page is a long read on a phone, so the bar rolls away as you
          head down it and comes back on the first upward flick. The `pt-16`
          below stays put either way — the bar moves, the document does not. */}
      {/* Paid traffic gets a bar with nowhere to go — and, now, one thing to
          press. `adFrame` keeps the mark and the Start free trial button and
          drops every link that is an exit: the nav, search, sign-in and the
          avatar are all ways out of a page that cost money to land on, and
          none of them is the thing the ad promised.

          It replaces AdBrandBar, which carried the mark and nothing else back
          when the offer lived in an email form further down the page. That
          form is gone; this button is the ask.

          No `hideOnScroll` under the frame. Rolling the bar away is the right
          trade on a long read whose nav lives elsewhere, and the wrong one
          when the bar is the only ask on the page.

          `adFrame` also puts it on the BOTTOM edge — see the prop. On this
          page that is the bigger win of the two: a spot page is a long read,
          and a top bar carrying the only button on it is off screen for all of
          it except the first screenful. */}
      {ad ? (
        <ExploreTopBar
          adFrame
          upgradeCta={!isPaid}
          placeName={cityLink?.cityName ?? spot.city ?? undefined}
        />
      ) : (
        <ExploreTopBar hideOnScroll />
      )}

      {/* Pull down from the top of the page to refetch the live numbers. Sits
          outside the flow — it draws a floating indicator and nothing else, so
          nothing below it shifts. */}
      <PullToRefresh onRefresh={runRefresh} />

      {/* `pt-16` clears the fixed bar at the top; the ad frame's bar is at the
          bottom instead, so the document starts at the top edge and ends one
          bar-height short of the bottom. `--rc-ad-bar-h` carries the device
          safe area, which a bare `pb-16` would not. */}
      <div className={ad ? "pb-[var(--rc-ad-bar-h)]" : "pt-16"}>
        {/* Desktop sub-header: breadcrumb + freshness. Full-bleed rule, inner
            row on the page measure — so "Back to map" starts on the same
            gridline as the spot name below it, and the freshness stamp ends on
            the same one as the map's right edge. */}
        {/* Not merely hidden: a display:none link is still in the document,
            still a tab stop, and still an exit. On an ad page it does not
            exist. */}
        {!ad && (
        <div className="hidden lg:block border-b border-rc-rule">
          <div
            className={`${PAGE_MEASURE} flex flex-wrap items-center justify-between gap-2 py-3`}
          >
            <div className="flex items-center gap-2 font-rc-mono text-[11px] text-rc-ink-mute">
              <Link
                href="/explore"
                className="flex items-center gap-1 text-rc-brand hover:underline"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back to map
              </Link>
              <span className="text-rc-rule">·</span>
              {/* Real anchors up the hierarchy, not prose. This used to render
                  the country › region › city trail as plain text, which left
                  every spot page linking only sideways to /explore — nothing
                  pointed back at the city page that should rank for it. */}
              <nav aria-label="Breadcrumb" className="min-w-0 truncate">
                {cityLink ? (
                  <>
                    {/* Country is a label, not a link — there is no
                        /fishing/<country> route to point it at. It still leads
                        the trail so a US spot reads "USA › Washington › …"
                        rather than opening on a state name with no context. */}
                    {cityLink.countryName}
                    {" › "}
                    <Link
                      href={cityLink.provincePath}
                      className="hover:text-rc-ink transition-colors"
                    >
                      {cityLink.provinceName}
                    </Link>
                    {" › "}
                    <Link
                      href={cityLink.cityPath}
                      className="hover:text-rc-ink transition-colors"
                    >
                      {cityLink.cityName}
                    </Link>
                    {" › "}
                  </>
                ) : (
                  <>
                    {/* No published city to link up to. Same shape, from the
                        spot's own flat address — `spot.country` arrives as the
                        formal name ("United States"), so it gets the same
                        display mapping the linked branch already applied. */}
                    {[
                      spot.country ? countryDisplayName(spot.country) : null,
                      spot.region,
                      spot.city,
                    ]
                      .filter(Boolean)
                      .join(" › ")}
                    {" › "}
                  </>
                )}
                <span className="text-rc-ink-soft" aria-current="page">
                  {spot.name}
                </span>
              </nav>
            </div>
            <div className="flex items-center gap-1.5 font-rc-mono text-[10px] text-rc-ink-mute uppercase tracking-[0.08em]">
              <span className="w-1.5 h-1.5 rounded-full bg-rc-good" />
              Live · auto-refresh 5 min
              {/* Only after a refresh has actually run. Rendering a time on
                  first paint would be a hydration mismatch on a page served
                  from the ISR cache, and a claim about freshness that the
                  cached HTML is in no position to make. */}
              {refreshedAt && <> · updated {formatClock(refreshedAt, TZ)}</>}
            </div>
          </div>
        </div>
        )}

        {/* Body: single stack on mobile, two columns on desktop */}
        {/* Single top-to-bottom reading order (conclusion-first). A desktop-
            width column (not a narrow prose measure — this is a data page);
            list/prose sub-content caps its own width so it doesn't stretch. */}
        {/* `overflow-x-clip` is what lets the phone map bleed past this
            gridline. It hangs off the grid cell with a negative margin, and a
            grid item is `min-width: auto`, so without the clip the extra width
            grows the track and the whole document picks up a horizontal
            scrollbar — the top bar's CTA drifting off the right edge is how it
            shows up. `clip`, not `hidden`: `hidden` would make this a scroll
            container and break `position: sticky` for everything inside it. */}
        <div className={`${PAGE_MEASURE} overflow-x-clip py-4 lg:py-6 space-y-8`}>
          {/* 1–3 · Identity + score cluster. ScoreCard already carries the
              Best Window callout (item 2) and the DFO reg strip (item 3). */}
          <div className="space-y-5">
            {/* 1 · Spot header — name reads first, it's the spot's identity. */}
            <div>
                {pills}
                <div className="flex items-center gap-2 mt-3">
                  <h1 className="rc-title-lg text-3xl lg:text-4xl min-w-0">
                    {spot.name}
                  </h1>
                  {/* Save, home spot and alerts all act on an ACCOUNT. On a
                      cold ad click there is no account, so each one is a
                      modal in front of someone who has not yet seen what
                      they would be signing up for. The page's single ask is
                      the form at the wall. */}
                  {!ad && (
                    <>
                    <button
                      type="button"
                      onClick={handleToggleSaved}
                      aria-pressed={saved}
                      aria-label={saved ? "Remove from saved spots" : "Save spot"}
                      className="group shrink-0 p-1.5 rounded hover:bg-rc-badge/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand transition-colors"
                    >
                      <svg
                        viewBox="0 0 42 40"
                        aria-hidden
                        className={`w-[22px] h-[21px] origin-center transition-[fill] duration-200 ${
                          saved
                            ? "fill-rc-badge"
                            : "fill-rc-ink-mute group-hover:fill-rc-badge"
                        } ${savePop ? "animate-fav-pop" : ""}`}
                      >
                        <path d="M21,34 L10.4346982,39.5545079 C8.47875732,40.5828068 7.19697214,39.6450119 7.56952871,37.4728404 L9.5873218,25.7082039 L1.03981311,17.3764421 C-0.542576313,15.8339937 -0.0467737017,14.3251489 2.13421047,14.0082334 L13.946577,12.2917961 L19.2292279,1.58797623 C20.2071983,-0.393608322 21.7954064,-0.388330682 22.7707721,1.58797623 L28.053423,12.2917961 L39.8657895,14.0082334 C42.0525979,14.3259953 42.5383619,15.8381017 40.9601869,17.3764421 L32.4126782,25.7082039 L34.4304713,37.4728404 C34.8040228,39.6508126 33.5160333,40.5800681 31.5653018,39.5545079 L21,34 Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={toggleHome}
                      aria-pressed={isHome}
                      aria-label={isHome ? "Remove as home spot" : "Set as home spot"}
                      title={isHome ? "Your home spot" : "Set as home spot"}
                      className="group shrink-0 p-1.5 rounded hover:bg-rc-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand transition-colors"
                    >
                      <Home
                        className={`w-5 h-5 transition-colors ${
                          isHome
                            ? "text-rc-brand fill-rc-brand/15"
                            : "text-rc-ink-mute group-hover:text-rc-brand"
                        }`}
                        strokeWidth={isHome ? 2.4 : 2}
                      />
                    </button>
                    {/* Alerts are a page-level action on the spot, not a
                        property of the score, so the CTA sits with the identity
                        row rather than buried under the score card. ml-auto keeps
                        it hard right without disturbing the name/star/home group. */}
                    <button
                      type="button"
                      onClick={handleSetAlert}
                      /* The label collapses to the bell on narrow screens, so the
                         button needs its own accessible name or it announces as
                         nothing to a screen reader. */
                      aria-label="Set alert"
                      title="Set alert"
                      className="ml-auto shrink-0 flex items-center gap-2 rounded border border-rc-brand px-3 py-2 text-rc-brand hover:bg-rc-brand-soft text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand transition-colors"
                    >
                      <Bell className="w-4 h-4" aria-hidden />
                      <span className="hidden sm:inline">Set alert</span>
                    </button>
                    {/* Share needs no account, so it sits outside the sign-up
                        walls the other actions carry. */}
                    <button
                      type="button"
                      onClick={() => {
                        setShareToken(null);
                        setShareOpen(true);
                      }}
                      aria-label="Share this spot"
                      title="Share this spot"
                      className="shrink-0 flex items-center gap-2 rounded border border-rc-line-strong px-3 py-2 text-rc-ink hover:bg-rc-surface text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand transition-colors"
                    >
                      <Share2 className="w-4 h-4" aria-hidden />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                    </>
                  )}
                </div>
                <p className="font-rc-mono text-xs text-rc-ink-mute mt-1.5">
                  {`${Math.abs(spot.lat).toFixed(2)}°${
                    spot.lat >= 0 ? "N" : "S"
                  } · ${Math.abs(spot.lng).toFixed(2)}°${
                    spot.lng >= 0 ? "E" : "W"
                  }`}
                </p>
              </div>

            {/* The pin, said out loud. Sits under the identity rather than
                above it — the angler should read WHICH spot this is before
                being asked to claim it — and renders nothing until it is
                earned, which is most of the time for most people. Suppressed
                on an ad landing for the same reason the star and the house
                are: one ask per cold visit. */}
            {!ad && (
              <HomeSpotOffer
                slug={spot.slug}
                name={spot.name}
                homeReady={homeReady}
                homeSlug={homeSlug}
                signedIn={!authLoading && !!user}
              />
            )}

            {/* Species switcher drives every score below — pick first. */}
            {species.length > 1 && (
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <div className="rc-label text-[9px]">Species</div>
                  <div className="font-rc-mono text-[10px] text-rc-ink-mute italic">
                    tap to switch species
                  </div>
                </div>
                <SpeciesCardRow
                  species={species}
                  scores={page.topScoreTodayBySpecies}
                  hourlyScoreGrid={fcSource.hourlyScoreGrid}
                  regulations={page.regulations}
                  selectedId={selId}
                  onSelect={chooseSpecies}
                />
              </div>
            )}

            {/* Score info (left) beside the map (right) — a two-column band for
                verdict + orientation. Stacks on mobile with the score first. */}
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
              <div className="order-2">
                <SpotMiniMap
                  spot={spot}
                  /* Unscrubbed, the day's best — matching the headline above it
                     and the day strip below it. It used to be the live hour, so
                     a page reading "Best score for the day 89" carried a puck
                     reading 33, and the two numbers were about different
                     questions with nothing on screen saying so.

                     Once the angler pins an hour it follows that hour instead,
                     because the map's time bar is then on screen naming it. The
                     old mismatch was an unlabelled number disagreeing with the
                     headline; this one is answering the question the reader
                     just asked, with the clock right underneath it. */
                  score={
                    scrubbed
                      ? (hours24?.[selectedHour] ?? null)
                      : (peakScore ?? todayScore)
                  }
                  timeIso={
                    activeIso ? zonedHourToUtcIso(activeIso, selectedHour, TZ) : null
                  }
                  hours={{
                    hour: selectedHour,
                    onSelectHour: selectHour,
                    nowHour,
                    isToday: dayIndex === 0,
                    scrubbed,
                    onNow: clearScrub,
                    dayLabel:
                      dayIndex === 0
                        ? null
                        : (stripModel?.days[dayIndex]?.dow ?? null),
                    scores: hours24,
                    wind: terminalHours.wind,
                    gust: terminalHours.gust,
                    windDir: terminalHours.windDir,
                    current: chartCurrent,
                    sun: page.sun,
                  }}
                  hideExploreLink={!!ad}
                />
              </div>
              {/* 2 · Best Window + 3 · DFO reg strip. The fresh-catch evidence
                  and the alert CTA both used to live in here; they moved out to
                  the full-width reports band and the identity row respectively,
                  so this card is now purely the score verdict. */}
              <div className="order-1">
                <ScoreCard
                  adFrame={!!ad}
                  nowTime={nowTime}
                  nowIsPeak={peakHourNum === nowHour}
                  score={nowScore}
                  peak={peakScore ?? todayScore}
                  peakTime={fmtPeak(peakHourNum)}
                  windowLabel={win.label}
                  windowPeak={peakScore ?? todayScore}
                  tidePhase={peakTidePhase}
                  dfoArea={page.regAreaCode}
                  regulator={regulator}
                  speciesName={selSpecies?.name ?? null}
                  regulation={regulation}
                />
              </div>
            </div>

            {/* Reports, full width under the score/map row. It was two panels
                inside the columns before: the counts were cramped and the
                narrative left a tall gap beside the map. Full width also lets
                the three columns (here / what worked / nearby) sit side by side
                instead of stacking. */}
            <RecentReportsBand
              teaser={page.recentReportsTeaser}
              updatedAt={page.recentReportsUpdatedAt}
              /* null while the request is in flight. The upsell only appears
                 once the server has actually said no. */
              locked={reportsLocked}
              reports={reports}
              fresh={fresh}
              days={FRESH_DAYS}
              onUpgrade={() => setReportsUpgradeOpen(true)}
              neutralLock={!!ad}
            />
          </div>
          {/* end identity + score cluster (items 1–3) */}

          {/* 4 · 14-day forecast */}
          <div className="border-t border-rc-rule pt-8">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div className="rc-label text-[9px]">14-Day Forecast</div>
              <span className="font-rc-mono text-[10px] text-rc-ink-mute italic shrink-0">
                Data from: ECMWF + GFS + BlueCaster
              </span>
            </div>
            <div className="relative">
              {/* pt-2: the BEST badge sits at -top-1.5, and overflow-x-auto
                  clips the y-axis — the top padding keeps it inside the box. */}
              <div
                ref={dayStripRef}
                className="flex gap-1.5 h-[124px] pt-2 overflow-x-auto scrollbar-hide"
              >
                {(stripModel?.days ?? []).map((day) => (
                  <div key={day.index} className="flex-1 min-w-[54px] flex">
                    <DayCell
                      day={day}
                      selected={day.iso === activeIso}
                      onSelect={() => handleDay(day)}
                      neutralLock={!!ad}
                    />
                  </div>
                ))}
              </div>
              <div
                aria-hidden
                className={`pointer-events-none absolute right-0 top-2 bottom-0 w-10 flex items-center justify-end pr-0.5 bg-gradient-to-l from-rc-panel to-transparent transition-opacity duration-200 ${
                  dayStripScrollable ? "opacity-100" : "opacity-0"
                }`}
              >
                <ChevronRight className="w-4 h-4 text-rc-ink-mute" />
              </div>
              <div
                aria-hidden
                className={`pointer-events-none absolute left-0 top-2 bottom-0 w-10 flex items-center justify-start pl-0.5 bg-gradient-to-r from-rc-panel to-transparent transition-opacity duration-200 ${
                  dayStripScrolledLeft ? "opacity-100" : "opacity-0"
                }`}
              >
                <ChevronLeft className="w-4 h-4 text-rc-ink-mute" />
              </div>
            </div>
            {/* The inline email ask used to sit here, directly under the
                locked days, with a second copy at the foot of the page. Both
                are gone: the ad frame has ONE ask now, the Start free trial
                button in the bar, which opens the same trial modal every other
                CTA in the product opens. Two ways to buy on one page is two
                conversion paths to reason about and two `from` values in the
                funnel, for a page whose whole design is to have one. */}
          </div>

          {/* 5 · 24-hour graph, with the conditions strip as its readout */}
          <div id="conditions-24h" className="scroll-mt-20 border-t border-rc-rule pt-8">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div>
                <h3 className="rc-label text-[10px]">24-Hour Conditions</h3>
                <p className="font-rc-mono text-[11px] text-rc-ink-soft mt-1">
                  {tzAbbrev ? `All times ${tzAbbrev}` : "Local time"}
                </p>
              </div>
              <p className="font-rc-mono text-[10px] text-rc-ink-mute italic">
                <span className="lg:hidden">Tap or drag to read any hour</span>
                <span className="hidden lg:inline">Hover or drag to read any hour</span>
              </p>
            </div>
            {/* The graph's readout. Every prop is the SELECTED day + hour and
                comes from the same series the chart draws, so scrubbing moves
                these numbers and the two can never disagree. `tilesSnapshot` is
                already the scrubbed hour's cell; `hours24` is the score row the
                chart paints; `chartCurrent` is the signed series it plots. */}
            {/* Inset to the chart's band boxes so the strip's edges land on
                theirs. The terminal renders its SVG 1:1 (viewBox width = CSS
                width), so its gutters are constant CSS px, not fractions:
                bands start 6px in and stop 20px short of the right on desktop,
                0.5px/10px on the mobile variant — and the lg breakpoint is
                exactly where the two SVGs swap. Measured, not guessed. */}
            {/* Pinned on phones. The strip IS the graph's readout, and the
                graph is ~600px tall on a device with 660px of viewport, so a
                readout that scrolls with it is off screen for most of the
                scrub: a finger on the WIND row was moving numbers sitting 600px
                above the top of the phone. Sticky keeps them under the thumb
                for the whole gesture and costs nothing on desktop, where the
                hover pill already follows the cursor.

                `top-0` because nothing on this route is fixed to the top of the
                viewport. The bleed margins put the opaque backdrop under the
                page gutter as well as the content, so the chart does not show
                through beside it while it is pinned — and they are safe inside
                the body's `overflow-x-clip`, which is deliberately `clip` and
                not `hidden` precisely so sticky still works in here. */}
            <div className="mt-5 max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:-mx-4 max-lg:px-4 sm:max-lg:-mx-6 sm:max-lg:px-6 max-lg:pb-2 max-lg:bg-rc-panel">
              <div className="ml-[0.5px] mr-[10px] lg:ml-[6px] lg:mr-[20px]">
                <CurrentConditionsStrip
                  rightNow={tilesSnapshot}
                  score={hours24?.[selectedHour] ?? null}
                  currentSigned={chartCurrent}
                  currentSample={
                    (activeIso ? curByIso[activeIso]?.[selectedHour] : null) ?? null
                  }
                  point={point}
                  hour={selectedHour}
                  isNow={dayIndex === 0 && selectedHour === nowHour}
                />
              </div>
            </div>
            <SpotTerminal
              hours={terminalHours}
              realCurrent={chartCurrent}
              tideRange={tideRange}
              sun={page.sun}
              /* Only today has a "now" on its axis. */
              nowHour={dayIndex === 0 ? nowHour : null}
              selectedHour={selectedHour}
              onSelectHour={selectHour}
              bestWindow={win.window}
            />
            {/* Sells the days a viewer can't see — so it has no business on a
                Pro account, which already has all 14. Held until `tierLoading`
                clears (isPaid starts `false`), same as the day strip, so a Pro
                viewer never gets a flash of the upsell they already bought. */}
            {/* The ad page already carries the ask twice, in a form that
                takes an email rather than opening a dialog, so a third
                button into a modal is a competing offer on the same page. */}
            {!ad && scoreEntry && !tierLoading && !isPaid && (
              <button
                type="button"
                onClick={() => setUpgradeOpen(true)}
                className="mt-4 w-full flex items-center justify-start gap-2 rounded bg-rc-brand-soft text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.04em] px-4 py-3 hover:bg-rc-brand-soft/70 transition-colors"
              >
                <ArrowUpCircle className="w-4 h-4" />
                Upgrade to Pro for the full 14-day outlook
              </button>
            )}
          </div>

          {/* 7 · Score Explained */}
          <div className="border-t border-rc-rule pt-8">
            <ScoreFactors factors={selId ? (page.todayFactorsBySpecies[selId] ?? []) : []} />
          </div>

          {/* Renders nothing for Pro, and nothing until tier resolves. Placed
              after the forecast reasoning rather than among it — everything
              above this line is what the reader came for. */}
          {/* Never on paid traffic. Paying for a click and then showing that
              visitor somebody else's ad is renting out the attention we just
              bought, at a fraction of what it cost. */}
          {!ad && <AdSlot placement="spotMid" className="border-t border-rc-rule pt-8" />}

          {/* Current regulations — the limits in effect for the active species
              (daily limit / size / gear), broken out. */}
          {selSpecies && page.regulations.length > 0 && (
            <div className="border-t border-rc-rule pt-8">
              <CurrentRegulations
                adFrame={!!ad}
                regulations={page.regulations}
                selectedId={selId}
                areaCode={page.regAreaCode}
                regulator={regulator}
                syncedAt={page.regSyncedAt}
                nowMs={nowAt.getTime()}
              />
            </div>
          )}

          {/* 8 · Seasonality */}
          {selSpecies && seasonWeeks.length > 0 && (
            <div className="border-t border-rc-rule pt-8">
              <SeasonalityStrip
                speciesName={selSpecies.name}
                weeks={seasonWeeks}
                regWeeks={seasonRegWeeks}
                state={seasonState ?? seasonWeeks[page.todayWeek] ?? "nodata"}
                todayWeek={page.todayWeek}
                nextOpenDate={regulation?.nextOpenDate ?? null}
                nextOpenSummary={regulation?.nextOpenSummary ?? null}
              />
            </div>
          )}

          {/* 9 · Spot profile — reference material (depth/structure/launch/
              peak), below the forecast reasoning. Map lives in the top band. */}
          <div className="border-t border-rc-rule pt-8">
            <SpotProfile spot={spot} seasonState={seasonState} />
          </div>

          {/* 10 · Neighbouring spots. A list of ways off the page the ad paid
              for, and off the spot the ad named. */}
          {!ad && (
            <div className="border-t border-rc-rule pt-8">
              <NeighbourSpots spots={page.nearbySpots} regulator={regulator} />
            </div>
          )}

          {/* 11 · Description + the SEO/hierarchy trail. */}
          <div className="border-t border-rc-rule pt-8 space-y-6">
            {spot.seoIntro && (
              <p className="rc-body text-rc-ink-soft leading-relaxed">
                {spot.seoIntro}
              </p>
            )}
            {!ad && (
              <CustomAlertCta spotName={spot.name} onCreateAlert={handleSetAlert} />
            )}
            {/* Runs in the document flow at every width (the desktop breadcrumb
                is hidden on mobile), keeping the spot → city → province edges
                present for readers and crawlers. */}
            {!ad && cityLink && (
              <p className="text-sm text-rc-ink-soft">
                {spot.name} is one of the spots we track around{" "}
                <Link
                  href={cityLink.cityPath}
                  className="text-rc-brand font-medium hover:underline"
                >
                  {cityLink.cityName}
                </Link>
                . See every scored spot in{" "}
                <Link
                  href={cityLink.provincePath}
                  className="text-rc-brand font-medium hover:underline"
                >
                  {cityLink.provinceName}
                </Link>
                .
              </p>
            )}
            {!ad && (
              <p className="text-sm text-rc-ink-soft">
                Looking for the full interactive map?{" "}
                <Link href="/explore" className="text-rc-brand font-medium hover:underline">
                  Open Explore
                </Link>
                .
              </p>
            )}

            {/* Everything above this line is derived from something we scraped
                or worked out. The reader is the only one here who has actually
                stood at the place, so the last thing the page says is an offer
                to be corrected.

                Kept out of the ad frame with the rest of the outbound links: a
                campaign page asks for one thing. */}
            {!ad && (
              <p className="text-sm text-rc-ink-soft">
                Something look wrong on this page?{" "}
                <button
                  type="button"
                  onClick={() => setReportIssueOpen(true)}
                  className="text-rc-brand font-medium hover:underline"
                >
                  Tell us and we will check it
                </button>
                .
              </p>
            )}
          </div>

          {/* Last thing above the footer — after the description and the
              hierarchy trail, so the crawlable copy and the outbound city /
              province links stay ahead of it. */}
          {!ad && <AdSlot placement="spotFoot" className="border-t border-rc-rule pt-8" />}
        </div>
      </div>

      {/* The marketing footer is a sitemap. On an ad page it is forty ways to
          leave, printed under the one thing we asked the reader to do — so the
          ad frame ends with no footer at all.
          It used to keep a legal-only one (terms, privacy, support), on the
          reasoning that a page which takes a card has to reach them. It no
          longer takes one: the card is taken in the trial modal, which carries
          its own terms and its own links to them, at the moment they are
          actually being agreed to. Three links under the fold were never where
          "clear and conspicuous" was being satisfied. */}
      {!ad && <MarketingFooter />}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        variant={!user && lockedTier === "free" ? "signup" : "pro"}
        spotName={spot.name}
        // The headline names the spot; the reports line names the city it is
        // in, because that is the grain reports are written at.
        cityName={cityLink?.cityName ?? spot.city ?? undefined}
      />

      <LogCatchDialog
        open={logCatchOpen}
        onOpenChange={setLogCatchOpen}
        spot={catchSpot}
        conditions={catchConditions}
        speciesOptions={speciesOptions}
        initialSpeciesId={selId}
      />

      <CreateAlertDialog
        open={alertOpen}
        onOpenChange={setAlertOpen}
        spot={alertSpot}
        speciesOptions={speciesOptions}
        initialSpeciesId={selId}
        dailyScores={dailyScores}
        onUpgradeRequired={() => setAlertUpgradeOpen(true)}
      />

      {reportIssueOpen && (
        <ReportIssueDialog
          open={reportIssueOpen}
          onOpenChange={setReportIssueOpen}
          slug={slug}
          spotName={spot.name}
          surface="spot_page"
        />
      )}

      <ShareCardDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        slug={slug}
        speciesId={selId}
        targetDate={selectedIso}
        existingToken={shareToken}
      />

      <ProTrialModal
        open={alertUpgradeOpen}
        onOpenChange={setAlertUpgradeOpen}
        feature="alerts"
        from="spot-page"
        spotName={spot.name}
      />

      <ProTrialModal
        open={favUpgradeOpen}
        onOpenChange={setFavUpgradeOpen}
        feature="favorite-spots"
        from="spot-page"
        spotName={spot.name}
      />
      <ProTrialModal
        open={reportsUpgradeOpen}
        onOpenChange={setReportsUpgradeOpen}
        feature="catch-reports"
        from="spot-page-reports"
      />
    </div>
  );
}
