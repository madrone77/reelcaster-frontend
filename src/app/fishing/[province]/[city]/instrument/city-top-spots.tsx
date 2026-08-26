"use client";

// The city's marks, most-fished first.
//
// The leaderboard this replaces ranked on the forecast and produced, on a good
// day, six cards all reading 82 in a row that a cold reader could not tell
// apart. This ranks on report volume instead, so the names at the top are the
// ones somebody who fishes the city would recognise — Victoria Waterfront,
// Oak Bay Flats, Constance Bank — and today's score is a fact about each mark
// rather than the reason it is in that position.
//
// ⚠ The scores therefore do NOT descend, and the subline has to say so. Six
// Victoria rows read 86, 86, 83, 89, 87, 85; a list that looks sorted and is
// not is worse than one that never looked sorted.
//
// Every score here is the day's peak, which is the number the map pin shows
// and the number the spot page shows for the same water. Three surfaces, one
// number: a reader who taps through must never find a different one.

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { tierFor, type Tier } from "@/app/explore/lib/explore-data";
import { formatHour12 } from "@/lib/time-format";
import { bottomLabel, cellAt, chopLabel, phaseAt } from "../hub/hub-data";
import { recognitionLabel, type RankedSpot } from "./featured";

/** How many marks the list names. The map below it carries the rest. */
const SHOWN = 6;

const TIER_NUMERAL: Record<Tier, string> = {
  prime: "text-rc-prime",
  good: "text-rc-good",
  fair: "text-rc-fair-ink",
  poor: "text-rc-poor",
  none: "text-rc-ink-mute",
};

/** The window as a phrase. `end_hour` names the LAST good hour, so the label
 *  closes an hour later — same convention as the hub's headline. */
function windowLabel(row: RankedSpot): string | null {
  const w = row.entry.window;
  if (!w) return null;
  return `${formatHour12(w.start_hour)}–${formatHour12((w.end_hour + 1) % 24)}`;
}

export default function CityTopSpots({
  rows,
  cityName,
}: {
  rows: RankedSpot[];
  cityName: string;
}) {
  const shown = rows.slice(0, SHOWN);
  if (!shown.length) return null;

  return (
    <section className="rounded border border-rc-rule bg-rc-panel px-4 py-5 lg:px-6 lg:py-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="rc-label text-[10px] text-rc-ink">
          Top spots in {cityName}
        </h2>
        {rows.length > SHOWN && (
          <span className="font-rc-mono text-[10px] text-rc-ink-mute italic shrink-0">
            {rows.length - SHOWN} more on the map
          </span>
        )}
      </div>
      {/* Says what ordered the list, because the order is NOT the scores: the
          column reads 86, 86, 83, 89, 87 on a normal Victoria day, and a reader
          comparing those numbers down the page would otherwise conclude the
          sort was broken. */}
      <p className="font-rc-mono text-[11px] text-rc-ink-soft mb-4">
        Ordered by how much each mark is actually fished, not by score. The
        number is today&apos;s peak.
      </p>

      <ul className="divide-y divide-rc-rule border-t border-rc-rule">
        {shown.map((row) => {
          const { spot, entry } = row;
          const tier = tierFor(entry.peak);
          const cell = cellAt(spot, entry.peak_hour);
          const detail = [
            phaseAt(spot, entry.peak_hour),
            chopLabel(cell),
            bottomLabel(spot.bottom),
          ].filter(Boolean);
          const recognition = recognitionLabel(spot);
          const win = windowLabel(row);

          return (
            <li key={spot.id}>
              <Link
                href={`/explore/spot/${spot.slug}`}
                className="group flex items-center gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
              >
                <div
                  className={`w-[52px] shrink-0 text-[30px] font-bold leading-none tracking-[-0.04em] tabular-nums ${TIER_NUMERAL[tier]}`}
                >
                  {entry.peak}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[15px] font-semibold text-rc-ink truncate group-hover:text-rc-brand transition-colors">
                      {spot.name}
                    </span>
                    {recognition && (
                      <span className="shrink-0 rounded bg-rc-good-soft text-rc-good-ink font-rc-mono text-[9px] font-semibold px-1.5 py-0.5">
                        {recognition}
                      </span>
                    )}
                  </div>
                  <div className="font-rc-mono text-[11px] text-rc-ink-soft mt-0.5 truncate">
                    {win ? `Best ${win}` : "No daylight window today"}
                    {detail.length ? ` · ${detail.join(" · ")}` : ""}
                  </div>
                </div>

                <ArrowUpRight className="w-4 h-4 shrink-0 text-rc-ink-mute group-hover:text-rc-brand transition-colors" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
