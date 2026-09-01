"use client";

import { Lock } from "lucide-react";
import { useLockedDayTreatment } from "@/app/components/split-test/use-locked-day";
import { tierFor, fmtPeak, type Tier } from "../lib/explore-data";
import type { SpotsOutlook14dPayload } from "@/lib/bluecaster";

/**
 * Score numerals at card scale. Same tier tokens the forecast strip's day
 * cells use — `fair` takes its darker -ink variant, which is what clears the
 * contrast floor on a white cell.
 */
const TIER_NUMERAL: Record<Tier, string> = {
  good: "text-rc-good",
  fair: "text-rc-fair-ink",
  poor: "text-rc-poor",
  none: "text-rc-ink-mute",
};

/** Bar color for the compact density, where there's no room for a numeral. */
const TIER_BAR: Record<Tier, string> = {
  good: "bg-rc-good",
  fair: "bg-rc-fair",
  poor: "bg-rc-poor",
  none: "bg-rc-rule",
};

/**
 * Bar height for the compact density. Scores at a decent spot sit in a narrow
 * high band (the engine's rescale puts a calm midday around 70), so drawing
 * height as a raw percentage made a fortnight of 82–93 into fourteen identical
 * full bars. Anchoring the floor at 40 spends the whole bar on the range that
 * actually varies, and clamps so a poor day still draws something.
 */
const BAR_FLOOR = 40;
function barHeightPct(score: number | null): number {
  if (score === null) return 10;
  return Math.min(100, Math.max(14, ((score - BAR_FLOOR) / (100 - BAR_FLOOR)) * 100));
}

/**
 * The weekday label, at two lengths.
 *
 * `labelled` wants ~560px of card, and gets far less than that on a phone: at
 * 390px each of the fourteen cells has about 19px of content width, while "FRI"
 * at 9px mono needs roughly 20px. The labels overflowed their cells and ran
 * together into "FRISATSUNMON…" on every spot card on the dashboard.
 *
 * Both lengths render and CSS picks one, so this stays a pure style switch with
 * no measurement, no JS and nothing for hydration to disagree about. Two letters
 * rather than one because "S/S" and "T/T" are ambiguous and "Sa/Su", "Tu/Th"
 * are not.
 */
function DayLabel({ dow, className }: { dow: string; className: string }) {
  return (
    <span className={`${className} overflow-hidden`}>
      <span className="sm:hidden">{dow.slice(0, 2)}</span>
      <span className="hidden sm:inline">{dow}</span>
    </span>
  );
}

/**
 * The date under the weekday, as the spot page's date squares set it.
 *
 * Dropped below `sm`, where a fourteenth of a phone card is about 22px and
 * "Sep 1" at 9px mono needs nearer 30. The weekday and the score are the two
 * things that survive that width; the date is what the square gains back the
 * moment there is room for it.
 */
function DayDate({ date, className }: { date: string; className: string }) {
  return (
    <span
      className={`hidden sm:block font-rc-mono text-[9px] leading-none ${className}`}
    >
      {date}
    </span>
  );
}

export interface SpotDay {
  dow: string; // "Wed"
  date: string; // "Aug 16"
  score: number | null; // null = locked, or no score that day
  peakHour: number | null;
  locked: boolean;
}

/**
 * Turn the bulk payload into one spot's 14 days. A day is `locked` when the
 * cell is null but the day is inside the horizon the payload was built for —
 * which is how the route signals "your plan stops here" without shipping the
 * score. Days genuinely missing a score read the same way to the reader
 * (a cell with no number), and that's fine: neither is a day they can act on.
 */
