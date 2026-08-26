"use client";

// The city page as an instrument.
//
// The block this replaces argued that a forecast is useful: a bite radar, a
// spotlight card, a leaderboard of near-identical numbers, plain-English regs,
// a signup. It read as a well-made brochure. Paid traffic bounced off it at
// the point where a brochure has to become a product.
//
// This shows the product instead. Same three surfaces the spot page leads
// with, at city grain: a 14-day strip whose next twelve days are the thing
// being sold, a 24-hour chart under it, and a map of the city's marks that
// names each one under the pointer. A reader who scrubs the chart has already
// used the app.
//
// What it does NOT do is invent a city-grain number. There is no such thing as
// a city's wind at 3 PM. Every hourly reading on this page belongs to ONE
// named mark and says so — see featured.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { zoneAbbrev } from "@/app/explore/lib/explore-data";
import { useSpotClock } from "@/app/explore/lib/use-spot-clock";
import DayCell from "@/app/explore/components/day-cell";
import { bestWindow } from "@/app/explore/components/hourly-bars";
import UpgradeDialog from "@/app/explore/components/upgrade-dialog";
import CurrentConditionsStrip from "@/app/explore/spot/components/current-conditions-strip";
import SpotTerminal from "@/app/explore/spot/components/spot-terminal";
import { resolveSea } from "@/app/explore/lib/sea-state";
import {
  localDayStartUtcMs,
  signCurrentSeries,
} from "@/app/explore/lib/current-series";
import {
  buildViewportForecastDays,
  type ForecastDay,
  type ForecastStripModel,
  type ForecastTier,
  ANON_STRIP_DAYS,
} from "@/app/explore/lib/forecast-strip";
import {
  fetchCurrentsPoint,
  fetchMapForecast14d,
  type CurrentSample,
} from "@/lib/bluecaster-client";
import type { MapForecast14dPayload } from "@/lib/bluecaster";
import type {
  HourlyConditions,
  RightNowSnapshot,
  SunHours,
} from "@/lib/bluecaster/live-spot-types";
import type { RankedSpot } from "./featured";
import Section from "./section";
import CitySpotMap from "./city-spot-map";
import CityTopSpots from "./city-top-spots";

/**
 * Everything the 24-hour chart needs from the featured mark, sliced on the
 * server out of that spot's own page payload.
 *
 * Sliced rather than passed whole because the spot payload is large and most
 * of it — regulations, seasonality, factor breakdowns, nearby cards, catch
 * signals — has no business crossing into a city page's HTML. `catchSignals`
 * in particular carries verbatim forum text and must never be serialised into
 * a prerendered body; not having the field at all is the way to be sure.
 */
export interface FeaturedFeed {
  slug: string;
  name: string;
  /** Species the chart is drawn for — the mark's best today. */
  speciesName: string | null;
  lat: number;
  lng: number;
  /** 14 × 24 scores for that species, 0–100. */
  scoreGrid: (number | null)[][];
  /** 14 × 24 conditions. */
  conditionsGrid: HourlyConditions[][];
  /** ISO date per grid row, so a strip day can find its row. */
  isos: string[];
  sun: SunHours;
  rightNow: RightNowSnapshot | null;
}

