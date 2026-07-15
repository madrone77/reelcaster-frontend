"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { tierFor, TIER_PILL, TIER_TEXT } from "../../lib/explore-data";

/**
 * Consolidated headline score card (per the Pedder Bay mockup): the live "NOW"
 * score for the driver species, today's peak, the best contiguous window, and
 * the two primary CTAs — all in one white panel so it reads as a single unit on
 * mobile and as the rail header on desktop.
 */
export default function ScoreCard({
  nowLabel,
  score,
  peak,
  peakTime,
  windowLabel,
  windowPeak,
  tidePhase,
  dfoArea,
  speciesName,
  regOpen,
  onSetAlert,
}: {
  /** e.g. "NOW · CHINOOK · 07:00 PDT" */
  nowLabel: string;
  /** Score at the current hour (0–100), null if unavailable. */
  score: number | null;
  /** Today's peak score. */
  peak: number | null;
  /** Today's peak time, e.g. "11:30". */
  peakTime: string | null;
  /** Best contiguous window, e.g. "10:00–13:00". */
  windowLabel: string | null;
  /** Score the window peaks at. */
  windowPeak: number | null;
  /** Tide phase at the peak, e.g. "Tide flooding". */
  tidePhase: string | null;
  /** DFO regulatory area code, e.g. "19-4". */
  dfoArea: string | null;
  /** Driver species common name, e.g. "Dungeness Crab". */
  speciesName: string | null;
  /** Whether the driver species is open (retention) in this area. */
  regOpen: boolean;
  /** Tapped "Set alert" — the shell gates signed-out anglers into sign-up. */
  onSetAlert: () => void;
}) {
  const tier = tierFor(score ?? peak);
  const windowSub = [
    windowPeak != null ? `Peaks at ${windowPeak}` : null,
    tidePhase,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <div className="rc-label text-[9px] text-rc-ink-mute">{nowLabel}</div>

      <div className="flex items-end gap-4 mt-2">
        <span
          className={`text-[64px] leading-[0.8] font-bold tracking-[-0.04em] ${
            tier === "fair" ? "text-rc-fair-ink" : TIER_TEXT[tier]
          }`}
        >
          {score ?? peak ?? "—"}
        </span>
        <div className="pb-1.5 space-y-1.5">
          <span
            className={`inline-block px-2 py-0.5 rounded font-rc-mono text-[11px] font-bold ${TIER_PILL[tier]}`}
          >
            {score != null || peak != null ? tier.toUpperCase() : "NO SCORE"}
          </span>
          {peak != null && (
            <p className="font-rc-mono text-xs text-rc-ink-soft">
              Best today {peak}
              {peakTime ? ` · ${peakTime}` : ""}
            </p>
          )}
        </div>
      </div>

      {windowLabel && (
        <div className="mt-4 rounded bg-rc-good-bg text-center py-3 px-3">
          <div className="rc-label text-[9px] text-rc-good-ink">BEST WINDOW</div>
          <div className="text-lg font-bold text-rc-good-ink mt-0.5">
            {windowLabel}
          </div>
          {windowSub && (
            <div className="font-rc-mono text-[11px] text-rc-good-ink/80 mt-0.5">
              {windowSub}
            </div>
          )}
        </div>
      )}

      {/* DFO notice — regulatory data, muted chrome, hairline border, no fill. */}
      {dfoArea && (
        <Link
          href="/regulations"
          className="mt-3 flex min-h-[44px] items-center justify-between gap-2 rounded border border-rc-fair-border bg-rc-fair-bg px-3 py-2 font-rc-mono text-[11px] text-rc-fair-ink hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand transition-all"
        >
          <span className="truncate">
            DFO · PFMA {dfoArea}
            {speciesName ? ` · ${speciesName} ${regOpen ? "open" : "closed"}` : ""}
          </span>
          <span className="shrink-0 text-rc-brand">Regulations →</span>
        </Link>
      )}

      {/* Single alert action — saving lives on the star beside the spot name.
          Outlined (not filled) so the score numeral stays the loudest thing. */}
      <button
        type="button"
        onClick={onSetAlert}
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded border border-rc-brand text-rc-brand hover:bg-rc-brand-soft text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand transition-colors"
      >
        <Bell className="w-4 h-4" />
        Set alert
      </button>
    </div>
  );
}