export function spotDaysFrom(
  payload: SpotsOutlook14dPayload | null,
  spotId: string,
): SpotDay[] | null {
  if (!payload) return null;
  const cells = payload.by_spot[spotId];
  if (!cells) return null;
  // Locked days are a suffix — the route nulls from the horizon onward — so
  // the first null with a scored day after it is a gap, not a lock.
  const lastScored = cells.reduce((last, c, i) => (c ? i : last), -1);
  return payload.days.map((d, i) => {
    const cell = cells[i] ?? null;
    return {
      dow: d.dow,
      date: d.date,
      score: cell?.score ?? null,
      peakHour: cell?.peak_hour ?? null,
      locked: cell === null && i > lastScored,
    };
  });
}

/**
 * A spot's next 14 days along the bottom of its card — day, score, and the
 * hour it peaks, so the card answers "when should I go" and not just "how is
 * it right now". The 24h sparkline it sits under answers today; this answers
 * the fortnight.
 *
 * Two densities. `labelled` is the real thing: fourteen date squares cut down
 * from the ones the spot page's forecast strip draws — weekday over date over
 * score — for a card that has the full column width. `compact` falls back to
 * bar heights with a best-day callout, for the 400px rails (Explore, the city
 * page) where 14 labelled cells would be ~26px each.
 *
 * `labelled` draws the whole fortnight, with no "+N" tail. It used to stop at
 * five cells on a phone and seven on a wider card, on the reasoning that a card
 * in a list is only answering "is this spot worth opening". That held while the
 * tail was days nobody was being sold. It stopped holding once the horizon
 * became the thing we charge for: a Member account is scored for seven days, so
 * under a seven-cell window the wall fell exactly at the edge of the strip and a
 * Member's dashboard looked identical to a Pro's. Days past the horizon have to
 * be on screen to be a gate at all. This density is the dashboard's alone, so it
 * is always a signed-in reader looking at their own spots — never a visitor
 * meeting fourteen padlocks on first contact.
 */
