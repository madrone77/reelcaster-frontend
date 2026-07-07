"use client";

import Link from "next/link";
import { HourScrubber } from "./HourScrubber";
import {
  scoreColor,
  scorePill,
  seaState,
  hourClock,
  bestWindow,
  type CondGridCell,
  type HourScore,
  type MapSpot,
} from "./scoring-ui";

interface SpotDetailProps {
  spot: MapSpot;
  speciesName: string | null;
  score: number | null; // cursor-hour score 0..1
  peakHour: number | null;
  hour: number;
  strip: (HourScore | null)[]; // 24h for the pinned species
  cond: CondGridCell | null; // conditions at the cursor hour
  dateLabel: string | null;
  areaLabel: string | null;
  topPx: number;
  onClose: () => void;
  onScrubHour: (h: number) => void;
}

const PILL: Record<string, string> = {
  good: "bg-rcc-good-bg text-rcc-good",
  fair: "bg-rcc-fair-bg text-rcc-fair",
  poor: "bg-orange-100 text-rcc-poor",
  none: "bg-slate-100 text-rcc-faint",
};

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] font-bold uppercase text-rcc-faint">{label}</p>
      <p className="font-mono text-[13px] font-bold text-rcc-ink">{value}</p>
      {sub && <p className="font-mono text-[10px] text-rcc-muted">{sub}</p>}
    </div>
  );
}

export function SpotDetail({
  spot,
  speciesName,
  score,
  peakHour,
  hour,
  strip,
  cond,
  dateLabel,
  areaLabel,
  topPx,
  onClose,
  onScrubHour,
}: SpotDetailProps) {
  const pill = scorePill(score);
  const win = bestWindow(strip);

  const num = (v: number | null | undefined, d = 1) => (v == null ? null : v.toFixed(d));
  const tideArrow = cond?.tideTrend === "rising" ? " ▲" : cond?.tideTrend === "falling" ? " ▼" : "";

  return (
    <aside
      style={{ top: topPx, maxHeight: `calc(100dvh - ${topPx + 24}px)` }}
      className="scrollbar-hide pointer-events-auto absolute left-3 z-10 flex w-[387px] flex-col overflow-y-auto rounded-[4px] bg-white/90 px-5 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-rcc-line backdrop-blur-[2px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-rcc-muted hover:text-rcc-ink">
          <span className="text-rcc-brand">‹</span>
          Selected{dateLabel ? ` · ${dateLabel}` : ""}{peakHour != null ? ` · ${hourClock(peakHour)}` : ""}
        </button>
        <button onClick={onClose} aria-label="Close" className="text-rcc-faint hover:text-rcc-ink">✕</button>
      </div>

      {/* Title */}
      <div className="mt-2 flex items-start justify-between gap-2">
        <h2 className="text-[30px] font-bold leading-tight text-rcc-ink">{spot.name}</h2>
        <Link
          href={`/spot/${spot.slug}`}
          className="mt-1 shrink-0 text-[13px] font-medium text-rcc-brand hover:underline"
        >
          View spot details
        </Link>
      </div>
      {areaLabel && <p className="mt-1 font-mono text-[12px] text-rcc-muted">{areaLabel}</p>}

      <div className="my-3 border-t border-rcc-line" />

      {/* Score */}
      <div className="flex items-center gap-4">
        <span className="font-sans text-[44px] font-bold leading-none" style={{ color: scoreColor(score) }}>
          {score === null ? "—" : Math.round(score * 100)}
        </span>
        <div>
          <span className={`rounded-[4px] px-2 py-0.5 font-mono text-[10px] font-bold ${PILL[pill.tone]}`}>{pill.label}</span>
          <p className="mt-1.5 font-mono text-[11px] text-rcc-muted">
            {speciesName ? `${speciesName} driving · peak ${hourClock(peakHour)}` : "Nothing biting now"}
          </p>
        </div>
      </div>

      <div className="my-3 border-t border-rcc-line" />

      {/* Conditions grid */}
      <div className="grid grid-cols-3 gap-y-3">
        <Cell
          label="Wind"
          value={cond?.windKt != null ? `${Math.round(cond.windKt)} kn ${cond.windDir ?? ""}`.trim() : "—"}
          sub={cond?.windGustKt != null ? `gust ${Math.round(cond.windGustKt)} kn` : undefined}
        />
        <Cell
          label="Tide"
          value={cond?.tideM != null ? `${cond.tideM >= 0 ? "+" : ""}${num(cond.tideM)}m${tideArrow}` : "—"}
          sub={cond?.tideTrend ?? undefined}
        />
        <Cell
          label="Sea"
          value={cond?.waveM != null ? seaState(cond.waveM) : "—"}
          sub={cond?.swellM != null ? `${num(cond.swellM)} m swell` : undefined}
        />
        <Cell label="Water" value={cond?.seaTempC != null ? `${num(cond.seaTempC)}°` : "—"} />
        <Cell label="Air" value={cond?.airTempC != null ? `${num(cond.airTempC)}°` : "—"} />
        <Cell
          label="Sky"
          value={cond?.cloudPct != null ? `${Math.round(cond.cloudPct)}% cloud` : "—"}
          sub={cond?.precipMm != null && cond.precipMm > 0 ? `${num(cond.precipMm)} mm rain` : undefined}
        />
      </div>

      <div className="my-3 border-t border-rcc-line" />

      {/* 24h chart */}
      <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-rcc-ink">
        24h{win ? ` · best window ${hourClock(win.start)}–${hourClock(win.end + 1)}` : ""}
      </p>
      <div className="mt-2">
        <HourScrubber
          scores={strip.map((c) => (c ? Math.round(c.s * 100) : null))}
          hour={hour}
          onHour={onScrubHour}
          colorFor={(v) => scoreColor(v == null ? null : v / 100)}
          best={win}
          height={64}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-rcc-faint">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-[4px] bg-rcc-brand px-3 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wide text-white hover:brightness-110">
          View 14-day report →
        </button>
        <button className="rounded-[4px] border border-rcc-line px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wide text-rcc-ink hover:bg-slate-50">
          Set alert
        </button>
      </div>
    </aside>
  );
}
