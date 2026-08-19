"use client";

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
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

/** Cell fill, one step up from the numeral — a wash, not a block of color. */
const TIER_FILL: Record<Tier, string> = {
  good: "bg-rc-good-bg",
  fair: "bg-rc-fair-bg",
  poor: "bg-rc-poor-bg",
  none: "bg-rc-surface",
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
 * How many day cells the labelled density draws before the rest collapses into
 * a single "+N" tail.
 *
 * A card in a list is answering "is this spot worth opening", and it was
 * spending its whole width on a fortnight to do it: fourteen cells is ~19px
 * each on a phone, and a screen of saved spots became a screen of grids. Worse
 * for a visitor on the 2-day horizon, where twelve of the fourteen were
 * padlocks — a paywall drawn fourteen times per screen.
 *
 * Five days is the "this week" answer at phone width; seven once there's room.
 * The fortnight is not gone, it is one tap away on the spot page, which is the
 * surface built to read it. Both counts render and CSS picks one, so this stays
 * a style switch with nothing for hydration to disagree about.
 */
const VISIBLE_PHONE = 5;
const VISIBLE_WIDE = 7;

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
 * Two densities. `labelled` is the real thing: a cell per day with the
 * weekday and the score, for a card that has the full column width. `compact`
 * falls back to bar heights with a best-day callout, for the 400px rails
 * (Explore, the city page) where 14 labelled cells would be ~26px each.
 */
export default function SpotDayStrip({
  days,
  density = "labelled",
  onUnlock,
  moreHref,
}: {
  days: SpotDay[];
  density?: "labelled" | "compact";
  /** Fires when a locked day is clicked. Omit to render locks as inert. */
  onUnlock?: () => void;
  /** Spot page for the days this strip doesn't draw. Omit to render the tail
   *  as inert. Ignored when the tail is locked — that sells the plan instead. */
  moreHref?: string;
}) {
  const scored = days.filter((d) => d.score !== null);
  const best = scored.reduce<SpotDay | null>(
    (top, d) => (!top || d.score! > top.score! ? d : top),
    null,
  );
  const lockedCount = days.filter((d) => d.locked).length;
  // The tail stands for everything past the visible window. Locks arrive as a
  // suffix, so a locked day anywhere past the phone window means the tail is
  // locked at either width.
  const tailLocked = days.slice(VISIBLE_PHONE).some((d) => d.locked);

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
              onUnlock
                ? (e) => {
                    e.stopPropagation();
                    onUnlock();
                  }
                : undefined
            }
            disabled={!onUnlock}
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
            // A locked day draws its whole slot as an empty track, not a stub.
            // As a stub it read as a rendering fault — twelve near-invisible
            // slivers — rather than "there is a fortnight here, behind a plan".
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
        <div className="flex gap-1">
          {days.slice(0, VISIBLE_WIDE).map((d, i) => {
            const t = tierFor(d.score);
            const isBest = best !== null && d.score !== null && d === best;
            // Cells past the phone window exist at every width and are hidden
            // by CSS on the narrow one.
            const show = i >= VISIBLE_PHONE ? "hidden sm:flex" : "flex";

            if (d.locked) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={
                    onUnlock
                      ? (e) => {
                          e.stopPropagation();
                          onUnlock();
                        }
                      : undefined
                  }
                  disabled={!onUnlock}
                  aria-label={`${d.dow} ${d.date}, upgrade to see this day`}
                  className={`flex-1 min-w-0 rounded bg-rc-surface border border-rc-rule ${show} flex-col items-center justify-center gap-0.5 py-1.5 enabled:hover:border-rc-brand transition-colors`}
                >
                  <DayLabel
                    dow={d.dow}
                    className="rc-label text-[9px] leading-none text-rc-ink-mute"
                  />
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
                className={`relative flex-1 min-w-0 rounded ${TIER_FILL[t]} ${show} flex-col items-center justify-center gap-0.5 py-1.5 ${
                  isBest ? "ring-1 ring-inset ring-rc-badge" : ""
                }`}
              >
                <DayLabel
                  dow={d.dow}
                  className="rc-label text-[9px] leading-none text-rc-ink-soft"
                />
                <span
                  className={`font-rc-mono text-[13px] font-bold leading-none tracking-[-0.02em] ${TIER_NUMERAL[t]}`}
                >
                  {d.score ?? "—"}
                </span>
              </div>
            );
          })}

          {days.length > VISIBLE_PHONE && (
            <TailCell
              total={days.length}
              locked={tailLocked}
              onUnlock={onUnlock}
              href={moreHref}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The one cell standing in for every day past the visible window. Locked, it is
 * the upgrade prompt the twelve padlocks used to be, said once. Unlocked, it is
 * the way to the spot page, which draws the whole fortnight properly.
 *
 * The count differs by breakpoint because the window does, so both render and
 * CSS picks one, exactly as the day labels do.
 */
function TailCell({
  total,
  locked,
  onUnlock,
  href,
}: {
  total: number;
  locked: boolean;
  onUnlock?: () => void;
  href?: string;
}) {
  const body = (
    <>
      <span className="rc-label text-[9px] leading-none text-rc-ink-mute overflow-hidden">
        <span className="sm:hidden">+{total - VISIBLE_PHONE}</span>
        <span className="hidden sm:inline">+{total - VISIBLE_WIDE}</span>
      </span>
      {locked ? (
        <Lock className="w-3 h-3 text-rc-ink-mute" />
      ) : (
        <ChevronRight className="w-3 h-3 text-rc-ink-mute" />
      )}
    </>
  );
  const shell =
    "flex-1 min-w-0 rounded bg-rc-surface border border-rc-rule border-dashed flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors";

  if (locked) {
    return (
      <button
        type="button"
        onClick={
          onUnlock
            ? (e) => {
                e.stopPropagation();
                onUnlock();
              }
            : undefined
        }
        disabled={!onUnlock}
        aria-label="Upgrade to see the rest of the fortnight"
        className={`${shell} enabled:hover:border-rc-brand`}
      >
        {body}
      </button>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        aria-label="See the full 14-day forecast"
        className={`${shell} hover:border-rc-brand`}
      >
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
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
      <div className={`flex gap-1 ${density === "compact" ? "h-8" : "h-[38px]"}`}>
        {/* Same shape the real strip settles at — the visible window at this
            width, plus the tail — so the card holds its height when the 14-day
            read lands. */}
        {Array.from({ length: density === "compact" ? 14 : VISIBLE_WIDE }).map(
          (_, i) => (
            <div
              key={i}
              className={`flex-1 rounded bg-rc-surface animate-pulse ${
                density === "labelled" && i >= VISIBLE_PHONE ? "hidden sm:block" : ""
              }`}
            />
          ),
        )}
        {density === "labelled" && (
          <div className="flex-1 rounded bg-rc-surface animate-pulse" />
        )}
      </div>
    </div>
  );
}
