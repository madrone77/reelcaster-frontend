"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  ForecastStripModel,
  ForecastDay,
  LockTier,
} from "../lib/forecast-strip";
import DayCell from "./day-cell";
import UpgradeDialog from "./upgrade-dialog";

/**
 * The "change date" body of the mobile Explore sheet.
 *
 * Deliberately the SAME instrument as the spot page's 14-day section
 * (`spot-detail-shell.tsx`, item 4): identical `DayCell` tiles at the same
 * `flex-1 min-w-[54px]` in the same `h-[124px] pt-2` rail, the same 1.5 gap,
 * the same edge gradients, the same attribution line underneath. An angler who
 * has read the fortnight on a spot page should not have to re-learn it here —
 * only the surface around it changes.
 *
 * Tapping a tile picks the day, which recolors the map pins and re-ranks the
 * spots behind the sheet. Hour-by-hour detail is the spot page's job.
 */
export default function SheetForecast({
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
  /** Ad frame: focus the one offer already on the page rather than opening a
   *  second way to buy. See ForecastStrip for the full note. */
  onLockedAdDay?: () => void;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Which plan the tapped day needs. A "Sign up free" day (3-7) sells the
  // account; an "Upgrade to Pro" day (8-14) sells Pro even to a signed-out
  // visitor, who would otherwise get a sign-up form after a Pro promise.
  const [lockTier, setLockTier] = useState<LockTier>("pro");

  // Edge affordances, same treatment as the spot page: a gradient + chevron on
  // whichever side still has tiles behind it.
  const railRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const readEdges = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  }, []);
  useEffect(() => {
    readEdges();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", readEdges, { passive: true });
    return () => el.removeEventListener("scroll", readEdges);
  }, [readEdges, model]);

  // Open on the day the map is already showing. `selectedIso` can be day 9 of
  // 14, which is off screen at rest — without this the sheet opens looking
  // like nothing is selected. Layout effect so it lands before the first
  // paint rather than as a visible jump.
  const selRef = useRef<HTMLDivElement | null>(null);
  const didCenter = useRef(false);
  useLayoutEffect(() => {
    if (didCenter.current || !model) return;
    didCenter.current = true;
    selRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
    readEdges();
  }, [model, readEdges]);

  if (!model) {
    return (
      <div className="px-4 py-12 text-center text-sm text-rc-ink-mute">
        Forecast loading…
      </div>
    );
  }

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
    <div className="px-4 pb-4">
      <div className="relative">
        {/* pt-2: the BEST badge sits at -top-1.5, and overflow-x-auto clips the
            y-axis — the top padding keeps it inside the box. */}
        <div
          ref={railRef}
          className="flex gap-1.5 h-[124px] pt-2 overflow-x-auto scrollbar-hide"
        >
          {model.days.map((day) => {
            const isSel = day.iso === selectedIso;
            return (
              <div
                key={day.index}
                ref={isSel ? selRef : undefined}
                className="flex-1 min-w-[54px] flex"
              >
                <DayCell
                  neutralLock={!!onLockedAdDay}
                  day={day}
                  selected={isSel}
                  onSelect={() => handleDay(day)}
                />
              </div>
            );
          })}
        </div>
        <div
          aria-hidden
          className={`pointer-events-none absolute right-0 top-2 bottom-0 flex w-10 items-center justify-end pr-0.5 bg-gradient-to-l from-rc-panel to-transparent transition-opacity duration-200 ${
            atEnd ? "opacity-0" : "opacity-100"
          }`}
        >
          <ChevronRight className="w-4 h-4 text-rc-ink-mute" />
        </div>
        <div
          aria-hidden
          className={`pointer-events-none absolute left-0 top-2 bottom-0 flex w-10 items-center justify-start pl-0.5 bg-gradient-to-r from-rc-panel to-transparent transition-opacity duration-200 ${
            atStart ? "opacity-0" : "opacity-100"
          }`}
        >
          <ChevronLeft className="w-4 h-4 text-rc-ink-mute" />
        </div>
      </div>

      {/* The spot page carries this on the header's right edge. Here that slot
          is Done — a sheet needs a way out, a page does not — so the line sits
          under the rail instead, same words and same type. */}
      <div className="mt-2 text-right font-rc-mono text-[10px] text-rc-ink-mute italic">
        Data from: ECMWF + GFS + BlueCaster
      </div>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        variant={!signedIn && lockTier === "free" ? "signup" : "pro"}
      />
    </div>
  );
}
