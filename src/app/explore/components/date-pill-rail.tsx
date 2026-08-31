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
import { useLockedDayTreatment } from "@/app/components/split-test/use-locked-day";
import LockedGauze from "./locked-gauze";
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
  variant = "floating",
}: {
  model: ForecastStripModel | null;
  selectedIso: string;
  onSelectDay: (day: ForecastDay) => void;
  signedIn: boolean;
  /** Ad frame: focus the one offer already on the page instead of opening a
   *  second way to buy. Same contract as the strip and the sheet. */
  onLockedAdDay?: () => void;
  /**
   * Where this is sitting, which is only a question about chrome — the tiles,
   * the cap and the arrow are identical either way.
   *
   * "floating": on the map, above the tab bar. Takes the bar's exact shape and
   * its shadow, because it has to hold its own against water underneath.
   *
   * "inline": inside the browse sheet's header, which is already a panel. Drops
   * the shadow, the blur and the click-through gutter — a raised pill inside a
   * card reads as a card on a card — and keeps the border, which is what still
   * has to say "this is a control, not a caption".
   */
  variant?: "floating" | "inline";
}) {
  const floating = variant === "floating";

  // The gold "best day" tile is for people who can see the fortnight it was
  // picked from. `isBest` is chosen among UNLOCKED days only (see
  // `finishModel`), so a signed-out visitor — who has two open days and
  // twelve padlocks — gets a badge announcing the best of two as if it were
  // the best of fourteen. That is a claim the tile cannot support, sitting
  // right beside the padlocks that explain why. So anonymous gets plain
  // tiles, and the fortnight's best day stays one of the things signing in
  // is for.
  const showBest = signedIn;
  const lock = useLockedDayTreatment(
    "pill_rail",
    !!model?.days.some((d) => d.locked),
  );
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
      lock.reportTap();
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
      {/* Floating only: a click-through gutter, like the nav strip, so the
          transparent margins beside the pill don't swallow taps on the map
          behind them. Inline, the sheet header already owns that space. */}
      <div className={floating ? "pointer-events-none px-4" : ""}>
        <div
          role="group"
          aria-label="Pick a forecast day"
          className={`relative flex h-16 items-stretch overflow-hidden rounded-2xl border border-rc-rule ${
            floating
              ? "pointer-events-auto mx-auto max-w-lg bg-rc-panel/95 shadow-[0_6px_24px_rgba(15,23,42,0.18)] backdrop-blur-md"
              : "bg-rc-panel"
          }`}
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
            /* py sets the tile height, and the tile is what gets sized here:
               the pill is 64px locked to the tab bar, less its 1px border top
               and bottom, so 5px of padding either side leaves a 52px tile,
               still centred. Change the padding, not the tile — nothing in
               here has an explicit height. */
            className="flex min-w-0 flex-1 snap-x items-stretch gap-1 overflow-x-auto scrollbar-hide px-1.5 py-[5px]"
          >
          {!model
            ? Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="w-[52px] shrink-0 animate-pulse rounded border border-rc-rule bg-rc-surface"
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
                    /* The best day is marked in colour alone, so it has to be
                       said here or it does not exist for a screen reader. */
                    aria-label={`${day.dow} ${day.date}${
                      day.nonRetention
                        ? ", non-retention"
                        : day.locked
                          ? ", locked"
                          : day.score != null
                            ? `, score ${day.score}`
                            : ""
                    }${day.isBest && showBest ? ", best day" : ""}`}
                    /* The best day wears the marker on the tile itself — a
                       gold border and a gold wash — rather than carrying a
                       badge.

                       The strip's "BEST" tab hangs off the top edge of its
                       cell, and there is nowhere here for it to hang: the pill
                       is locked to the tab bar's 64px, which leaves a 52px
                       tile already holding day, date and score, and a tab
                       floated above that lands on the day name. Two smaller
                       markers were tried and both failed in the same box — a
                       top-right dot ran under "TODAY", a bottom-right dot read
                       as a decimal point beside the score, and a 3px bar on
                       the top edge read as a rendering fault.

                       Colouring the whole tile needs no room at all, and gold
                       against thirteen grey-ruled white tiles is the loudest
                       thing on the pill. Selected AND best keeps the brand
                       fill and takes the gold border, so picking the best day
                       doesn't erase the fact that it is the best day. */
                    className={`relative flex w-[52px] shrink-0 snap-center flex-col items-center justify-center gap-0.5 overflow-hidden rounded transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rc-brand ${
                      day.isBest && showBest
                        ? isSel
                          ? "border-2 border-rc-badge bg-rc-brand text-white"
                          : "border-2 border-rc-badge bg-rc-badge/12 text-rc-ink"
                        : isSel
                          ? "border border-rc-brand bg-rc-brand text-white"
                          : "border border-rc-rule bg-rc-panel text-rc-ink active:bg-rc-surface"
                    }`}
                  >
                    {/* The same frosted glass the strip's DayCell wears, at
                        pill scale, for the arm that gets it. */}
                    {day.locked && lock.gauze && <LockedGauze variant="tile" />}

                    <span
                      className={`relative rc-label text-[9px] leading-none ${
                        isSel ? "text-white/75" : ""
                      }`}
                    >
                      {day.index === 0 ? "Today" : day.dow}
                    </span>
                    <span
                      className={`relative font-rc-mono text-[10px] leading-none ${
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
                        className={`relative h-3.5 w-3.5 ${
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
