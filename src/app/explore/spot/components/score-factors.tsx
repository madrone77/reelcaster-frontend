"use client";

import type { TodayFactor, FactorVerdict } from "@/lib/bluecaster/live-spot-types";

const VERDICT_CFG: Record<FactorVerdict, { dot: string; pill: string; label: string }> = {
  Prime: { dot: "bg-rc-good", pill: "bg-rc-good-bg text-rc-good-ink", label: "Prime" },
  Fair: { dot: "bg-rc-fair", pill: "bg-rc-fair-bg text-rc-fair-ink", label: "Fair" },
  Poor: { dot: "bg-rc-poor", pill: "bg-rc-poor-bg text-rc-poor-ink", label: "Tough" },
};

function FactorRow({ factor }: { factor: TodayFactor }) {
  const cfg = VERDICT_CFG[factor.status];
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex items-start gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full ${cfg.dot} mt-1.5 shrink-0`} aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-medium text-rc-ink leading-tight">{factor.label}</div>
          {factor.valueLine && (
            <div className="font-rc-mono text-[11px] text-rc-ink-mute leading-tight mt-0.5">
              {factor.valueLine}
            </div>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.04em] ${cfg.pill}`}
      >
        {cfg.label}
      </span>
    </div>
  );
}

/**
 * "Why this score" — the factors the scoring engine actually weighed for the
 * current species today (tide/current/wind/light/season, per-factor Prime /
 * Fair / Tough + the real reading that drove it). This is the same
 * `todayFactorsBySpecies` the engine has always returned; it just wasn't
 * surfaced on the modular spot-detail page yet.
 */
export default function ScoreFactors({ factors }: { factors: TodayFactor[] }) {
  return (
    <div>
      <div className="rc-label text-[9px] mb-1">Why this score</div>
      {factors.length > 0 ? (
        <div className="divide-y divide-rc-rule-soft">
          {factors.map((f) => (
            <FactorRow key={f.label} factor={f} />
          ))}
        </div>
      ) : (
        <p className="font-rc-mono text-xs text-rc-ink-mute italic py-2">
          No factor breakdown for this species yet.
        </p>
      )}
    </div>
  );
}
