"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowUpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { favoriteCount } from "../../lib/use-favorite";
import ExploreTopBar from "../../components/explore-top-bar";
import DayCell from "../../components/day-cell";
import { bestWindow } from "../../components/hourly-bars";
import UpgradeDialog from "../../components/upgrade-dialog";
import { currentLocalHour, fmtPeak } from "../../lib/explore-data";
import { buildForecastDays, type ForecastDay } from "../../lib/forecast-strip";
import {
  fetchForecast14d,
  fetchSpotScore,
  fetchPointConditions,
} from "@/lib/bluecaster-client";
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
import NowConditions from "../components/now-conditions";
import ScoreFactors from "../components/score-factors";
import { useFavorite } from "../../lib/use-favorite";
import SpotTerminal from "../components/spot-terminal";
import SpotMiniMap from "../components/spot-mini-map";
import ScoreCard from "../components/score-card";
import CustomAlertCta from "../components/custom-alert-cta";
import SignupGateDialog, { type AuthIntent } from "../components/signup-gate-dialog";
import LogCatchDialog from "../components/log-catch-dialog";
import CreateAlertDialog from "../components/create-alert-dialog";

const UpgradeRequiredModal = dynamic(
  () => import("@/app/components/paywall/upgrade-required-modal"),
  { ssr: false },
);

const TZ = "America/Vancouver";
/** Free tier may favorite this many spots before hitting the upgrade cap. */
const FREE_FAV_CAP = 1;

const REG_PILL: Record<string, string> = {
  Open: "bg-rc-good-bg text-rc-good-ink",
  Release: "bg-rc-fair-bg text-rc-fair-ink",
  Closed: "bg-rc-poor-bg text-rc-poor-ink",
};

