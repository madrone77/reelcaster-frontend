"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpCircle, ChevronLeft, Star } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import ExploreTopBar from "../../components/explore-top-bar";
import DayCell from "../../components/day-cell";
import HourlyBars, { bestWindow } from "../../components/hourly-bars";
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
import FactorCharts from "../components/factor-charts";
import SpotMiniMap from "../components/spot-mini-map";
import ScoreCard from "../components/score-card";
import CustomAlertCta from "../components/custom-alert-cta";
import SignupGateDialog, { type AuthIntent } from "../components/signup-gate-dialog";
import LogCatchDialog from "../components/log-catch-dialog";
import CreateAlertDialog from "../components/create-alert-dialog";

const TZ = "America/Vancouver";

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
    fetchSpotScore(spot.id, selId, 1)
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

  const fcSource = fc ?? page;
  const stripModel = useMemo(
    () => (selId ? buildForecastDays(fcSource, selId, false) : null),
    [fcSource, selId],
  );

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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

  const tideSeries = useMemo(
    () => (page.hourlyConditionsGrid?.[0] ?? []).map((c) => c.tideM),
    [page.hourlyConditionsGrid],
  );

  const scoreEntry = selId
    ? score?.days?.[0]?.species?.[selId]
    : undefined;

  const handleDay = (day: ForecastDay) => {
    if (day.locked) {
      setUpgradeOpen(true);
      return;
    }
    setSelectedIso(day.iso);
  };

  const pressureMb = point?.conditions?.barometric_pressure_hpa ?? null;
  const pressureTrend = point?.conditions?.pressure_trend_3h ?? null;

  // Conditions for the scrubbed hour (falls back to today's grid / now snapshot).
  const condGrid = (fc ?? page).hourlyConditionsGrid;
  const condCell =
    condGrid?.[dayIndex]?.[selectedHour] ??
    condGrid?.[0]?.[selectedHour] ??
    null;
  const tilesSnapshot: RightNowSnapshot | null = condCell
    ? { ...condCell, hourLocal: "" }
    : page.rightNow;
  const isNow = dayIndex === 0 && selectedHour === nowHour;
  const dowLabel = stripModel?.days?.[dayIndex]?.dow;
  const conditionsLabel = isNow
    ? "RIGHT NOW"
    : `AT ${String(selectedHour).padStart(2, "0")}:00${
        dayIndex > 0 && dowLabel ? ` · ${dowLabel}` : ""
      }`;
  const selHourScore = hours24[selectedHour];

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
  const nowLabel = `NOW${
    selSpecies ? ` · ${selSpecies.name.toUpperCase()}` : ""
  } · ${String(nowHour).padStart(2, "0")}:00${tzAbbrev ? ` ${tzAbbrev}` : ""}`;
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
        <span className="px-2 py-0.5 rounded-full bg-rc-surface text-rc-ink-soft font-rc-mono text-[10px] font-semibold uppercase tracking-[0.06em]">
          PFMA {page.regAreaCode} · Open
        </span>
      )}
      {regulation && (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.06em] ${
            REG_PILL[regulation.status] ?? "bg-rc-surface text-rc-ink-mute"
          }`}
        >
          {selSpecies?.name} · {regulation.status}
        </span>
      )}
    </div>
  );

  return (
    <div className="h-dvh overflow-y-auto bg-rc-page">
      <ExploreTopBar />

      <div className="pt-14">
        {/* Mobile spot header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-rc-rule bg-rc-panel">
          <Link
            href="/explore"
            aria-label="Back to map"
            className="shrink-0 w-9 h-9 rounded-lg border border-rc-rule flex items-center justify-center text-rc-ink-soft hover:bg-rc-surface transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-rc-ink leading-tight truncate">
              {spot.name}
            </h1>
            {subtitle && (
              <p className="font-rc-mono text-[11px] text-rc-ink-mute truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Save spot"
            className="shrink-0 w-9 h-9 rounded-lg border border-rc-rule flex items-center justify-center text-rc-ink-soft hover:bg-rc-surface transition-colors"
          >
            <Star className="w-4 h-4" />
          </button>
        </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 lg:gap-6 px-4 lg:px-6 py-4 lg:py-6 max-w-[1400px] mx-auto">
          {/* ── Left: summary ─────────────────────────────────────────── */}
          <div className="space-y-4 lg:space-y-6">
            <SpotMiniMap
              spot={spot}
              score={nowScore ?? todayScore}
              speciesName={selSpecies?.name ?? null}
            />

            {pills}

            <h1 className="hidden lg:block rc-title-lg text-3xl">{spot.name}</h1>

            <ScoreCard
              nowLabel={nowLabel}
              score={nowScore}
              peak={peakScore ?? todayScore}
              peakTime={fmtPeak(peakHourNum)}
              windowLabel={win.label}
              windowPeak={peakScore ?? todayScore}
              tidePhase={peakTidePhase}
              onSetAlert={handleSetAlert}
              onLogCatch={handleLogCatch}
            />

            <NowConditions
              rightNow={tilesSnapshot}
              pressureMb={pressureMb}
              pressureTrend={pressureTrend}
              tideSeries={tideSeries}
              label={conditionsLabel}
            />

            <SpotProfile spot={spot} seasonState={seasonState} />
          </div>

          {/* ── Right: forecast + score + neighbours ──────────────────── */}
          <div className="space-y-4 lg:space-y-6">
            {/* Species selector */}
            {species.length > 1 && (
              <div className="rounded-xl border border-rc-rule bg-rc-panel p-4">
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

            {/* 14-day strip */}
            <div className="rounded-xl border border-rc-rule bg-rc-panel p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="rc-label text-[9px]">
                    14-Day Forecast
                    {selSpecies ? ` · ${selSpecies.name}` : ""}
                  </div>
                  <div className="font-rc-mono text-[10px] text-rc-ink-mute italic mt-0.5">
                    confidence fades past day 7 · ECMWF + GFS
                  </div>
                </div>
                {stripModel?.bestDay && (
                  <span className="flex items-center gap-1.5 font-rc-mono text-[11px] text-rc-ink-soft">
                    <span className="w-1.5 h-1.5 rounded-full bg-rc-good" />
                    Best {stripModel.bestDay.dow} {stripModel.bestDay.date}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {(stripModel?.days ?? []).map((day) => (
                  <div key={day.index} className="flex-1 min-w-[44px]">
                    <DayCell
                      day={day}
                      selected={day.iso === activeIso}
                      onSelect={() => handleDay(day)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 24h chart */}
            <div className="rounded-xl border border-rc-rule bg-rc-panel p-4">
              <div className="rc-label text-[9px] mb-3">
                24-Hour Forecast{selSpecies ? ` · ${selSpecies.name}` : ""}
                {selHourScore != null
                  ? ` · ${String(selectedHour).padStart(2, "0")}:00 → ${selHourScore}`
                  : ""}
              </div>
              <HourlyBars
                hours={hours24}
                tz={TZ}
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
              />
            </div>

            {/* Score explained + Pro upsell */}
            {scoreEntry && (
              <div className="rounded-xl border border-rc-rule bg-rc-panel p-4 space-y-4">
                <FactorCharts
                  entry={scoreEntry}
                  tz={TZ}
                  selectedHour={selectedHour}
                  onSelectHour={setSelectedHour}
                  speciesName={selSpecies?.name ?? null}
                  tzAbbrev={tzAbbrev}
                  nowHour={nowHour}
                  windowRange={win.window}
                />
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-rc-brand-soft text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.04em] py-3 hover:bg-rc-brand-soft/70 transition-colors"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Upgrade to Reelcaster Pro for full weights
                </button>
              </div>
            )}

            <NeighbourSpots spots={page.nearbySpots} />

            <CustomAlertCta spotName={spot.name} />

            {/* Description */}
            {spot.seoIntro && (
              <div className="rounded-xl border border-rc-rule bg-rc-surface p-5">
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
    </div>
  );
}
