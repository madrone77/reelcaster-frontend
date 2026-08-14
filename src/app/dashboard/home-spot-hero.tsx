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
import type { SpotDay } from "@/app/explore/components/spot-day-strip";
import {
  freshVerdictStyle,
  reportAge,
  type RailFreshCatch,
} from "@/app/explore/lib/fresh-catch-types";

// Score tier → the ring stroke and the badge. Same three cuts the rest of the
// app uses (75 / 55), but tuned for a dark card: the badge fills read as ink on
// white elsewhere, and at 10% opacity on navy they need their own light ink.
const TIER = {
  good: { ring: "#4ADE80", badgeBg: "rgba(74,222,128,0.14)", badgeInk: "#86EFAC" },
  fair: { ring: "#FBBF24", badgeBg: "rgba(251,191,36,0.14)", badgeInk: "#FCD34D" },
  poor: { ring: "#F87171", badgeBg: "rgba(248,113,113,0.14)", badgeInk: "#FCA5A5" },
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
  return { trend, turn };
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
  const stroke = tier ? TIER[tier].ring : "rgba(255,255,255,0.35)";

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
            style={{ filter: `drop-shadow(0 0 6px ${stroke}66)` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-black leading-none tabular-nums sm:text-[32px]">
          {score ?? "—"}
        </span>
        {tier && (
          <span
            className="mt-1 rounded px-1.5 py-0.5 font-rc-mono text-[9px] font-bold uppercase tracking-[0.08em]"
            style={{ background: TIER[tier].badgeBg, color: TIER[tier].badgeInk }}
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
  const peak = TIER[tier].ring;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-rc-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
          Today, hour by hour
        </span>
        {peakHour != null && (
          <span className="font-rc-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">
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
                boxShadow: isPeak ? `0 0 8px ${peak}88` : undefined,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between font-rc-mono text-[9px] uppercase tracking-[0.1em] text-white/35">
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
 * The next fortnight, as one bar per day. The shared `SpotDayStrip` is built
 * for a white card — its tier tokens are washes meant to sit on `rc-surface`
 * and disappear against navy — so this is the hero's own rendering of the same
 * `SpotDay[]`, off the same bulk payload as every card below.
 *
 * Bar heights are scaled to THIS fortnight's own range, not to 0–100 or to the
 * shared strip's fixed floor of 40. After the engine's rescale a good spot's
 * fourteen days sit inside a band like 82–90, which on any absolute scale is
 * fourteen identical bars — the one question the strip exists to answer, which
 * day to pick, is exactly the one it then cannot show. The trade is that a
 * three-point spread draws as dramatically as a thirty-point one, so the range
 * is printed next to the label: the shape is relative, the numbers are not.
 */
function DayStrip({ days }: { days: SpotDay[] }) {
  const scored = days.filter((d) => d.score !== null);
  const best = scored.reduce<SpotDay | null>(
    (top, d) => (!top || d.score! > top.score! ? d : top),
    null,
  );
  const lockedCount = days.filter((d) => d.locked).length;
  const values = scored.map((d) => d.score!);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;
  const span = hi - lo;
  const heightPct = (s: number | null) => {
    if (s === null) return 8;
    // A flat fortnight is a real answer — draw it flat rather than letting
    // rounding noise invent a shape out of a one-point spread.
    if (span < 2) return 72;
    return 32 + 68 * ((s - lo) / span);
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-rc-mono text-[9px] uppercase tracking-[0.14em] text-white/45">
          Next 14 days
          {values.length > 1 && (
            <span className="text-white/30">
              {" "}
              · {lo}–{hi}
            </span>
          )}
        </span>
        {lockedCount > 0 ? (
          <span className="flex shrink-0 items-center gap-1 font-rc-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white/60">
            <Lock className="h-2.5 w-2.5" />
            {lockedCount} more
          </span>
        ) : (
          best && (
            <span className="truncate font-rc-mono text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">
              Best {best.dow} {best.date} · {best.score}
            </span>
          )
        )}
      </div>

      <div className="flex h-12 items-end gap-[3px] sm:h-16 sm:gap-1.5">
        {days.map((d, i) => {
          if (d.locked) {
            return (
              <div
                key={i}
                title={`${d.dow} ${d.date} · locked`}
                className="h-full flex-1 rounded-sm border border-dashed border-white/15 bg-white/[0.03]"
              />
            );
          }
          const isBest = best !== null && d === best;
          const tint =
            d.score === null ? null : TIER[tierOf(d.score)].ring;
          return (
            <div
              key={i}
              title={`${d.dow} ${d.date}${d.score !== null ? ` · ${d.score}` : ""}`}
              className="flex-1 rounded-sm transition-all duration-500"
              style={{
                height: `${heightPct(d.score)}%`,
                background: tint ?? "rgba(255,255,255,0.10)",
                // Only the best day runs at full strength; the rest are dimmed
                // so the shape of the fortnight reads before the detail does.
                opacity: tint ? (isBest ? 1 : 0.42) : 1,
                boxShadow: isBest && tint ? `0 0 8px ${tint}88` : undefined,
              }}
            />
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-[3px] sm:gap-1.5">
        {days.map((d, i) => (
          <span
            key={i}
            className="flex-1 text-center font-rc-mono text-[9px] uppercase text-white/35"
          >
            {d.dow.slice(0, 1)}
          </span>
        ))}
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
    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
      <div className="flex items-center gap-1.5 font-rc-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
        <Icon className="h-3 w-3" strokeWidth={2.2} />
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold leading-tight tabular-nums">
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
    <Link
      href={`/explore/spot/${slug}`}
      className="group relative block overflow-hidden rounded-2xl text-white shadow-[0_10px_30px_-12px_rgba(11,18,32,0.55)] transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(150deg, #1B2C63 0%, #16234E 45%, #0F1B3D 100%)",
      }}
    >
      {/* Depth wash — a soft light source off the top-right corner, and a
          waterline glow along the bottom. Decorative, so it never eats a tap. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 88% -20%, rgba(30,64,224,0.45) 0%, rgba(30,64,224,0) 60%), radial-gradient(80% 60% at 10% 115%, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0) 70%)",
        }}
      />

      <div className="relative p-5 sm:p-6">
        {/* ── Title + score ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-rc-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
              <Home className="h-3.5 w-3.5" />
              Home spot
            </div>
            <h2 className="mt-2 text-[26px] font-black leading-[1.1] tracking-[-0.02em] sm:text-3xl">
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-rc-mono text-[10px] font-bold uppercase tracking-[0.08em] ${
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

        {/* ── The fortnight ──────────────────────────────────────────────── */}
        {days14 === undefined ? (
          // Hold the space rather than letting the conditions jump down when
          // the bulk outlook lands a beat after the rest of the card.
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="h-[74px] animate-pulse rounded bg-white/[0.05] sm:h-[94px]" />
          </div>
        ) : days14 && days14.length > 0 ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <DayStrip days={days14} />
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

        {/* ── Tide state + the way in ────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3.5">
          {trend ? (
            <span className="flex min-w-0 items-center gap-2 font-rc-mono text-[10px] uppercase tracking-[0.1em] text-white/70">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rc-good opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rc-good" />
              </span>
              <span className="truncate">
                {trend === "rising" ? "Flood · rising" : "Ebb · falling"}
                {/* The turn is the actionable half: "ebb" tells you which way
                    the water is going, "low 11 AM" tells you when to be on it. */}
                {tide?.turn
                  ? ` · ${tide.turn.kind} ${turnTime(tide.turn.at)}`
                  : ""}
              </span>
            </span>
          ) : (
            <span className="font-rc-mono text-[10px] uppercase tracking-[0.1em] text-white/40">
              Your pinned water
            </span>
          )}
          <span className="flex shrink-0 items-center gap-0.5 font-rc-mono text-[10px] font-bold uppercase tracking-[0.1em] text-white/70 transition-colors group-hover:text-white">
            View spot
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