export default function CityInstrument({
  citySlug,
  cityName,
  cityLat,
  cityLng,
  tz,
  serverNowMs,
  initialForecast,
  featured,
  rows,
  rosterCount,
}: {
  citySlug: string;
  cityName: string;
  cityLat: number;
  cityLng: number;
  /** The city's IANA timezone, resolved on the server from its province. */
  tz: string;
  /** The instant baked into this HTML. Every clock-dependent string derives
   *  from it until the component mounts — see `useSpotClock`. */
  serverNowMs: number;
  /**
   * City 14-day peaks, fetched on the server at the ANONYMOUS horizon.
   *
   * This route is prerendered, so the static body is always the signed-out
   * answer and cannot carry a day-9 score. A signed-in reader's real horizon
   * arrives from the client refetch below.
   */
  initialForecast: MapForecast14dPayload | null;
  featured: FeaturedFeed | null;
  /** The marks that scored today, best-known first. */
  rows: RankedSpot[];
  /** The city's full roster size — what the page title counts. `rows` can be
   *  shorter, and the map's caption says so when it is. */
  rosterCount: number;
}) {
  const { isPaid, loading: tierLoading } = useSubscription();
  const { user } = useAuth();
  const { hour: nowHour } = useSpotClock(tz, serverNowMs);

  // Until `tierLoading` clears, `isPaid` is still its initial `false`. Days
  // past the anonymous horizon stay PENDING rather than locked, so a Pro
  // account never watches a padlock appear over days it has paid for and then
  // disappear — the lock-then-unlock flash this app has fixed twice already.
  const accessTier: ForecastTier = isPaid ? "pro" : user ? "free" : "anonymous";

  // ── 14-day strip ──────────────────────────────────────────────────────
  const [forecast, setForecast] = useState<MapForecast14dPayload | null>(
    initialForecast,
  );
  /** True once a payload fetched under this reader's own session has landed. */
  const [tierCorrect, setTierCorrect] = useState(false);

  useEffect(() => {
    // Anonymous readers already have the right payload — the prerendered one
    // IS their answer. Refetching would spend a request to be told so.
    if (tierLoading) return;
    if (!user && !isPaid) {
      setTierCorrect(true);
      return;
    }
    let cancelled = false;
    fetchMapForecast14d({ city: citySlug })
      .then((d) => {
        if (cancelled) return;
        setForecast(d);
        setTierCorrect(true);
      })
      // A failed refetch leaves the anonymous payload on screen, which is
      // fewer days than this reader is owed but never more. Silent: there is
      // nothing they could do about it.
      .catch(() => {
        if (!cancelled) setTierCorrect(true);
      });
    return () => {
      cancelled = true;
    };
  }, [citySlug, user, isPaid, tierLoading]);

  const stripModel: ForecastStripModel | null = useMemo(() => {
    if (!forecast) return null;
    // Past the anonymous horizon the prerendered payload cannot say whether a
    // day is this reader's to see, so those cells render as skeletons until
    // either the tier resolves to anonymous or the session-scoped payload
    // lands. See ForecastDay.pending.
    const pendingFrom = tierCorrect ? null : ANON_STRIP_DAYS;
    return buildViewportForecastDays(forecast, null, accessTier, pendingFrom);
  }, [forecast, accessTier, tierCorrect]);

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const activeIso =
    selectedIso ?? stripModel?.days[0]?.iso ?? featured?.isos[0] ?? null;
  const dayIndex = useMemo(() => {
    if (!featured || !activeIso) return 0;
    const i = featured.isos.indexOf(activeIso);
    return i >= 0 ? i : 0;
  }, [featured, activeIso]);

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [lockedTier, setLockedTier] = useState<"free" | "pro">("pro");

  const handleDay = useCallback((day: ForecastDay) => {
    if (day.pending) return;
    if (day.locked) {
      setLockedTier(day.lockTier ?? "pro");
      setUpgradeOpen(true);
      return;
    }
    setSelectedIso(day.iso);
  }, []);

  // Scroll affordance on the strip — the same overlaid arrows the spot page
  // uses, so a phone reader knows there are days off the right edge.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => {
      setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
      setCanScrollLeft(el.scrollLeft > 4);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [stripModel]);

  // ── 24-hour chart, read at the featured mark ──────────────────────────
  const [selectedHour, setSelectedHour] = useState<number>(() => nowHour);
  const [scrubbed, setScrubbed] = useState(false);
  useEffect(() => {
    if (!scrubbed) setSelectedHour(nowHour);
  }, [nowHour, scrubbed]);
  const selectHour = useCallback((hour: number) => {
    setScrubbed(true);
    setSelectedHour(hour);
  }, []);
  const clearScrub = useCallback(() => {
    setScrubbed(false);
    setSelectedHour(nowHour);
  }, [nowHour]);

  const hours24 = useMemo(
    () => featured?.scoreGrid?.[dayIndex] ?? new Array(24).fill(null),
    [featured, dayIndex],
  );

  // Memoized so the tuple keeps its identity across renders: it feeds the
  // terminal's rebuild effect, and a fresh array every render tears the SVG
  // down on each scrub tick, killing an in-flight touch drag.
  const win = useMemo(() => bestWindow(hours24 ?? []), [hours24]);

  const terminalHours = useMemo(() => {
    const g = featured?.conditionsGrid?.[dayIndex] ?? [];
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
    const wind = pick("windKt");
    const gust = pick("windGustKt");
    // The wave grid has dry-land cells and runs out around day 10, so sea
    // state falls back to a wind-derived estimate hour by hour. `seaEst`
    // flags which hours are inferred so the chart can say so rather than
    // passing an estimate off as a model reading.
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
  }, [featured, dayIndex, hours24]);

  // Tide scale fixed across every forecast day, so flipping days moves the
  // curve rather than re-fitting the axis under it.
  const tideRange = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const day of featured?.conditionsGrid ?? []) {
      for (const h of day ?? []) {
        const t = h?.tideM;
        if (typeof t === "number" && Number.isFinite(t)) {
          if (t < min) min = t;
          if (t > max) max = t;
        }
      }
    }
    return min <= max ? { min, max } : null;
  }, [featured]);

  // Real predicted current at the featured mark, for the day on screen.
  // Fetched after mount and never blocking: without it the chart draws its
  // tide-derived shape and the strip falls back to the tide trend, which is
  // the documented degradation, not a broken row.
  const [curByIso, setCurByIso] = useState<
    Record<string, (CurrentSample | null)[] | null>
  >({});
  const curRequested = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!featured || !activeIso) return;
    if (curRequested.current.has(activeIso)) return;
    curRequested.current.add(activeIso);
    const fromMs = localDayStartUtcMs(activeIso, tz);
    if (!Number.isFinite(fromMs)) return;
    const from = new Date(fromMs).toISOString();
    const to = new Date(fromMs + 23 * 3_600_000).toISOString();
    fetchCurrentsPoint(featured.lat, featured.lng, from, to)
      .then((d) => {
        const byHour: (CurrentSample | null)[] = new Array(24).fill(null);
        for (const s of d?.series ?? []) {
          const h = Math.round((Date.parse(s.t) - fromMs) / 3_600_000);
          if (h >= 0 && h < 24) byHour[h] = s;
        }
        setCurByIso((m) => ({ ...m, [activeIso]: byHour }));
      })
      .catch(() => {});
  }, [featured, activeIso, tz]);

  const chartCurrent = useMemo(() => {
    const samples = activeIso ? curByIso[activeIso] : null;
    return samples ? signCurrentSeries(samples, terminalHours.tide) : null;
  }, [curByIso, activeIso, terminalHours.tide]);

  const condCell =
    featured?.conditionsGrid?.[dayIndex]?.[selectedHour] ??
    featured?.conditionsGrid?.[0]?.[selectedHour] ??
    null;
  const tilesSnapshot: RightNowSnapshot | null = condCell
    ? { ...condCell, hourLocal: "" }
    : (featured?.rightNow ?? null);

  const tzAbbrev = zoneAbbrev(tz);
  const isToday = dayIndex === 0;
  const activeDay = stripModel?.days[dayIndex] ?? null;

  return (
    <>
      {/* ── 1 · The 14-day strip ──────────────────────────────────────────
          Big, white, and the first thing on the page under the headline. It
          is what the ad promised and what the account unlocks, so it leads;
          the twelve locked tiles are not an afterthought on this page, they
          are the offer. */}
      <Section
        title={`The next 14 days in ${cityName}`}
        aside="Data from: ECMWF + GFS + BlueCaster"
        how={
          <>
            {/* Says what the row IS (best across the roster, not an average and
                not one spot's fortnight), what the number means, and what to
                do with it. A stranger has to be able to use this. */}
            Each box is one day. The big number is the best score any of the{" "}
            {rosterCount} {rosterCount === 1 ? "spot" : "spots"} we cover in{" "}
            {cityName} reaches that day, out of 100. Higher is better, and the
            colour says the same thing: green is good, amber is fair, red is
            slow. Tap a day to load its hours into the chart below.{" "}
            {stripModel?.bestDay
              ? `The best day you can see right now is ${stripModel.bestDay.dow} ${stripModel.bestDay.date}. `
              : ""}
            The locked days are the rest of the fortnight; a free account opens
            the first week and Pro opens all 14.
          </>
        }
      >
        <div className="relative">
          {/* pt-2 keeps the BEST badge, which sits at -top-1.5, inside the
              box that overflow-x-auto would otherwise clip. */}
          <div
            ref={stripRef}
            className="flex gap-1.5 h-[132px] pt-2 overflow-x-auto scrollbar-hide"
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
            {!stripModel &&
              Array.from({ length: 14 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 min-w-[54px] rounded border border-rc-rule bg-rc-surface animate-pulse"
                />
              ))}
          </div>
          <div
            aria-hidden
            className={`pointer-events-none absolute right-0 top-2 bottom-0 w-10 flex items-center justify-end pr-0.5 bg-gradient-to-l from-rc-panel to-transparent transition-opacity duration-200 ${
              canScrollRight ? "opacity-100" : "opacity-0"
            }`}
          >
            <ChevronRight className="w-4 h-4 text-rc-ink-mute" />
          </div>
          <div
            aria-hidden
            className={`pointer-events-none absolute left-0 top-2 bottom-0 w-10 flex items-center justify-start pl-0.5 bg-gradient-to-r from-rc-panel to-transparent transition-opacity duration-200 ${
              canScrollLeft ? "opacity-100" : "opacity-0"
            }`}
          >
            <ChevronLeft className="w-4 h-4 text-rc-ink-mute" />
          </div>
        </div>
      </Section>

      {/* ── 2 · The 24-hour chart, read at one named mark ─────────────────── */}
      {featured && (
        <Section
          title={
            activeDay && !isToday
              ? `Hour by hour on ${activeDay.dow} at ${featured.name}`
              : `Hour by hour today at ${featured.name}`
          }
          aside={tzAbbrev ? `All times ${tzAbbrev}` : undefined}
          how={
            <>
              {/* The one thing a reader cannot guess and will otherwise get
                  wrong: this is not "Victoria's weather". A city has no wind.
                  Naming the mark and saying WHY it was picked is the whole
                  job of this sentence. */}
              A city does not have its own tide or wind, so this chart is one
              real spot:{" "}
              <Link
                href={`/explore/spot/${featured.slug}`}
                className="text-rc-brand font-semibold hover:underline"
              >
                {featured.name}
              </Link>
              , the most fished mark in {cityName}
              {featured.speciesName
                ? `, scored for ${featured.speciesName}`
                : ""}
              . The top row is the score for each hour of the day. Everything
              under it is what drives that score at the same hour: the tide,
              the current, the wind, the sea, the air and the sky.{" "}
              <span className="lg:hidden">
                Tap or drag across the chart to read any hour.
              </span>
              <span className="hidden lg:inline">
                Hover or drag across the chart to read any hour.
              </span>{" "}
              The row of boxes just above it always shows the hour you are on.
            </>
          }
        >
          {scrubbed && isToday && selectedHour !== nowHour && (
            <div className="flex justify-end -mt-2 mb-2">
              <button
                type="button"
                onClick={clearScrub}
                className="rounded px-2 py-0.5 bg-rc-brand-soft text-rc-brand font-rc-mono text-[10px] font-semibold hover:bg-rc-brand-soft/70 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rc-brand"
              >
                Back to now
              </button>
            </div>
          )}

          {/* Inset to the chart's band boxes so the strip's edges land on
              theirs. The terminal renders its SVG 1:1, so its gutters are
              constant CSS px: 6px/20px on desktop, 0.5px/10px on the mobile
              variant, and lg is exactly where the two SVGs swap. Measured on
              the spot page, not guessed — same numbers here because it is the
              same component. */}
          <div className="ml-[0.5px] mr-[10px] lg:ml-[6px] lg:mr-[20px]">
            <CurrentConditionsStrip
              rightNow={tilesSnapshot}
              score={hours24?.[selectedHour] ?? null}
              currentSigned={chartCurrent}
              currentSample={
                (activeIso ? curByIso[activeIso]?.[selectedHour] : null) ?? null
              }
              hour={selectedHour}
              isNow={isToday && selectedHour === nowHour}
            />
          </div>
          <SpotTerminal
            hours={terminalHours}
            realCurrent={chartCurrent}
            tideRange={tideRange}
            sun={featured.sun}
            /* Only today has a "now" on its axis. */
            nowHour={isToday ? nowHour : null}
            selectedHour={selectedHour}
            onSelectHour={selectHour}
            bestWindow={win.window}
          />
        </Section>
      )}

      {/* ── 3 · The marks people actually fish ───────────────────────────── */}
      <CityTopSpots rows={rows} cityName={cityName} />

      {/* ── 4 · All of them, on the water ────────────────────────────────── */}
      <Section
        title={`Every spot we score in ${cityName}`}
        aside="Bathymetry: NONNA-10 + NRCan"
        how={
          <>
            {/* Two facts a stranger needs: the dot IS the score, and the map is
                real depth rather than a decorative background. Then the one
                interaction. */}
            The seabed here is real depth data, not a picture. Each dot is a
            fishing spot and the number inside it is that spot&apos;s best score
            today, coloured the same way as the days above.{" "}
            <span className="lg:hidden">Tap a dot</span>
            <span className="hidden lg:inline">Hover a dot</span> to see its
            name, how busy a mark it is, and the tide, sea and seabed at its
            best hour. Click it to open the full page for that spot.
          </>
        }
      >
        <CitySpotMap
          rows={rows}
          rosterCount={rosterCount}
          cityName={cityName}
          cityLat={cityLat}
          cityLng={cityLng}
        />
      </Section>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        variant={!user && lockedTier === "free" ? "signup" : "pro"}
      />
    </>
  );
}
