"use client";

import { Bell, Fish } from "lucide-react";
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
  onSetAlert,
  onLogCatch,
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
  /** Tapped "Set alert" — the shell gates signed-out anglers into sign-up. */
  onSetAlert: () => void;
  /** Tapped "Log catch" — the shell gates signed-out anglers into sign-up. */
  onLogCatch: () => void;
}) {
  const tier = tierFor(score ?? peak);
  const windowSub = [
    windowPeak != null ? `Peaks at ${windowPeak}` : null,
    tidePhase,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-4 lg:p-5 shadow-rc-panel">
      <div className="rc-label text-[9px] text-rc-ink-mute">{nowLabel}</div>

      <div className="flex items-end gap-4 mt-2">
        <span
          className={`text-[64px] leading-[0.8] font-bold tracking-[-0.04em] ${TIER_TEXT[tier]}`}
        >
          {score ?? peak ?? "—"}
        </span>
        <div className="pb-1.5 space-y-1.5">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_PILL[tier]}`}
          >
            {score != null || peak != null
              ? `✓ ${tier.toUpperCase()}`
              : "NO SCORE"}
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
        <div className="mt-4 rounded-xl bg-rc-good-bg text-center py-3 px-3">
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

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onSetAlert}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white font-rc-mono text-xs font-semibold tracking-[0.08em] transition-colors"
        >
          <Bell className="w-3.5 h-3.5" />
          SET ALERT
        </button>
        <button
          type="button"
          onClick={onLogCatch}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-rc-rule text-rc-ink font-rc-mono text-xs font-semibold tracking-[0.08em] hover:bg-rc-surface transition-colors"
        >
          <Fish className="w-3.5 h-3.5" />
          LOG CATCH
        </button>
      </div>
    </div>
  );
}
