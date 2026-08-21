"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowUpCircle, ChevronLeft, ChevronRight, Home, Bell } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import AdSlot from "@/app/components/ads/ad-slot";
import { countryDisplayName, provinceCodeFromName, regulatorFor } from "@/lib/regions";
import ExploreTopBar from "../../components/explore-top-bar";
import DayCell from "../../components/day-cell";
import { bestWindow } from "../../components/hourly-bars";
import UpgradeDialog from "../../components/upgrade-dialog";
import { fmtPeak, zonedHourToUtcIso, zoneAbbrev } from "../../lib/explore-data";
import { useSpotClock } from "../../lib/use-spot-clock";
import { formatHour12 } from "@/lib/time-format";
import {
  buildForecastDays,
  type ForecastDay,
  type ForecastTier,
} from "../../lib/forecast-strip";
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
} from "../../lib/current-series";
import type {
  SpotPageInitial,
  Forecast14dPayload,
  SpotScorePayload,
  PointConditions,
  RightNowSnapshot,
} from "@/lib/bluecaster/live-spot-types";
import SpeciesCardRow from "../components/species-card-row";
import SpotProfile from "../components/spot-profile";
import NeighbourSpots from "../components/neighbour-spots";
import SeasonalityStrip from "../components/seasonality-strip";
import CurrentConditionsStrip from "../components/current-conditions-strip";
import CurrentRegulations from "../components/current-regulations";
import ScoreFactors from "../components/score-factors";
import { useFavorite } from "../../lib/use-favorite";
import { useHomeSpot } from "../../lib/use-home-spot";
import { resolveSea } from "../../lib/sea-state";
import SpotTerminal from "../components/spot-terminal";
import SpotMiniMap from "../components/spot-mini-map";
import ScoreCard from "../components/score-card";
import { RecentReportsBand } from "@/app/explore/components/recent-reports";
import type { RecentReports as RecentReportsData } from "@/lib/bluecaster/live-spot-types";
import type { RailFreshCatch } from "@/app/explore/lib/fresh-catch-types";
import CustomAlertCta from "../components/custom-alert-cta";
import AdTrialCta from "../components/ad-trial-cta";
import { AdBrandBar, AdFooter } from "../components/ad-brand-bar";
import {
  useCampaignHit,
  type CampaignTarget,
} from "@/app/lp/_shared/lp-telemetry";
import type { AdMode, AdWall } from "./ad-mode";
import MarketingFooter from "@/app/components/marketing/marketing-footer";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";
import LogCatchDialog from "../components/log-catch-dialog";
import CreateAlertDialog from "../components/create-alert-dialog";

const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

