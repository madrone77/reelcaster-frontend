"use client";

import { useMemo, useState } from "react";
import type { BlueCasterSpotPage } from "@/lib/bluecaster";

type ForecastRow = BlueCasterSpotPage["forecast"]["rows"][number];

interface DayBucket {
  dateLabel: string;          // "Mon Apr 21"
  isoDate: string;            // "2026-04-21"
  dayBest: number | null;     // 0..1
  hourly: Array<{ hour: number; score: number | null }>; // 24 hours
}

function bucketByDay(
  rows: ForecastRow[],
  speciesId: string | "all"
): DayBucket[] {
  const filtered =
    speciesId === "all" ? rows : rows.filter((r) => r.species_id === speciesId);

  const byDay = new Map<string, Map<number, number>>();
  for (const r of filtered) {
    const d = new Date(r.hour_utc);
    const key = d.toISOString().slice(0, 10);
    const hour = d.getUTCHours();
    if (!byDay.has(key)) byDay.set(key, new Map());
    const inner = byDay.get(key)!;
    const prev = inner.get(hour);
    if (prev === undefined || r.score > prev) inner.set(hour, r.score);
  }

  const dayKeys = Array.from(byDay.keys()).sort();
  return dayKeys.map((isoDate) => {
    const inner = byDay.get(isoDate)!;
    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      score: inner.has(h) ? (inner.get(h) as number) : null,
    }));
    let dayBest: number | null = null;
    for (const v of inner.values()) {
      if (dayBest === null || v > dayBest) dayBest = v;
    }
    const d = new Date(isoDate + "T12:00:00Z");
    const dateLabel = d.toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return { isoDate, dateLabel, dayBest, hourly };
  });
}

function scoreColor(score: number | null): string {
  if (score === null) return "bg-stone-200";
  if (score >= 0.85) return "bg-blue-700";
  if (score >= 0.7) return "bg-emerald-600";
  if (score >= 0.55) return "bg-emerald-400";
  if (score >= 0.4) return "bg-amber-400";
  if (score >= 0.25) return "bg-orange-300";
  return "bg-stone-300";
}

export default function SpotForecastStrip({
  forecast,
  speciesOptions,
}: {
  forecast: BlueCasterSpotPage["forecast"];
  speciesOptions: Array<{ id: string; name: string }>;
}) {
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const days = useMemo(
    () => bucketByDay(forecast.rows, speciesFilter),
    [forecast.rows, speciesFilter]
  );

  if (days.length === 0) {
    return null;
  }

  const activeDay = days[Math.min(activeDayIndex, days.length - 1)];

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">
            14-Day Forecast
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-mono tracking-wide">
            Hourly RC scores. Click a day for hour-by-hour detail.
          </p>
        </div>
        {speciesOptions.length > 1 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="species-filter"
              className="font-mono text-xs uppercase tracking-widest text-slate-400"
            >
              Species
            </label>
            <select
              id="species-filter"
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="border border-stone-300 bg-white text-sm px-3 py-1.5 rounded text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">Best across all species</option>
              {speciesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 14-day strip */}
      <div className="overflow-x-auto -mx-6 px-6 pb-2">
        <div className="flex gap-1 min-w-max">
          {days.map((d, i) => {
            const score = d.dayBest;
            const pct = score != null ? Math.round(score * 100) : null;
            const isActive = i === activeDayIndex;
            return (
              <button
                key={d.isoDate}
                onClick={() => setActiveDayIndex(i)}
                className={`flex flex-col items-center px-2 py-3 rounded transition-colors text-center w-20 shrink-0 border ${
                  isActive
                    ? "border-slate-700 bg-stone-50"
                    : "border-stone-200 hover:border-stone-400"
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                  {d.dateLabel.split(" ")[0]}
                </div>
                <div className="font-mono text-xs text-slate-700 mb-2">
                  {d.dateLabel.split(" ").slice(1).join(" ")}
                </div>
                <div className="h-12 w-3 bg-stone-100 rounded-sm overflow-hidden flex flex-col justify-end">
                  {score != null && (
                    <div
                      className={`w-full ${scoreColor(score)} rounded-sm`}
                      style={{ height: `${Math.max(6, score * 100)}%` }}
                    />
                  )}
                </div>
                <div className="font-mono text-xs text-slate-700 mt-2 font-semibold">
                  {pct != null ? pct : "--"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 24-hour bars for active day */}
      <div className="mt-8 border border-stone-200 rounded-lg p-6 bg-stone-50">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
            {activeDay.dateLabel}
          </h3>
          <p className="font-mono text-xs uppercase tracking-widest text-slate-400">
            Hourly · UTC
          </p>
        </div>

        <div className="flex items-end gap-1 h-32">
          {activeDay.hourly.map((h) => {
            const score = h.score;
            const heightPct = score != null ? Math.max(4, score * 100) : 0;
            return (
              <div
                key={h.hour}
                className="flex-1 flex flex-col items-center justify-end h-full"
                title={
                  score != null
                    ? `${h.hour.toString().padStart(2, "0")}:00 — ${Math.round(score * 100)}`
                    : `${h.hour.toString().padStart(2, "0")}:00 — no data`
                }
              >
                <div
                  className={`w-full ${scoreColor(score)} rounded-t-sm`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 font-mono text-[10px] tracking-widest text-slate-400">
          {[0, 6, 12, 18, 23].map((h) => (
            <span key={h} style={{ marginLeft: h === 0 ? 0 : undefined }}>
              {h.toString().padStart(2, "0")}:00
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