function bestSpeciesId(page: SpotPageInitial): string | null {
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

export default function SpotDetailShell({
  page,
  slug,
}: {
  page: SpotPageInitial;
  slug: string;
}) {
  const { spot } = page;
  const nowHour = currentLocalHour(TZ);
  const [selectedHour, setSelectedHour] = useState<number>(nowHour);

  const species = useMemo(
    () => [...page.species].sort((a, b) => a.rank - b.rank),
    [page.species],
  );
  const [selId, setSelId] = useState<string | null>(() => bestSpeciesId(page));
  const selSpecies = species.find((s) => s.id === selId) ?? species[0] ?? null;

  // ── lazy data ─────────────────────────────────────────────────────────
  const [fc, setFc] = useState<Forecast14dPayload | null>(null);
  const [score, setScore] = useState<SpotScorePayload | null>(null);
  const [point, setPoint] = useState<PointConditions | null>(null);
  const [saved, toggleSaved] = useFavorite(spot.slug);
  const { isPaid } = useSubscription();
  const [favUpgradeOpen, setFavUpgradeOpen] = useState(false);
  // One-shot "pop" when favoriting (not on un-favorite or load) — mirrors the
  // rail SpotCard star interaction exactly, including the free-tier cap.
  const [savePop, setSavePop] = useState(false);
  const handleToggleSaved = () => {
    if (!saved && !isPaid && favoriteCount() >= FREE_FAV_CAP) {
      setFavUpgradeOpen(true);
      return;
    }
    if (!saved) {
      setSavePop(true);
      window.setTimeout(() => setSavePop(false), 600);
    }
    toggleSaved();
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
  const regulation = page.regulations.find((r) => r.speciesId === selId) ?? null;
  const pressureMb = point?.conditions?.barometric_pressure_hpa ?? null;
  const pressureTrend = point?.conditions?.pressure_trend_3h ?? null;

  const fcSource = fc ?? page;
  const stripModel = useMemo(
    () => (selId ? buildForecastDays(fcSource, selId, false) : null),
    [fcSource, selId],
  );

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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

  // Sign-up gate: signed-out anglers who tap "Set alert" / "Log catch" are sent
  // through the sign-up flow; the intent drives the modal copy.
  const { user } = useAuth();
  const [authIntent, setAuthIntent] = useState<AuthIntent | null>(null);
  const [logCatchOpen, setLogCatchOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const handleSetAlert = () => {
    if (!user) {
      setAuthIntent("alert");
      return;
    }
    setAlertOpen(true);
  };

  const handleLogCatch = () => {
    if (!user) {
      setAuthIntent("catch");
      return;
    }
    setLogCatchOpen(true);
  };
  const activeIso = selectedIso ?? stripModel?.days[0]?.iso ?? null;
  const activeIndex =
    stripModel?.days.findIndex((d) => d.iso === activeIso) ?? 0;
  const dayIndex = activeIndex < 0 ? 0 : activeIndex;

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
    return {
      score: hours24,
      tide: pick("tideM"),
      wind: pick("windKt"),
      gust: pick("windGustKt"),
      windDir: pick("windDirDeg"),
      sea: pick("waveM"),
      cloud: pick("cloudPct"),
      precip: pick("precipMm"),
      air: pick("airTempC"),
    };
  }, [fcSource, dayIndex, hours24]);

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
  const win = bestWindow(todayHours ?? []);
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
  const tzAbbrev = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        timeZoneName: "short",
      })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? "",
    [],
  );
  // Driver species lives only in the status chip up top — keep it out of the
  // NOW label to avoid repeating it across the panel.
  const nowLabel = `NOW · ${String(nowHour).padStart(2, "0")}:00${tzAbbrev ? ` ${tzAbbrev}` : ""}`;
  const subtitle = spot.region ?? spot.city ?? spot.country ?? "";

  // ── Log-catch context (current spot + live conditions) ─────────────────
  const nowTimeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()),
    [],
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

  const pills = (
    <div className="flex flex-wrap items-center gap-2">
      {page.regAreaCode && (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rc-good-bg text-rc-good-ink font-rc-mono text-[10px] font-semibold uppercase tracking-[0.06em]">
          <span className="w-1.5 h-1.5 rounded-full bg-rc-good" />
          PFMA {page.regAreaCode} · Open
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
    <div className="h-dvh overflow-y-auto bg-rc-panel">
      <ExploreTopBar />

      <div className="pt-14">
        {/* Desktop sub-header: breadcrumb + freshness */}
        <div className="hidden lg:flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6 py-3 border-b border-rc-rule">
          <div className="flex items-center gap-2 font-rc-mono text-[11px] text-rc-ink-mute">
            <Link
              href="/explore"
              className="flex items-center gap-1 text-rc-brand hover:underline"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to map
            </Link>
            <span className="text-rc-rule">·</span>
            <span className="truncate">
              {[spot.country, spot.region, spot.city]
                .filter(Boolean)
                .join(" › ")}
              {" › "}
              <span className="text-rc-ink-soft">{spot.name}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-rc-mono text-[10px] text-rc-ink-mute uppercase tracking-[0.08em]">
            <span className="w-1.5 h-1.5 rounded-full bg-rc-good" />
            Live · auto-refresh 5 min
          </div>
        </div>

        {/* Body: single stack on mobile, two columns on desktop */}
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-4 lg:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 lg:gap-8">
            {/* ── LEFT PANEL: name · map · score+DFO+actions · RIGHT NOW · profile ── */}
            <div className="space-y-5 min-w-0">
              {/* Name reads first — it's the spot's identity, so it leads the
                  panel above the map. Star to the right marks the saved state. */}
              <div>
                {pills}
                <div className="flex items-center gap-2 mt-3">
                  <h1 className="rc-title-lg text-3xl lg:text-4xl min-w-0">
                    {spot.name}
                  </h1>
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
                </div>
                <p className="font-rc-mono text-xs text-rc-ink-mute mt-1.5">
                  {`${Math.abs(spot.lat).toFixed(2)}°${
                    spot.lat >= 0 ? "N" : "S"
                  } · ${Math.abs(spot.lng).toFixed(2)}°${
                    spot.lng >= 0 ? "E" : "W"
                  }`}
                </p>
              </div>

              <SpotMiniMap
                spot={spot}
                score={nowScore ?? todayScore}
                speciesName={selSpecies?.name ?? null}
              />

              <ScoreCard
                nowLabel={nowLabel}
                score={nowScore}
                peak={peakScore ?? todayScore}
                peakTime={fmtPeak(peakHourNum)}
                windowLabel={win.label}
                windowPeak={peakScore ?? todayScore}
                tidePhase={peakTidePhase}
                dfoArea={page.regAreaCode}
                speciesName={selSpecies?.name ?? null}
                regOpen={regulation?.status === "Open"}
                onSetAlert={handleSetAlert}
              />

              <div className="border-t border-rc-rule pt-5">
                <ScoreFactors factors={selId ? (page.todayFactorsBySpecies[selId] ?? []) : []} />
              </div>

              <div className="border-t border-rc-rule pt-5">
                <NowConditions
                  rightNow={page.rightNow}
                  pressureMb={pressureMb}
                  pressureTrend={pressureTrend}
                  tideSeries={terminalHours.tide}
                  seaSeries={terminalHours.sea}
                />
              </div>

              <div className="border-t border-rc-rule pt-5">
                <SpotProfile spot={spot} seasonState={seasonState} />
              </div>
            </div>

            {/* ── RIGHT COLUMN: species tabs · 14-day · stacked charts ──── */}
            <div className="space-y-6 min-w-0">
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
                    selectedId={selId}
                    onSelect={setSelId}
                  />
                </div>
              )}

              <div>
                {/* Single-line header: label left, confidence caption right
                    (the BEST badge on the strip already marks the best day). */}
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
              </div>

              <div>
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                  <div>
                    <h3 className="rc-label text-[10px]">24-Hour Conditions</h3>
                    <p className="font-rc-mono text-[11px] text-rc-ink-soft mt-1">
                      Fixed scales{tzAbbrev ? ` · ${tzAbbrev}` : ""}
                    </p>
                  </div>
                  <p className="font-rc-mono text-[10px] text-rc-ink-mute italic">
                    Hover or drag to read any hour
                  </p>
                </div>
                <SpotTerminal
                  hours={terminalHours}
                  sun={page.sun}
                  nowHour={nowHour}
                  selectedHour={selectedHour}
                  onSelectHour={setSelectedHour}
                  bestWindow={win.window}
                  speciesName={selSpecies?.name ?? null}
                />
                {scoreEntry && (
                  <button
                    type="button"
                    onClick={() => setUpgradeOpen(true)}
                    className="mt-4 w-full flex items-center justify-center gap-2 rounded bg-rc-brand-soft text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.04em] py-3 hover:bg-rc-brand-soft/70 transition-colors"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    Upgrade to Boat Pro for full weights
                  </button>
                )}
              </div>

              {/* Nearby spots fill the right column's tail, sitting beside the
                  spot profile — carded so it reads as its own module. */}
              <div className="rounded border border-rc-rule bg-rc-surface p-5">
                <NeighbourSpots spots={page.nearbySpots} />
              </div>
            </div>
          </div>

          {/* ── Full-width footer ─────────────────────────────────────── */}
          <div className="mt-8 space-y-6">
            <CustomAlertCta spotName={spot.name} />
            {spot.seoIntro && (
              <div>
                <p className="rc-body text-rc-ink-soft leading-relaxed">
                  {spot.seoIntro}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />

      <SignupGateDialog
        open={authIntent !== null}
        onOpenChange={(o) => {
          if (!o) setAuthIntent(null);
        }}
        intent={authIntent ?? "catch"}
        spotName={spot.name}
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
      />

      <UpgradeRequiredModal
        open={favUpgradeOpen}
        onClose={() => setFavUpgradeOpen(false)}
        feature="favorite-spots"
        headline="Upgrade to save more spots"
        bullets={[
          "Unlimited favorite spots",
          "Reorder + score sparklines",
          "Full 14-day outlook & alerts",
        ]}
      />
    </div>
  );
}
