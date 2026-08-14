"use client";

import Link from "next/link";
import {
  ChevronRight,
  Home,
  Lock,
  Sailboat,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RightNowSnapshot } from "@/lib/bluecaster/live-spot-types";
import { TIER_PILL } from "@/app/explore/lib/explore-data";
import SpotDayStrip, {
  type SpotDay,
} from "@/app/explore/components/spot-day-strip";
import {
  freshVerdictStyle,
  reportAge,
  type RailFreshCatch,
} from "@/app/explore/lib/fresh-catch-types";

// Score tier → the design-system tokens, unmodified. These are the same
// --rc-good / --rc-fair / --rc-poor values the pins, the bars and the score
// ticker use, and the ticker already runs them straight onto navy — so a dark
// surface is no reason to invent a second palette, which is what the lighter
// greens here used to be. Cuts are the system's: 75 / 55.
const TIER = {
  good: { line: "var(--rc-good)", pill: TIER_PILL.good },
  fair: { line: "var(--rc-fair)", pill: TIER_PILL.fair },
  poor: { line: "var(--rc-poor)", pill: TIER_PILL.poor },
} as const;
type Tier = keyof typeof TIER;
const tierOf = (s: number): Tier => (s >= 75 ? "good" : s >= 55 ? "fair" : "poor");

function seaState(waveM: number | null | undefined): string | null {
  if (typeof waveM !== "number") return null;
  if (waveM < 0.3) return "Calm";
  if (waveM < 0.6) return "Light chop";
  if (waveM < 1.2) return "Moderate";
  return "Rough";
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export type TideRead = {
  trend: "rising" | "falling";
  /** The next turn of the tide, if one falls inside the day's series. */
  turn: { kind: "high" | "low"; at: string; heightM: number } | null;
  /** Index of the point nearest now, so the chart can mark it without a clock. */
  nowIndex: number;
};

/**
 * Derive the tide's direction, and the next turn, from the day's hourly curve.
 *
 * `rightNow.tideTrend` arrives null — checked against the live payload, which
 * carries `tideM: 1.33` and `tideTrend: null` in the same object — so the tile's
 * ↑/↓ never drew and the card's footer fell through to a line of filler. The
 * curve that would have answered it is right there in `tide14d`: 24 hourly
 * points over the local day, whose value at the current hour matches
 * `rightNow.tideM` exactly.
 *
 * MUST be called from an effect, never during render. It reads the clock, and
 * a clock read in render is what put React #418 on the spot page.
 */
export function deriveTide(points: { hourUtc: string; heightM: number }[] | null | undefined): TideRead | null {
  if (!points || points.length < 2) return null;
  const now = Date.now();
  let at = 0;
  let best = Infinity;
  points.forEach((p, i) => {
    const d = Math.abs(new Date(p.hourUtc).getTime() - now);
    if (d < best) {
      best = d;
      at = i;
    }
  });
  const here = points[at];
  const next = points[at + 1];
  const prev = points[at - 1];
  const trend: TideRead["trend"] = next
    ? next.heightM >= here.heightM
      ? "rising"
      : "falling"
    : prev && here.heightM >= prev.heightM
      ? "rising"
      : "falling";

  // The first place the slope flips sign at or after now.
  let turn: TideRead["turn"] = null;
  for (let i = at; i + 2 < points.length; i++) {
    const d1 = points[i + 1].heightM - points[i].heightM;
    const d2 = points[i + 2].heightM - points[i + 1].heightM;
    if (d1 === 0 || d2 === 0) continue;
    if (d1 > 0 !== d2 > 0) {
      turn = {
        kind: d1 > 0 ? "high" : "low",
        at: points[i + 1].hourUtc,
        heightM: points[i + 1].heightM,
      };
      break;
    }
  }
  return { trend, turn, nowIndex: at };
}

/** "11 AM" in the water's own timezone, not the reader's. */
function turnTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-US", {
      timeZone: "America/Vancouver",
      hour: "numeric",
      minute: "2-digit",
    })
    .replace(":00", "");
}