/** Catch-report window. Matches FRESH_DAYS in the fresh-catches route. */
const FRESH_DAYS = 21;

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
}) {
  const { spot } = page;
  // Which fisheries authority governs this spot. `spot.region` is the
  // province/state ("Washington"); the linked breadcrumb's province name is
  // the same value when a published city owns the spot.
  const regulator = regulatorFor(cityLink?.provinceName ?? spot.region);
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

  const species = useMemo(
    () => [...page.species].sort((a, b) => a.rank - b.rank),
    [page.species],
  );
  const [selId, setSelId] = useState<string | null>(() => bestSpeciesId(page));
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
  const [isHome, toggleHome] = useHomeSpot(spot.slug);
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

  useEffect(() => {
    let cancelled = false;
    fetchForecast14d(slug)
      .then((d) => !cancelled && setFc(d))
      .catch(() => {});
    fetchPointConditions(spot.lat, spot.lng)
      .then((d) => !cancelled && setPoint(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug, spot.lat, spot.lng]);

  // Pro-only upgrade of the locked block. The route re-checks entitlement
  // server-side (and unlike the client's `isPaid`, it honours the grace
  // window), so this call is a request, not the gate.
  useEffect(() => {
    if (!freshTracked) return;
    // Not paying, and we now know it: show the locked state.
    if (!tierLoading && !isPaid) {
      setFresh({ locked: true });
      return;
    }
    if (!isPaid) return; // still resolving — show nothing rather than a lock
    let cancelled = false;
    fetchFreshCatches(spot.id)
      .then((d) => {
        const mine = d?.spots?.[spot.id];
        if (!cancelled && mine) setFresh(mine);
      })
      .catch(() => {
        // Stays locked — additive, never blocking.
      });
    return () => {
      cancelled = true;
    };
  }, [freshTracked, isPaid, tierLoading, spot.id]);

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
  useEffect(() => {
    if (!page.recentReportsTeaser) {
      setReports(null);
      setReportsLocked(null);
      return;
    }
    let cancelled = false;
    fetchSpotRecentReports(spot.slug)
      .then(({ locked, reports: r }) => {
        if (cancelled) return;
        setReportsLocked(locked);
        setReports((r as RecentReportsData | null) ?? null);
      })
      .catch(() => {
        if (!cancelled) setReportsLocked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [page.recentReportsTeaser, spot.slug]);

  useEffect(() => {
    if (!selId) return;
    let cancelled = false;
    setScore(null);
    // days=2: /score keys on UTC days, so the spot's local evening lives in the
    // *next* UTC day. Fetch two and let the chart window a full local day.
    fetchSpotScore(spot.id, selId, 2)
      .then((d) => !cancelled && setScore(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [spot.id, selId]);

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

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  /** Ad frame: send every "unlock this" gesture to the one offer on the page. */
  const scrollToOffer = () => {
    document
      .getElementById("ad-offer")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
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
  const [logCatchOpen, setLogCatchOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

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
  useEffect(() => {
    for (const iso of new Set([todayIso, activeIso])) {
      if (!iso || curRequested.current.has(iso)) continue;
      curRequested.current.add(iso);
      const fromMs = localDayStartUtcMs(iso, TZ);
      // An unparseable day would make every Date below invalid, and
      // `toISOString()` throws RangeError on those.
      if (!Number.isFinite(fromMs)) continue;
      const from = new Date(fromMs).toISOString();
      const to = new Date(fromMs + 23 * 3_600_000).toISOString();
      fetchCurrentsPoint(spot.lat, spot.lng, from, to)
        .then((d) => {
          const byHour: (CurrentSample | null)[] = new Array(24).fill(null);
          for (const s of d?.series ?? []) {
            const h = Math.round((Date.parse(s.t) - fromMs) / 3_600_000);
            if (h >= 0 && h < 24) byHour[h] = s;
          }
          setCurByIso((m) => ({ ...m, [iso]: byHour }));
        })
        .catch(() => {});
    }
  }, [todayIso, activeIso, spot.lat, spot.lng, TZ]);

  const hours24 = useMemo(() => {
    const grid = selId ? fcSource.hourlyScoreGrid[selId] : undefined;
    return grid?.[dayIndex] ?? grid?.[0] ?? new Array(24).fill(null);
  }, [fcSource, selId, dayIndex]);

  // Per-hour arrays for the terminal, for the day being shown.
  const terminalHours = useMemo(() => {
    const g =
      fcSource.hourlyConditionsGrid?.[dayIndex] ??
      fcSource.hourlyConditionsGrid?.[0] ??
      [];
    const pick = (
      key:
        | "tideM"
        | "windKt"
        | "windGustKt"
        | "windDirDeg"
        | "waveM"
        | "cloudPct"
        | "precipMm"
        | "airTempC",
    ) =>
      Array.from(
        { length: 24 },
        (_, i) => (g[i]?.[key] ?? null) as number | null,
      );
    // Sea state falls back to a wind-derived estimate hour by hour: the wave grid
    // has dry-land cells (Point Robinson never gets a wave height at all) and its
    // wave partition also runs out around day 10, which used to blank the row.
    // `seaEst` flags which hours are inferred so the chart can say so.
    const wind = pick("windKt");
    const gust = pick("windGustKt");
    const seaRead = Array.from({ length: 24 }, (_, i) =>
      resolveSea(g[i]?.waveM ?? null, wind[i], gust[i]),
    );
    return {
      score: hours24,
      tide: pick("tideM"),
      wind,
      gust,
      windDir: pick("windDirDeg"),
      sea: seaRead.map((r) => r?.m ?? null),
      seaEst: seaRead.map((r) => r?.estimated ?? false),
      cloud: pick("cloudPct"),
      precip: pick("precipMm"),
      air: pick("airTempC"),
    };
  }, [fcSource, dayIndex, hours24]);

  // Tide min/max across every forecast day, so the terminal's tide scale stays
  // put while flipping days instead of re-fitting to each day's range.
  const tideRange = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const day of fcSource.hourlyConditionsGrid ?? []) {
      for (const h of day ?? []) {
        const t = h?.tideM;
        if (typeof t === "number" && Number.isFinite(t)) {
          if (t < min) min = t;
          if (t > max) max = t;
        }
      }
    }
    return min <= max ? { min, max } : null;
  }, [fcSource]);

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
      // On an ad page the offer is already on the page, in a form that takes
      // an email. Opening a modal instead would put a SECOND way to buy in
      // front of the reader, attributed to a different `from`, which is
      // exactly the comparison the wall test is trying to make.
      if (ad) {
        scrollToOffer();
        return;
      }
      setLockedTier(day.lockTier ?? "pro");
      // Every locked day opens the same modal, including the "Sign up free"
      // days 3–7: the free account they unlock is offered by the link at the
      // foot of that modal rather than by a separate sign-up dialog.
      setUpgradeOpen(true);
      return;
    }
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
  // Driver species lives only in the status chip up top — keep it out of the
  // NOW label to avoid repeating it across the panel.
  const nowLabel = `NOW · ${formatHour12(nowHour)}${tzAbbrev ? ` ${tzAbbrev}` : ""}`;
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

  // The billing region decides the currency (BC bills CAD, WA bills USD), and
  // comes from the same province that decides the regulator printed above it,
  // so the price and the copy cannot disagree about which country the reader
  // is in.
  const adRegion = ad
    ? (provinceCodeFromName(cityLink?.provinceName ?? spot.region ?? "") ?? "")
    : "";

  // Rendered twice: once at the wall, where the locked days are visible and
  // the ask is obvious, and once at the foot for a reader who scrolled past
  // it.
  //
  // NOT held until the tier resolves, which is the opposite of the upgrade
  // button below. That button waits so a Pro account never sees a flash of the
  // thing it already bought. Here the ask IS the page, and `useSubscription`
  // has been observed taking seconds under load — a paid click that lands on a
  // page with no visible offer for the first few seconds is the whole ad
  // wasted. So it renders on the server and disappears if the viewer turns out
  // to be Pro, rather than the other way round. Cold ad traffic is signed out
  // by definition, so the flash costs almost nobody anything.
  const adCta = (cta: "hero" | "final") =>
    ad && adTarget && !isPaid ? (
      <AdTrialCta
        spotName={spot.name}
        region={adRegion}
        chargeDate={ad.chargeDate}
        wall={ad.wall}
        cta={cta}
        inputId={`ad-email-${cta}`}
        dims={adTarget}
      />
    ) : null;

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
          head down it and comes back on the first upward flick. `pt-16` below
          stays put either way — the bar moves, the document does not. */}
      {/* Paid traffic gets a bar with nowhere to go. Every link in the real
          top bar (map, login, pricing, nav) is a way out of a page that cost
          money to land on, and none of them is the thing the ad promised. */}
      {ad ? <AdBrandBar /> : <ExploreTopBar hideOnScroll />}

      <div className="pt-16">
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
            </div>
          </div>
        </div>
        )}

        {/* Body: single stack on mobile, two columns on desktop */}
        {/* Single top-to-bottom reading order (conclusion-first). A desktop-
            width column (not a narrow prose measure — this is a data page);
            list/prose sub-content caps its own width so it doesn't stretch. */}
        <div className={`${PAGE_MEASURE} py-4 lg:py-6 space-y-8`}>
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

            {/* Species switcher drives every score below — pick first. */}
            {species.length > 1 && (
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <div className="rc-label text-[9px]">Species</div>
                  <div className="font-rc-mono text-[10px] text-rc-ink-mute italic">
                    tap to switch driver
                  </div>
                </div>
                <SpeciesCardRow
                  species={species}
                  scores={page.topScoreTodayBySpecies}
                  hourlyScoreGrid={fcSource.hourlyScoreGrid}
                  regulations={page.regulations}
                  selectedId={selId}
                  onSelect={setSelId}
                />
              </div>
            )}

            {/* Score info (left) beside the map (right) — a two-column band for
                verdict + orientation. Stacks on mobile with the score first. */}
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
              <div className="order-2">
                <SpotMiniMap
                  spot={spot}
                  score={nowScore ?? todayScore}
                  timeIso={
                    activeIso ? zonedHourToUtcIso(activeIso, selectedHour, TZ) : null
                  }
                  hideExploreLink={!!ad}
                />
              </div>
              {/* 2 · Best Window + 3 · DFO reg strip. The fresh-catch evidence
                  and the alert CTA both used to live in here; they moved out to
                  the full-width reports band and the identity row respectively,
                  so this card is now purely the score verdict. */}
              <div className="order-1">
                <ScoreCard
                  nowLabel={nowLabel}
                  score={nowScore}
                  peak={peakScore ?? todayScore}
                  peakTime={fmtPeak(peakHourNum)}
                  windowLabel={win.label}
                  windowPeak={peakScore ?? todayScore}
                  tidePhase={peakTidePhase}
                  dfoArea={page.regAreaCode}
                  region={cityLink?.provinceName ?? spot.region}
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
              onUpgrade={ad ? scrollToOffer : () => setReportsUpgradeOpen(true)}
            />
          </div>
          {/* end identity + score cluster (items 1–3) */}

          {/* 4 · 14-day forecast */}
          <div className="border-t border-rc-rule pt-8">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div className="rc-label text-[9px]">14-Day Forecast</div>
              <span className="font-rc-mono text-[10px] text-rc-ink-mute italic shrink-0">
                confidence fades past day 7 · ECMWF + GFS
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
            {/* The ask, directly under the locked days it is asking for. Also
                the scroll target for every locked tile and locked panel on the
                page, so there is one offer and one place it lives. */}
            {adCta("hero") && (
              <div id="ad-offer" className="mt-5 scroll-mt-20">
                {adCta("hero")}
              </div>
            )}
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
            <div className="mt-5 ml-[0.5px] mr-[10px] lg:ml-[6px] lg:mr-[20px]">
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
            <SpotTerminal
              hours={terminalHours}
              realCurrent={chartCurrent}
              tideRange={tideRange}
              sun={page.sun}
              nowHour={nowHour}
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
                regulations={page.regulations}
                selectedId={selId}
                areaCode={page.regAreaCode}
                region={cityLink?.provinceName ?? spot.region}
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
              <NeighbourSpots
                spots={page.nearbySpots}
                region={cityLink?.provinceName ?? spot.region}
              />
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
            {/* Second copy of the ask, for a reader who came all the way down
                the page rather than stopping at the wall. */}
            {adCta("final")}
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
          </div>

          {/* Last thing above the footer — after the description and the
              hierarchy trail, so the crawlable copy and the outbound city /
              province links stay ahead of it. */}
          {!ad && <AdSlot placement="spotFoot" className="border-t border-rc-rule pt-8" />}
        </div>
      </div>

      {/* The marketing footer is a sitemap. On an ad page it is forty ways to
          leave, printed under the one thing we asked the reader to do. What
          survives is what has to: the legal pages. */}
      {ad ? <AdFooter /> : <MarketingFooter />}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        variant={!user && lockedTier === "free" ? "signup" : "pro"}
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