export default function SpotDayStrip({
  days,
  density = "labelled",
  onUnlock,
}: {
  days: SpotDay[];
  density?: "labelled" | "compact";
  /** Fires when a locked day is clicked. Omit to render locks as inert. */
  onUnlock?: () => void;
}) {
  const scored = days.filter((d) => d.score !== null);
  const best = scored.reduce<SpotDay | null>(
    (top, d) => (!top || d.score! > top.score! ? d : top),
    null,
  );
  const lockedCount = days.filter((d) => d.locked).length;
  const lock = useLockedDayTreatment("spot_card", lockedCount > 0);
  // Every locked slot in this strip opens the same upgrade, so the tap is
  // counted once here rather than at each of the four places that call it.
  const unlock = onUnlock
    ? () => {
        lock.reportTap();
        onUnlock();
      }
    : undefined;

  return (
    <div className="px-3 pt-2 pb-2.5 border-t border-rc-rule">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="rc-label text-[9px]">Next 14 days</span>
        {/* The compact density has no room for per-cell locks, so the lock
            lives here instead. Without it the right half of the strip is just
            fourteen faint stubs and nothing says why. */}
        {density === "compact" && lockedCount > 0 ? (
          <button
            type="button"
            onClick={
              unlock
                ? (e) => {
                    e.stopPropagation();
                    unlock();
                  }
                : undefined
            }
            disabled={!unlock}
            className="flex items-center gap-1 font-rc-mono text-[10px] text-rc-brand enabled:hover:text-rc-brand-hover transition-colors shrink-0"
          >
            <Lock className="w-2.5 h-2.5" />
            {lockedCount} more
          </button>
        ) : (
          best && (
            <span className="font-rc-mono text-[10px] text-rc-ink-soft truncate">
              best {best.dow} {best.date} · {best.score}
              {lockedCount > 0 && (
                <span className="text-rc-ink-mute"> · so far</span>
              )}
            </span>
          )
        )}
      </div>

      {density === "compact" ? (
        <div className="flex items-end gap-[3px] h-8" aria-hidden>
          {days.map((d, i) => {
            const t = tierFor(d.score);
            // A locked day fills its whole slot rather than drawing a stub.
            // As a stub it read as a rendering fault, twelve near-invisible
            // slivers, rather than "there is a fortnight here, behind a plan".
            // The slot is a plain sunk grey: it says a day is here and says
            // nothing at all about what the day is worth.
            if (d.locked) {
              return (
                <div
                  key={i}
                  title={`${d.dow} ${d.date} · locked`}
                  className="flex-1 min-w-0 h-full rounded-sm bg-rc-surface border border-rc-rule"
                />
              );
            }
            return (
              <div
                key={i}
                title={`${d.dow} ${d.date}${d.score !== null ? ` · ${d.score}` : ""}`}
                className={`flex-1 min-w-0 rounded-sm ${TIER_BAR[t]} ${
                  d.score === null ? "opacity-60" : ""
                }`}
                // A scoreless day still draws a stub, so the strip reads as 14
                // days with gaps rather than a shorter fortnight.
                style={{ height: `${barHeightPct(d.score)}%` }}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex gap-[2px] sm:gap-1">
          {days.map((d, i) => {
            const t = tierFor(d.score);
            const isBest = best !== null && d.score !== null && d === best;

            if (d.locked) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={
                    unlock
                      ? (e) => {
                          e.stopPropagation();
                          unlock();
                        }
                      : undefined
                  }
                  disabled={!unlock}
                  aria-label={`${d.dow} ${d.date}, upgrade to see this day`}
                  className="flex-1 min-w-0 rounded bg-rc-surface border border-rc-rule flex flex-col items-center justify-center gap-0.5 py-1.5 enabled:hover:border-rc-brand transition-colors"
                >
                  <DayLabel
                    dow={d.dow}
                    className="rc-label text-[9px] leading-none text-rc-ink-mute"
                  />
                  <DayDate date={d.date} className="text-rc-ink-mute" />
                  <Lock className="w-3 h-3 text-rc-ink-mute" />
                </button>
              );
            }

            return (
              <div
                key={i}
                title={
                  d.peakHour !== null
                    ? `${d.dow} ${d.date} · peaks ${fmtPeak(d.peakHour)}`
                    : `${d.dow} ${d.date}`
                }
                // White tile, ruled edge, tier only in the numeral — the same
                // square the spot page's forecast strip draws. The cells used to
                // carry a tier wash behind the number, which is a treatment the
                // system reserves for pills and banners; fourteen of them in a
                // row read as a heat map the four-band scale never promised.
                className={`relative flex-1 min-w-0 rounded border bg-rc-panel flex flex-col items-center justify-center gap-0.5 py-1.5 ${
                  isBest
                    ? "border-rc-badge ring-1 ring-inset ring-rc-badge"
                    : "border-rc-rule"
                }`}
              >
                <DayLabel
                  dow={d.dow}
                  className="rc-label text-[9px] leading-none text-rc-ink-soft"
                />
                <DayDate date={d.date} className="text-rc-ink-mute" />
                <span
                  className={`text-[15px] sm:text-[17px] font-bold leading-none tracking-[-0.04em] ${TIER_NUMERAL[t]}`}
                >
                  {d.score ?? "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Placeholder with the strip's exact height, so a card doesn't jump when the
 *  14-day read lands after the map payload it was rendered from. */
export function SpotDayStripSkeleton({
  density = "labelled",
}: {
  density?: "labelled" | "compact";
}) {
  return (
    <div className="px-3 pt-2 pb-2.5 border-t border-rc-rule">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="rc-label text-[9px]">Next 14 days</span>
      </div>
      <div
        className={`flex gap-[2px] sm:gap-1 ${
          density === "compact" ? "h-8" : "h-[43px] sm:h-[56px]"
        }`}
      >
        {/* Fourteen slots at both densities now, at the labelled cell's own
            two heights (no date line below `sm`), so the card holds its height
            when the 14-day read lands. */}
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex-1 rounded bg-rc-surface animate-pulse" />
        ))}
      </div>
    </div>
  );
}