/**
 * The score, drawn as an arc rather than a bare number. A 0–100 reading means
 * nothing on its own to someone who has not learned the scale — the ring gives
 * it a denominator you can read at a glance, which is the whole job of the
 * card's biggest element.
 */
function ScoreRing({ score }: { score: number | null }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const tier = score == null ? null : tierOf(score);
  const stroke = tier ? TIER[tier].line : "rgba(255,255,255,0.35)";

  return (
    <div className="relative h-[84px] w-[84px] shrink-0 sm:h-[104px] sm:w-[104px]">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="6"
        />
        {score != null && (
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Inter 700, the system's numeral face — `font-black` was a weight the
            type scale does not carry. */}
        <span className="text-[26px] font-bold leading-none tabular-nums sm:text-[32px]">
          {score ?? "—"}
        </span>
        {tier && (
          <span
            className={`mt-1 rounded px-1.5 py-0.5 font-rc-mono text-[9px] font-bold uppercase tracking-[0.06em] ${TIER[tier].pill}`}
          >
            {tier}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Today's 24 hourly scores as a micro bar chart. The peak hour is called out in
 * full colour and labelled; every other hour is dimmed, so the card answers
 * "when do I go?" without the angler opening the spot page.
 */
function HourStrip({
  hours,
  peakHour,
  score,
}: {
  hours: (number | null)[];
  peakHour: number | null;
  score: number | null;
}) {
  const tier = score == null ? "good" : tierOf(score);
  const peak = TIER[tier].line;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-rc-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-white/45">
          Today, hour by hour
        </span>
        {peakHour != null && (
          <span className="font-rc-mono text-[9px] font-bold uppercase tracking-[0.06em] text-white/80">
            Best {hourLabel(peakHour)}
          </span>
        )}
      </div>
      {/* Taller and more separated on desktop: at full width 24 bars each get
          ~55px, and at the phone's 9px height they read as a row of blocks
          rather than a chart. */}
      <div className="flex h-9 items-end gap-[2px] sm:h-14 sm:gap-1">
        {hours.map((h, i) => {
          const isPeak = peakHour === i;
          // Floor the height so a scored-but-poor hour still reads as a bar
          // rather than vanishing into the baseline.
          const pct = h == null ? 0 : Math.max(8, Math.min(100, h));
          return (
            <div
              key={i}
              className="flex-1 rounded-[1px] transition-all duration-500 sm:rounded-sm"
              style={{
                height: `${pct}%`,
                background: h == null
                  ? "rgba(255,255,255,0.07)"
                  : isPeak
                    ? peak
                    : "rgba(255,255,255,0.28)",
              }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between font-rc-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-white/35">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>
    </div>
  );
}

/**
 * Today's tide, as a curve. The card already reads `tide14d` to work out which
 * way the water is going; drawing it costs no request and answers the question
 * the two numbers could not — not just "ebbing, low at 11 AM" but how hard, and
 * how long you have.
 *
 * `nowIndex` is passed in rather than found here: locating "now" means reading
 * the clock, and a clock read during render is what put React #418 on the spot
 * page. See `deriveTide`.
 */
function TideChart({
  points,
  nowIndex,
  trend,
  turn,
  station,
}: {
  points: { hourUtc: string; heightM: number }[];
  nowIndex: number;
  trend: "rising" | "falling";
  turn: TideRead["turn"];
  station?: string | null;
}) {
  const W = 300;
  const H = 46;
  const hs = points.map((p) => p.heightM);
  const lo = Math.min(...hs);
  const hi = Math.max(...hs);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  // 3px of padding top and bottom so the extremes are not clipped by the stroke.
  const y = (h: number) => H - 3 - ((h - lo) / span) * (H - 6);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.heightM).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const nx = x(nowIndex);
  const ny = y(points[nowIndex].heightM);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-rc-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-white/45">
          Tide{station ? ` · ${station}` : ""}
        </span>
        <span className="truncate font-rc-mono text-[9px] font-bold uppercase tracking-[0.06em] text-white/80">
          {trend === "rising" ? "Flood" : "Ebb"}
          {turn ? ` · ${turn.kind} ${turnTime(turn.at)}` : ""}
        </span>
      </div>
      {/* The curve stretches to the card's width, so the SVG runs with
          `preserveAspectRatio="none"`. That scales x and y unequally, which
          turns a <circle> into an ellipse — badly so at desktop width. The
          now-marker is therefore a DOM dot positioned in percentages over the
          chart, where it stays round at any size. */}
      <div className="relative h-[46px] w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden
        >
          <path d={area} fill="rgba(255,255,255,0.08)" />
          <path
            d={line}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={nx}
            y1="0"
            x2={nx}
            y2={H}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          aria-hidden
          className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rc-good ring-2 ring-rc-navy"
          style={{ left: `${(nx / W) * 100}%`, top: `${(ny / H) * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-rc-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-white/35">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>11p</span>
      </div>
    </div>
  );
}

function ConditionTile({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.06] px-3 py-2">
      <div className="flex items-center gap-1 font-rc-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-white/45">
        <Icon className="h-3 w-3" strokeWidth={2.2} />
        {label}
      </div>
      <div className="mt-1 font-rc-mono text-[12px] font-medium leading-4 tabular-nums">
        {value ?? "—"}
      </div>
    </div>
  );
}

/**
 * The pinned home spot, as the dashboard's hero. One tap through to the spot
 * page; everything on it is today's answer for that water — the score with its
 * scale, the hour to be on it, and the four conditions an angler checks before
 * loading the boat.
 */
export default function HomeSpotHero({
  slug,
  name,
  species,
  score,
  rightNow,
  hours24,
  peakHour,
  days14,
  speciesScores,
  tide,
  tidePoints,
  tideStation,
  reports,
}: {
  slug: string;
  name: string;
  species: string | null;
  score: number | null;
  rightNow: RightNowSnapshot | null;
  hours24?: (number | null)[];
  peakHour?: number | null;
  /** undefined = still reading (hold the space), null = nothing to draw. */
  days14?: SpotDay[] | null;
  /** Every species scoring here today, best first. */
  speciesScores?: { name: string; score: number }[];
  /** Direction and next turn, derived in an effect — see `deriveTide`. */
  tide?: TideRead | null;
  /** The day's hourly tide curve, for the chart. */
  tidePoints?: { hourUtc: string; heightM: number }[] | null;
  /** Which station the curve is read from — Victoria Harbour, etc. */
  tideStation?: string | null;
  /** Scraped reports for this spot. Counts absent for a free viewer. */
  reports?: RailFreshCatch;
}) {
  const rn = rightNow;
  const hasHours = !!hours24?.some((h) => h != null);
  // The single top species is the fallback; a list is better when it exists.
  const speciesList =
    speciesScores && speciesScores.length > 0
      ? speciesScores
      : species
        ? [{ name: species, score: score ?? 0 }]
        : [];
  const trend = tide?.trend ?? rn?.tideTrend ?? null;

  return (
    // Flat --rc-navy, 4px radius, the panel shadow token. The gradient and the
    // two radial washes that used to live here were invented for this one card:
    // the system has no gradient, every other navy surface in the app is a flat
    // fill, and the frontend's radius tokens are 4px across the board (xs
    // through lg) with `rounded` on every shipped card.
    <Link
      href={`/explore/spot/${slug}`}
      className="group relative block overflow-hidden rounded bg-rc-navy text-white shadow-rc-panel transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="relative p-4 sm:p-6">
        {/* ── Title + score ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-rc-mono text-[9px] font-semibold uppercase tracking-[0.06em] text-white/55">
              <Home className="h-3.5 w-3.5" />
              Home spot
            </div>
            <h2 className="mt-2 text-2xl font-bold leading-8 tracking-[-0.01em]">
              {name}
            </h2>
            {/* What anglers are reporting, on the card that ranks highest on
                the page. "Around you" below sorts on exactly this, and the
                hero was the one place still silent about it. */}
            {reports && (reports.count ?? 0) > 0 && !reports.locked ? (
              <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {reports.verdict && (
                  <span
                    className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] ${
                      freshVerdictStyle(reports.verdict).cls
                    }`}
                  >
                    {freshVerdictStyle(reports.verdict).label}
                  </span>
                )}
                <span className="font-rc-mono text-[11px] text-white/70">
                  {reports.count} report{reports.count === 1 ? "" : "s"}
                  {reports.latestDate ? ` · ${reportAge(reports.latestDate)}` : ""}
                </span>
              </span>
            ) : reports?.locked ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] text-white/60">
                <Lock className="h-2.5 w-2.5" />
                Reports tracked
              </span>
            ) : null}
          </div>
          <ScoreRing score={score} />
        </div>

        {/* Every species scoring here, not just the winner. At this spot the
            top three sit inside a single point — Crab 84, Coho 83, Lingcod 83 —
            so naming only the leader told an angler after salmon that their
            home water was a crab spot. */}
        {speciesList.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {speciesList.map((s, i) => (
              <span
                key={s.name}
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-rc-mono text-[9px] font-bold uppercase tracking-[0.06em] ${
                  i === 0
                    ? "border-white/25 bg-white/15 text-white"
                    : "border-white/10 bg-white/[0.06] text-white/70"
                }`}
              >
                {s.name}
                {s.score > 0 && (
                  <span className="tabular-nums text-white/60">{s.score}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* ── Today's hours ──────────────────────────────────────────────── */}
        {hasHours && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <HourStrip
              hours={hours24!}
              peakHour={peakHour ?? null}
              score={score}
            />
          </div>
        )}

        {/* ── Today's tide ───────────────────────────────────────────────── */}
        {tide && tidePoints && tidePoints.length > 1 && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <TideChart
              points={tidePoints}
              nowIndex={tide.nowIndex}
              trend={tide.trend}
              turn={tide.turn}
              station={tideStation}
            />
          </div>
        )}

        {/* ── The fortnight ──────────────────────────────────────────────────
            The shared `SpotDayStrip`, at the same labelled density every saved
            spot card below uses — same cells, same tier fills, same yellow ring
            on the best day. It is built for a white card, so it gets one:
            an inset panel rather than a navy-native restyle, which is what
            keeps it identical to the cards it is meant to match. */}
        {days14 === undefined ? (
          <div className="mt-4">
            <div className="h-[74px] animate-pulse rounded bg-white/[0.05]" />
          </div>
        ) : days14 && days14.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded bg-rc-panel">
            <SpotDayStrip days={days14} density="labelled" />
          </div>
        ) : null}

        {/* ── Conditions right now ───────────────────────────────────────── */}
        {rn && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:grid-cols-4">
            <ConditionTile
              Icon={Waves}
              label="Tide"
              value={
                rn.tideM != null
                  ? `${rn.tideM.toFixed(1)} m${
                      trend === "rising" ? " ↑" : trend === "falling" ? " ↓" : ""
                    }`
                  : null
              }
            />
            <ConditionTile
              Icon={Wind}
              label="Wind"
              value={
                rn.windKt != null
                  ? `${Math.round(rn.windKt)} kn${rn.windDir ? ` ${rn.windDir}` : ""}`
                  : null
              }
            />
            <ConditionTile
              Icon={Thermometer}
              label="Water"
              value={rn.seaTempC != null ? `${rn.seaTempC.toFixed(1)} °C` : null}
            />
            <ConditionTile Icon={Sailboat} label="Sea" value={seaState(rn.waveM)} />
          </div>
        )}

        {/* ── The way in ─────────────────────────────────────────────────────
            The flood/ebb line that used to sit here now heads the tide chart,
            where it belongs — repeating it under a drawing of the same thing
            was saying it twice. */}
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-white/10 pt-3.5">
          <span className="flex shrink-0 items-center gap-0.5 font-rc-mono text-[9px] font-bold uppercase tracking-[0.06em] text-white/70 transition-colors group-hover:text-white">
            View spot
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
