"use client";

import { useEffect, useRef, useState } from "react";
import { CloudSun } from "lucide-react";
import type { ForecastStripModel, ForecastDay } from "../lib/forecast-strip";
import DayRow from "./day-row";
import DayScrubCell from "./day-scrub-cell";
import UpgradeDialog from "./upgrade-dialog";

/**
 * The "14-day" body of the mobile spot sheet — a VERTICAL ledger of 14 day
 * rows (same visual language as the "all spots" cards it toggles against, so
 * the toggle swaps content within one frame, not one axis for another). All 14
 * peak scores are scannable at once. Tapping a day expands its row downward
 * (accordion) to reveal the full-width 24-hour "Drillspan" scrub lane
 * (DayScrubCell, shared with desktop); dragging its playhead recolors the map
 * pins + re-ranks the spots to that hour. The scrub lane's horizontal drag is
 * orthogonal to the sheet's vertical scroll — no gesture collision.
 */
export default function SheetForecast({
  model,
  selectedIso,
  hours,
  scrubHour,
  onScrubHour,
  onSelectDay,
  signedIn,
}: {
  model: ForecastStripModel | null;
  selectedIso: string;
  hours: (number | null)[];
  scrubHour: number | null;
  onScrubHour: (h: number) => void;
  onSelectDay: (day: ForecastDay) => void;
  signedIn: boolean;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Bring the freshly-expanded day into view so its scrub lane isn't below the
  // fold after the accordion opens.
  useEffect(() => {
    rowRefs.current[selectedIso]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedIso]);

  if (!model) {
    return (
      <div className="px-4 py-12 text-center text-sm text-rc-ink-mute">
        Forecast loading…
      </div>
    );
  }

  const handleDay = (day: ForecastDay) => {
    if (day.locked) {
      setUpgradeOpen(true);
      return;
    }
    onSelectDay(day);
  };

  const best = model.bestDay;
  const hasHours = hours.some((v) => typeof v === "number");

  return (
    <div className="px-4 pb-4">
      {/* Best-window readout */}
      <div className="flex items-center gap-2 border-b border-rc-rule py-3">
        <CloudSun className="h-4 w-4 shrink-0 text-rc-ink-mute" />
        {best ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rc-good" />
            <span className="truncate font-rc-mono text-[12px] text-rc-ink">
              Best window {best.dow} {best.date}
            </span>
            {best.peakLabel && (
              <span className="shrink-0 font-rc-mono text-[12px] font-bold text-rc-ink">
                {best.peakLabel}
              </span>
            )}
          </div>
        ) : (
          <span className="rc-label text-[9px]">14-day forecast</span>
        )}
      </div>

      {/* Vertical day ledger — one row per day; the selected day expands into
          the 24h scrub lane beneath it. */}
      <div>
        {model.days.map((day) => {
          const isSel = day.iso === selectedIso;
          const open = isSel && !day.locked && hasHours;
          return (
            <div
              key={day.index}
              ref={(el) => {
                rowRefs.current[day.iso] = el;
              }}
              className="border-b border-rc-rule"
            >
              {open ? (
                // The selected day IS the scrub lane — its own anchor (with the
                // live scrubbed hour) serves as the row header, so there's no
                // duplicate day summary above it.
                <div className="flex h-[92px] py-1.5">
                  <DayScrubCell
                    day={day}
                    hours={hours}
                    scrubHour={scrubHour}
                    onScrubHour={onScrubHour}
                  />
                </div>
              ) : (
                <DayRow
                  day={day}
                  selected={isSel}
                  onSelect={() => handleDay(day)}
                />
              )}
            </div>
          );
        })}
      </div>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        variant={signedIn ? "pro" : "signup"}
      />
    </div>
  );
}
