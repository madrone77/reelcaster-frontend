"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Lock } from "lucide-react";
import type { Tier } from "../lib/explore-data";
import type {
  ForecastStripModel,
  ForecastDay,
  LockTier,
} from "../lib/forecast-strip";
import UpgradeDialog from "./upgrade-dialog";

/** Score colour per tier — the same tokens the day cells and the sheet use. */
const TIER_SCORE: Record<Tier, string> = {
  good: "text-rc-good",
  fair: "text-rc-fair-ink",
  poor: "text-rc-poor",
  none: "text-rc-ink-mute",
};

/**
 * The fortnight as a floating pill, sized and shaped like the bottom tab bar
 * and docked directly above it under the spot preview carousel.
 *
 * The 14 days are a horizontal scroll inside the pill rather than a picker
 * behind a "Change date" button: while a preview card is in hand the day is
 * the thing an angler changes most, and a sheet that covers the card to change
 * the card is a poor trade. Tapping a day recolours the pins and re-scores the
 * card above without leaving the map.
 *
 * Same geometry as `<MobileBottomNav>`'s pill on purpose — `h-16 max-w-lg
 * rounded-2xl` in a `px-4` gutter, the same border, panel fill, blur and
 * shadow — so the two read as one stack of controls rather than a control and
 * a stray card. Keep them in step if the nav's pill changes.
 *
 * Day tiles are the strip's data (`ForecastDay`) at pill scale: day, date, the
 * peak score. Hour detail stays on the spot page, and the full ledger stays in
 * the browse sheet's picker.
 */
export default function DatePillRail({
  model,
  selectedIso,
  onSelectDay,
  signedIn,
  onLockedAdDay,
}: {
  model: ForecastStripModel | null;
  selectedIso: string;
  onSelectDay: (day: ForecastDay) => void;
  signedIn: boolean;
  /** Ad frame: focus the one offer already on the page instead of opening a
   *  second way to buy. Same contract as the strip and the sheet. */
  onLockedAdDay?: () => void;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [lockTier, setLockTier] = useState<LockTier>("pro");

  const railRef = useRef<HTMLDivElement | null>(null);
  const selRef = useRef<HTMLButtonElement | null>(null);

  // Centre the day the map is already showing. `selectedIso` can be day 9 of
  // 14, which is off the right edge of a pill this wide — without this the
  // rail opens looking like nothing is picked. Layout effect on the first
  // paint (no jump), smooth afterwards when the day changes from elsewhere.
  const didCentre = useRef(false);
  const centre = useCallback((behavior: ScrollBehavior) => {
    const el = railRef.current;
    const tile = selRef.current;
    if (!el || !tile) return;
    el.scrollTo({
      left: tile.offsetLeft - (el.clientWidth - tile.offsetWidth) / 2,
      behavior,
    });
  }, []);
  useLayoutEffect(() => {
    if (didCentre.current || !model) return;
    didCentre.current = true;
    centre("auto");
  }, [model, centre]);
  useEffect(() => {
    if (!didCentre.current) return;
    centre("smooth");
  }, [selectedIso, centre]);

  const handleDay = (day: ForecastDay) => {
    if (day.locked) {
      if (onLockedAdDay) {
        onLockedAdDay();
        return;
      }
      setLockTier(day.lockTier ?? "pro");
      setUpgradeOpen(true);
      return;
    }
    onSelectDay(day);
  };

  return (
    <>
      {/* Click-through gutter, like the nav strip: the transparent margins
          beside the pill must not swallow taps on the map behind them. */}
      <div className="pointer-events-none px-4">
        <div
          role="group"
          aria-label="Pick a forecast day"
          ref={railRef}
          className="pointer-events-auto mx-auto flex h-16 max-w-lg snap-x items-stretch gap-1 overflow-x-auto scrollbar-hide rounded-2xl border border-rc-rule bg-rc-panel/95 px-1.5 shadow-[0_6px_24px_rgba(15,23,42,0.18)] backdrop-blur-md"
        >
          {!model
            ? Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="my-2 w-[52px] shrink-0 animate-pulse rounded-xl bg-rc-surface"
                />
              ))
            : model.days.map((day) => {
                const isSel = day.iso === selectedIso;
                return (
                  <button
                    key={day.index}
                    type="button"
                    ref={isSel ? selRef : undefined}
                    onClick={() => handleDay(day)}
                    aria-current={isSel ? "date" : undefined}
                    aria-label={`${day.dow} ${day.date}${
                      day.nonRetention
                        ? ", non-retention"
                        : day.locked
                          ? ", locked"
                          : day.score != null
                            ? `, score ${day.score}`
                            : ""
                    }`}
                    className={`relative my-2 flex w-[52px] shrink-0 snap-center flex-col items-center justify-center gap-0.5 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rc-brand ${
                      isSel
                        ? "bg-rc-brand text-white"
                        : "text-rc-ink active:bg-rc-surface"
                    }`}
                  >
                    <span
                      className={`rc-label text-[9px] leading-none ${
                        isSel ? "text-white/75" : ""
                      }`}
                    >
                      {day.index === 0 ? "Today" : day.dow}
                    </span>
                    <span
                      className={`font-rc-mono text-[10px] leading-none ${
                        isSel ? "text-white/85" : "text-rc-ink-soft"
                      }`}
                    >
                      {day.date}
                    </span>

                    {/* The one line that changes: a score, a padlock, or the
                        reason there is no score to show. */}
                    {day.pending ? (
                      <span
                        aria-hidden
                        className="mt-0.5 h-4 w-6 animate-pulse rounded bg-rc-surface"
                      />
                    ) : day.nonRetention ? (
                      <span
                        className={`font-rc-mono text-[8px] leading-none ${
                          isSel ? "text-white/85" : "text-rc-ink-soft"
                        }`}
                      >
                        No keep
                      </span>
                    ) : day.locked ? (
                      <Lock
                        className={`h-3.5 w-3.5 ${
                          isSel ? "text-white" : "text-rc-ink-soft"
                        }`}
                      />
                    ) : (
                      <span
                        className={`text-[17px] font-bold leading-none tracking-[-0.03em] ${
                          isSel ? "text-white" : TIER_SCORE[day.tier]
                        }`}
                      >
                        {day.score ?? "—"}
                      </span>
                    )}

                    {/* The best day in the fortnight. The strip's "BEST" tab
                        hangs off the top edge of its cell, which this rail's
                        horizontal scroll would clip — and a fourth stacked row
                        inside a 46px tile has nowhere to sit. A corner dot says
                        the same thing and costs no height. */}
                    {day.isBest && (
                      <span
                        aria-hidden
                        className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${
                          isSel ? "bg-white" : "bg-rc-badge"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
        </div>
      </div>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        variant={!signedIn && lockTier === "free" ? "signup" : "pro"}
      />
    </>
  );
}
