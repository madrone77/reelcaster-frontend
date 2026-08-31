"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronRight, Lock } from "lucide-react";
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

  // Whether the right-edge arrow still has days behind it to point at.
  const [atEnd, setAtEnd] = useState(false);
  const readEdges = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  }, []);
  useEffect(readEdges, [readEdges, model]);

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
          className="pointer-events-auto relative mx-auto flex h-16 max-w-lg items-stretch overflow-hidden rounded-2xl border border-rc-rule bg-rc-panel/95 shadow-[0_6px_24px_rgba(15,23,42,0.18)] backdrop-blur-md"
        >
          {/* Names the instrument, and stays put while the days scroll under
              it — a caption that scrolled away would be gone by the second
              swipe, which is exactly when you'd want to know what these
              numbers are. Two lines because a pill this wide can't spare 100px
              of the fortnight for one. */}
          <div className="flex shrink-0 flex-col justify-center gap-0.5 border-r border-rc-rule px-2.5">
            <span className="rc-label text-[8px] leading-none text-rc-ink">
              14-Day
            </span>
            <span className="rc-label text-[8px] leading-none text-rc-ink-mute">
              Forecast
            </span>
          </div>

          <div
            ref={railRef}
            onScroll={readEdges}
            className="flex min-w-0 flex-1 snap-x items-stretch gap-1 overflow-x-auto scrollbar-hide px-1.5 py-2"
          >
          {!model
            ? Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="w-[52px] shrink-0 animate-pulse rounded-xl border border-rc-rule bg-rc-surface"
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
                    className={`relative flex w-[52px] shrink-0 snap-center flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rc-brand ${
                      isSel
                        ? "border-rc-brand bg-rc-brand text-white"
                        : "border-rc-rule bg-rc-panel text-rc-ink active:bg-rc-surface"
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
                        inside a 46px tile has nowhere to sit. A gold bar along
                        the tile's own top edge says the same thing, costs no
                        height, and reads on both faces (gold on white, gold on
                        the brand fill).

                        A corner dot was the first try and both corners are
                        taken: the top row is the day name, which on the widest
                        of them ("TODAY") runs under a top-right dot, and a
                        bottom-right dot sits beside the score and reads as a
                        decimal point. */}
                    {day.isBest && (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-rc-badge"
                      />
                    )}
                  </button>
                );
              })}
          </div>

          {/* Says there is more fortnight off the right edge. A pill this
              narrow shows five of fourteen days, and nothing else on it hints
              that it scrolls — the tiles simply run to the border. Fades out
              once the rail is at the end, because by then it would be
              pointing at nothing. Click-through, so the tile underneath is
              still tappable. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-rc-panel via-rc-panel/85 to-transparent pr-2 transition-opacity duration-200 ${
              atEnd ? "opacity-0" : "opacity-100"
            }`}
          >
            <ChevronRight className="h-4 w-4 text-rc-ink-mute" />
          </div>
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
