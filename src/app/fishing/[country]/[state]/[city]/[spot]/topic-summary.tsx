"use client";

import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import { formatFractionalHour12 } from "@/lib/time-format";
import {
  convertHeight,
  convertTemp,
  convertWind,
  formatHeight,
  formatTemp,
  formatWind,
} from "@/app/utils/unit-conversions";
import { windCardinal } from "@/app/explore/lib/wind-rose";
import type { TerminalHours } from "@/app/explore/spot/components/spot-terminal";
import type { ForecastDay } from "@/app/explore/lib/forecast-strip";
import type { LandingTopic } from "@/lib/landing-topic";

/**
 * The answer to the searched question, at the top of an ad landing.
 *
 * "active pass tides" gets today's highs and lows before the score, "currents"
 * gets slack and the peak flood and ebb, "wind" gets the wind. Every number is
 * read off the same hourly series the 24-hour chart draws, so the card and the
 * chart cannot disagree. Hourly data, so turn times are interpolated and
 * rounded to the quarter hour and said as "about".
 */

type Turn = { t: number; v: number; hi: boolean };

/** Interior turning points of an hourly series, located to the sub-hour. */
function turns(series: (number | null)[]): Turn[] {
  const out: Turn[] = [];
  for (let i = 1; i < series.length - 1; i++) {
    const p = series[i - 1], c = series[i], n = series[i + 1];
    if (p == null || c == null || n == null) continue;
    const hi = c > p && c >= n;
    const lo = c < p && c <= n;
    if (!hi && !lo) continue;
    const denom = p - 2 * c + n;
    const offset = denom === 0 ? 0 : (p - n) / (2 * denom);
    out.push({ t: i + Math.max(-0.5, Math.min(0.5, offset)), v: c, hi });
  }
  return out;
}

/** Zero crossings of a signed current series: slack water. */
function slacks(series: (number | null)[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < series.length - 1; i++) {
    const a = series[i], b = series[i + 1];
    if (a == null || b == null) continue;
    if (a === 0) out.push(i);
    else if (a * b < 0) out.push(i + a / (a - b));
  }
  return out;
}

const about = (t: number) => `about ${formatFractionalHour12(Math.round(t * 4) / 4)}`;

function Row({ label, value, past = false }: { label: string; value: string; past?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-2 border-b border-rc-rule last:border-b-0 ${past ? "opacity-45" : ""}`}>
      <span className="rc-label text-[10px]">{label}</span>
      <span className="text-[15px] font-semibold text-rc-ink text-right">{value}</span>
    </div>
  );
}

export default function TopicSummary({
  topic,
  spotName,
  fish,
  hours,
  current,
  nowHour,
  isToday,
  dayLabel,
  bestWindowLabel,
  days,
}: {
  topic: LandingTopic;
  spotName: string;
  fish: string | null;
  hours: TerminalHours;
  current: (number | null)[] | null;
  nowHour: number;
  isToday: boolean;
  /** "Today", or the picked day. */
  dayLabel: string;
  bestWindowLabel: string | null;
  days: ForecastDay[];
}) {
  const { windUnit, currentUnit, tempUnit, tideUnit } = useUnitPreferences();
  const past = (t: number) => isToday && t < nowHour;

  let title = "";
  let rows: Array<{ label: string; value: string; past?: boolean }> = [];

  if (topic === "tides") {
    title = `${dayLabel}'s tides at ${spotName}`;
    rows = turns(hours.tide).map((e) => ({
      label: e.hi ? "High tide" : "Low tide",
      value: `${formatHeight(convertHeight(e.v, "m", tideUnit), tideUnit)}, ${about(e.t)}`,
      past: past(e.t),
    }));
  } else if (topic === "currents") {
    title = `${dayLabel}'s currents at ${spotName}`;
    const series = current ?? [];
    const flood = turns(series).filter((e) => e.hi && e.v > 0).sort((a, b) => b.v - a.v)[0];
    const ebb = turns(series).filter((e) => !e.hi && e.v < 0).sort((a, b) => a.v - b.v)[0];
    rows = [
      ...slacks(series).map((t) => ({ label: "Slack", value: about(t), past: past(t) })),
      ...(flood ? [{ label: "Strongest flood", value: `${formatWind(convertWind(flood.v, "knots", currentUnit), currentUnit, 1)}, ${about(flood.t)}` }] : []),
      ...(ebb ? [{ label: "Strongest ebb", value: `${formatWind(convertWind(-ebb.v, "knots", currentUnit), currentUnit, 1)}, ${about(ebb.t)}` }] : []),
    ];
  } else if (topic === "weather") {
    title = `${dayLabel}'s wind and weather at ${spotName}`;
    const h = isToday ? nowHour : 12;
    const wind = hours.wind[h];
    const gust = hours.gust[h];
    let maxI = -1;
    hours.wind.forEach((v, i) => {
      if (v != null && (maxI < 0 || v > (hours.wind[maxI] ?? -1))) maxI = i;
    });
    const air = hours.air.filter((v): v is number => v != null);
    rows = [
      ...(wind != null
        ? [{
            label: isToday ? "Wind now" : "Wind at noon",
            value: `${formatWind(convertWind(wind, "knots", windUnit), windUnit)}${windCardinal(hours.windDir[h]) ? ` ${windCardinal(hours.windDir[h])}` : ""}${gust != null ? `, gusts ${formatWind(convertWind(gust, "knots", windUnit), windUnit)}` : ""}`,
          }]
        : []),
      ...(maxI >= 0 && hours.wind[maxI] != null
        ? [{ label: "Windiest", value: `${formatWind(convertWind(hours.wind[maxI]!, "knots", windUnit), windUnit)}, about ${formatFractionalHour12(maxI)}` }]
        : []),
      ...(hours.seaLabel?.[h] ? [{ label: "Sea state", value: hours.seaLabel[h]! }] : []),
      ...(air.length
        ? [{ label: "Air temp", value: `${formatTemp(convertTemp(Math.min(...air), "C", tempUnit), tempUnit)} to ${formatTemp(convertTemp(Math.max(...air), "C", tempUnit), tempUnit)}` }]
        : []),
    ];
  } else if (topic === "forecast") {
    title = `${fish ? `${fish} fishing` : "Fishing"} for the next 14 days at ${spotName}`;
    const open = days.filter((d) => !d.locked && d.score != null);
    const locked = days.filter((d) => d.locked).length;
    rows = [
      ...open.map((d) => ({ label: `${d.dow} ${d.date}`, value: `${d.score}${d.peakLabel ? ` at ${d.peakLabel}` : ""}` })),
      ...(locked ? [{ label: "Pro", value: `${locked} more days unlocked with Pro` }] : []),
    ];
  } else {
    return null;
  }

  if (rows.length === 0) return null;

  return (
    <section className="rounded border border-rc-rule bg-rc-panel px-4 py-3" data-testid="topic-summary">
      <h2 className="rc-label text-[10px] text-rc-brand">{title}</h2>
      <div className="mt-1">
        {rows.map((r) => (
          <Row key={`${r.label}-${r.value}`} label={r.label} value={r.value} past={r.past} />
        ))}
      </div>
      {bestWindowLabel && (
        <p className="mt-2 font-rc-mono text-[11px] text-rc-ink-soft">
          Best window{fish ? ` to catch ${fish}` : ""}: {bestWindowLabel}
        </p>
      )}
    </section>
  );
}
