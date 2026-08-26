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
import dynamic from "next/dynamic";
import { useMountedOnce } from "@/hooks/use-mounted-once";
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
 * The same paywall /explore and the spot page open, loaded on the tap that
 * opens it rather than with the page.
 *
 * Not the `UpgradeDialog` wrapper beside it: that is a thin shim over this
 * component which hardcodes `from="explore-forecast"`, so every locked day on
 * a CITY page was being credited to Explore's strip. This page has its own
 * walls and needs its own names for them.
 *
 * Static-importing it would put the plan matrix, the pricing tables and the
 * Stripe checkout client into the chunks this page parses before it can
 * hydrate — on a page bought with an ad click, where first paint is the whole
 * game.
 */
const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

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

const WEEKDAY_LONG: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/**
 * "Thu" → "Thursday", for a heading that is prose rather than a data cell.
 *
 * The day CELLS keep the short form: they are 54px wide and read as a strip of
 * dates. A sentence does not, and "Hour by hour on Thu" reads like a cell that
 * escaped into the copy.
 *
 * A lookup, not date arithmetic. `ForecastDay.iso` is a calendar date in the
 * CITY's timezone, and `new Date("2026-08-27")` parses as UTC midnight — so
 * formatting it in the viewer's own zone names the day BEFORE for anyone west
 * of UTC, which is every reader this page has. The payload already resolved
 * the weekday in the right zone; this only spells it out.
 *
 * Falls back to what it was given, so an unexpected value renders short rather
 * than blank.
 */
function weekdayLong(dow: string): string {
  return WEEKDAY_LONG[dow] ?? dow;
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
  /**
   * Which wall the reader hit, which decides both what the modal SAYS and what
   * the conversion is credited to.
   *
   * "free" is a day 3–7 tile, which a free account opens; "pro" is a day 8–14
   * tile. They are different asks at different prices, so crediting them to
   * one name would make the cheaper one look like it converts worse than it
   * does.
   */
  const [lockedTier, setLockedTier] = useState<"free" | "pro">("pro");
  // Latched, so closing doesn't rip the modal out mid-animation.
  const upgradeMounted = useMountedOnce(upgradeOpen);

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
  // No "Back to now" control here, unlike the spot page.
  //
  // A picked hour stays picked until the page is reloaded, and that is the
  // right trade on this page: the reader is on it for a couple of minutes, so
  // the only thing the button could undo is the minute ticker moving the hour
  // out from under them, which it no longer does once they have scrubbed.
  //
  // ⚠ Do NOT reach for the obvious alternative and clear the scrub on pointer
  // leave. The chart's readout sits directly ABOVE the chart, so moving up to
  // read the numbers you just scrubbed to takes the pointer out of it and
  // would reset the hour on the way. That exact bug is why the spot page has
  // an explicit button rather than a leave handler.

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

  /**
   * How many hourly scores stand behind the 14-day row, for the claim above.
   *
   * A FLOOR, not a total: the engine scores each spot per species per hour,
   * and this counts a single species. Understating it is the safe direction —
   * every one of these is a number the page could show if asked.
   */
  const gridSize = rosterCount * 24 * 14;

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
        claims={[
          {
            head: "Two weeks ahead",
            body: (
              <>
                Most forecasts stop at the weekend. This one runs a full 14
                days, so you can pick the day before you book the time off.
              </>
            ),
          },
          {
            head: "One number, out of 100",
            body: (
              <>
                The best score anything in {cityName} reaches that day. Green is
                good, amber is fair, red is slow, and you can read it from
                across the room.
              </>
            ),
          },
          {
            /* The arithmetic is spelled out in the body because a bare
               "6,048" invites the reader to wonder whether we made it up. It
               is also a floor, not a total: the grid is per species, and this
               counts one. Never round it up into something we cannot show. */
            head: `${gridSize.toLocaleString()} scores behind it`,
            body: (
              <>
                {rosterCount} {rosterCount === 1 ? "spot" : "spots"}, every hour
                of every day, out to 14. This row is the best of them.
              </>
            ),
          },
        ]}
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
              ? `Hour by hour on ${weekdayLong(activeDay.dow)} at ${featured.name}`
              : `Hour by hour today at ${featured.name}`
          }
          aside={tzAbbrev ? `All times ${tzAbbrev}` : undefined}
          claims={[
            {
              /* The one thing a reader cannot guess and will otherwise get
                 wrong: this is not "Victoria's weather". A city has no wind.
                 Naming the mark, and saying it was picked on a year of catch
                 reports, turns that caveat into the strongest claim here. */
              head: "One real spot",
              body: (
                <>
                  A city has no tide or wind of its own, so this is{" "}
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
                  .
                </>
              ),
            },
            {
              head: "Six readings, one clock",
              body: (
                <>
                  Tide, current, wind, sea, air and sky, all lined up on the
                  same hour, so you can see what is actually driving the score.
                </>
              ),
            },
            {
              /* Safe to name: tidal current speed and slack are real columns,
                 modelled for the Salish Sea. Do not upgrade this into a claim
                 about depth or about models we do not run. */
              head: "Currents, not just tides",
              body: (
                <>
                  Modelled flow for the water off {cityName}, so you can see
                  slack coming before you leave the dock.
                </>
              ),
            },
          ]}
        >
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
        claims={[
          {
            /* Charted soundings, which is true and is the map's whole appeal.
               ⚠ Never upgrade this into a navigation claim: the attribution
               on the map itself reads "not for navigation". */
            head: "Real charted seabed",
            body: (
              <>
                Depth soundings, not a stock map. The banks, reefs and drop-offs
                are where you can see them.
              </>
            ),
          },
          {
            /* Reconciles its own count with the page title's, which counts the
               ROSTER. A mark with no species scored today has nothing to draw,
               so Seattle is 15 of 16 — and a map captioned "15 marks" under a
               title reading "16 Spots" is two counts of the same thing on one
               screen. */
            head:
              rows.length < rosterCount
                ? `${rows.length} of ${rosterCount} marks scored`
                : `${rosterCount} marks, all scored`,
            body: (
              <>
                Every spot we cover around {cityName}, each one carrying its own
                number for today.
              </>
            ),
          },
          {
            head: "Point at any of them",
            body: (
              <>
                The name, how busy a mark it is, and the tide, sea and seabed at
                its best hour.
              </>
            ),
          },
        ]}
      >
        <CitySpotMap rows={rows} cityLat={cityLat} cityLng={cityLng} />
      </Section>

      {/* `from` names the wall AND the city, matching what ProGate already
          writes for the banner below the map (`city-<slug>`, `city-<slug>-map`).
          Per-city because the ads are bought per city, and per-wall because a
          day-3 tile and a day-9 tile are different asks — a shared name would
          let the cheaper one be credited to the dearer one.

          The modal writes this into the wall cookie on open, so it survives
          the trip out to Stripe and whatever the visitor converts into knows
          which tile sent them. */}
      {upgradeMounted && (
        <ProTrialModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          feature={lockedTier === "free" ? "forecast-week" : "forecast-14d"}
          from={`city-${citySlug}-${
            lockedTier === "free" ? "forecast-week" : "forecast-14d"
          }`}
        />
      )}
    </>
  );
}
