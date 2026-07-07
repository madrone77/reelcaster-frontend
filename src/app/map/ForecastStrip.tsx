"use client";

import { dailyTone, hourClock, type StripDay } from "./scoring-ui";
import { usePro, FREE_FORECAST_DAYS } from "./usePro";

interface ForecastStripProps {
  days: StripDay[];
  speciesName: string | null;
  selectedIso: string | null;
  onPickDate: (iso: string) => void;
  onHide: () => void;
  onUpgrade: () => void;
}

export function ForecastStrip({ days, speciesName, selectedIso, onPickDate, onHide, onUpgrade }: ForecastStripProps) {
  const { isPro } = usePro();
  if (days.length === 0) return null;

  const visible = isPro ? days : days.slice(0, FREE_FORECAST_DAYS);
  const best = visible.reduce((a, b) => (b.score > a.score ? b : a), visible[0]);

  return (
    <div className="pointer-events-auto absolute right-3 top-[68px] left-3 z-10 rounded-[4px] bg-white/80 px-3 pb-2 pt-2.5 shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-rcc-line backdrop-blur-[2px] lg:left-[420px]">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-3 px-1">
        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-rcc-ink">
            14-day forecast{speciesName ? ` · ${speciesName}` : ""}
          </div>
          <div className="mt-0.5 text-[10px] text-rcc-faint">
            confidence fades past day 7 · ECMWF + GFS · tap a day, selected day drives the map
          </div>
        </div>
        <div className="flex items-center gap-3">
          {best && (
            <span className="hidden items-center gap-1.5 text-[12px] font-medium text-rcc-ink sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Best window {best.dow} {best.date}
              {best.peakHour != null ? ` · ${hourClock(best.peakHour)}` : ""}
            </span>
          )}
          <button
            onClick={onHide}
            className="rounded-lg bg-rcc-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
          >
            Hide
          </button>
        </div>
      </div>

      {/* Day cards */}
      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-1 pb-0 pt-3">
        {days.map((d, i) => {
          const gated = !isPro && i >= FREE_FORECAST_DAYS;
          const selected = d.iso === selectedIso;
          const isBest = best && d.iso === best.iso && !gated;
          const tone = dailyTone(d.score);
          return (
            <button
              key={d.iso}
              onClick={() => (gated ? onUpgrade() : onPickDate(d.iso))}
              className={`relative flex w-[64px] shrink-0 flex-col items-center rounded-[4px] border px-[10px] pb-[15px] pt-[13px] transition ${
                selected
                  ? "border-transparent bg-[#4762e6] text-white shadow-md"
                  : gated
                    ? "border-[#e5e9ef] bg-slate-50"
                    : "border-[#e5e9ef] bg-white hover:border-slate-300"
              }`}
            >
              {isBest && (
                <span className="absolute -top-2 rounded bg-amber-400 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#1c1917]">
                  Best
                </span>
              )}
              <span className={`font-mono text-[9px] font-bold uppercase ${selected ? "text-white/80" : "text-[#94a3b8]"}`}>
                {d.dow}
              </span>
              <span className={`font-mono text-[10px] ${selected ? "text-white/70" : "text-[#475569]"}`}>{d.date}</span>

              {gated ? (
                <span className="mt-2 flex flex-col items-center pb-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rcc-faint">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  <span className="mt-1 text-[7px] font-bold uppercase tracking-wide text-rcc-faint">Boat Pro</span>
                </span>
              ) : (
                <>
                  <span
                    className="mt-1 font-sans text-[24px] font-bold leading-none"
                    style={{ color: selected ? "#ffffff" : tone.text }}
                  >
                    {d.score}
                  </span>
                  {d.peakHour != null && (
                    <span
                      className="mt-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold"
                      style={
                        selected
                          ? { background: "transparent", color: "#fff" }
                          : { background: tone.pillBg, color: tone.pillText }
                      }
                    >
                      {hourClock(d.peakHour)}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
