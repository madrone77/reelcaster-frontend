// Today's top water, as one card that does not look like the four under it,
// and the only place on the page that shows the product working.
//
// White with an emerald edge, NOT navy. It was navy first, directly beneath a
// navy hero, and two dark blocks stacked with a chip bar between them read as
// one slab through the middle of a phone screen.
//
// ── Why the card is not one big link any more ────────────────────────────
//
// It used to be. Then it grew a scrubbable chart, and interactive content
// nested inside an <a> is both an accessibility violation and unusable in
// practice: dragging across the track would navigate away mid-scrub. The
// title and the footer are the links now, which is also the more honest
// affordance — two deliberate exits rather than a card that swallows every
// tap.
//
// ── What it says, and what it cannot ─────────────────────────────────────
//
// The score, the window, the tide phase, the wind, the seabed and the city's
// method. NO target depth and no rig size, because neither exists:
// `depth_avg_m` is null on all 164 published spots, `depth_profiles` holds 7
// rows product-wide, and `catch_signals.depth_ft` 2.

"use client";

import { useState } from "react";
import Link from "next/link";
import ScoreStrip from "@/app/explore/components/score-strip";
import { formatHour12 } from "@/lib/time-format";
import {
  bottomLabel,
  cellAt,
  chopLabel,
  phaseAt,
  type HubSpeciesEntry,
  type HubSpot,
} from "./hub-data";
import { Chip, Label, PAD, PANEL, TYPE } from "./ui";
import { spotHref } from "@/lib/paths";
import { trackEvent } from "@/lib/analytics";

/** One fact per box. No icons: four pictograms on one card is decoration
 *  competing with the four values it is meant to introduce. */
function Fact({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg bg-rc-surface px-3 py-2.5 ${
        wide ? "col-span-2" : ""
      }`}
    >
      <Label>{label}</Label>
      <span className="mt-1 text-[13px] font-semibold text-rc-ink">{value}</span>
    </div>
  );
}

export default function SpotSpotlight({
  spot,
  entry,
  rankLine,
  tactic,
  cityName,
  tz,
}: {
  spot: HubSpot;
  entry: HubSpeciesEntry;
  /** Why this mark is featured. Load-bearing because the scores tie: a lone
   *  "84" gives no reason to believe it beat the rest. */
  rankLine: string;
  /** The city's method for this species. City grain — the label says so. */
  tactic: string | null;
  cityName: string;
  tz: string;
}) {
  const onSpotClick = () =>
    trackEvent("Top Spot Clicked", {
      slug: spot.slug,
      rank: 1,
      city: cityName,
      surface: "spotlight",
    });
  /**
   * The hour the reader is scrubbing, or null when they are not.
   *
   * Everything below reads at `readHour`, so dragging the chart moves the
   * tide and the wind with it. That is the product's actual argument — the
   * day is not one number, it has a shape — and this is the only place a
   * cold visitor gets to see it before being asked for anything.
   */
  const [scrubHour, setScrubHour] = useState<number | null>(null);
  const readHour = scrubHour ?? entry.window?.start_hour ?? entry.peak_hour;

  const bottom = bottomLabel(spot.bottom);
  const phase = phaseAt(spot, readHour);
  const cell = cellAt(spot, readHour);
  const chop = chopLabel(cell);
  const wind =
    typeof cell?.wkt === "number"
      ? `${Math.round(cell.wkt)} kt${chop ? ` · ${chop}` : ""}`
      : chop;

  return (
    <section
      aria-labelledby="spotlight"
      className={`overflow-hidden border-2 border-rc-emerald bg-rc-panel ${PANEL}`}
    >
      <div className="flex items-center justify-between gap-3 bg-rc-emerald px-4 py-2">
        <Label tone="onAccent">Today&apos;s top water</Label>
        {/* Band, never a number, and never a quote. */}
        {spot.trackRecord === "popular" && (
          <Label tone="onAccent">Popular spot</Label>
        )}
      </div>

      <div className={PAD}>
        <div className="flex items-start gap-3.5">
          <span className="shrink-0 rounded-lg bg-rc-emerald-deep px-3 py-2 font-rc-mono text-[26px] font-bold leading-none tabular-nums text-white">
            {entry.peak}
          </span>
          <span className="min-w-0 flex-1">
            <h2 id="spotlight" className={`${TYPE.title} text-rc-ink`}>
              <Link
                href={spotHref(spot)}
                className="hover:text-rc-emerald-deep transition-colors"
                onClick={onSpotClick}
              >
                {spot.name}
              </Link>
            </h2>
            <p className={`${TYPE.meta} text-rc-ink-soft mt-1`}>{rankLine}</p>
            {bottom && (
              <span className="mt-2 inline-flex">
                <Chip>{bottom}</Chip>
              </span>
            )}
          </span>
        </div>

        {/* The 24-hour shape, scrubbable. `ScoreStrip` is Explore's own
            strip — the same tinted cells, best-window bracket and detents a
            subscriber sees — rather than a landing-page mock of it. The
            series is already in the map payload, so it costs no request. */}
        <div className="mt-4 rounded-lg bg-rc-surface px-3 pt-2.5 pb-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label>Hour by hour</Label>
            <span className="font-rc-mono text-[11px] text-rc-ink-soft">
              {scrubHour == null
                ? "Drag to scrub"
                : `${formatHour12(scrubHour)} · ${entry.hours24[scrubHour] ?? "no score"}`}
            </span>
          </div>
          <ScoreStrip
            hours={entry.hours24}
            tz={tz}
            selectedHour={scrubHour}
            onHoverHour={setScrubHour}
            size="dense"
          />
        </div>

        {/* No "best window" box. The hero states it in 38px directly above
            this card and both now read the same row, so repeating it here
            was the same sentence twice — and with four facts in a two-column
            grid the odd one out left a hole. Tide and wind pair; the method
            takes its own row because its value runs to a clause. */}
        <div className="mt-3 grid grid-cols-2 items-stretch gap-2">
          {phase && (
            <Fact
              label={scrubHour == null ? "Tide" : `Tide at ${formatHour12(scrubHour)}`}
              value={phase}
              wide={!wind}
            />
          )}
          {wind && (
            <Fact
              label={scrubHour == null ? "Wind" : `Wind at ${formatHour12(scrubHour)}`}
              value={wind}
              wide={!phase}
            />
          )}
          {tactic && (
            <Fact label={`How ${cityName} fishes it`} value={tactic} wide />
          )}
        </div>
      </div>

      <Link
        href={spotHref(spot)}
        className="block border-t border-rc-rule px-4 py-3 text-[13px] font-semibold text-rc-emerald-deep hover:bg-rc-surface transition-colors"
        onClick={onSpotClick}
      >
        See the full day at {spot.name}
        <span aria-hidden> &rarr;</span>
      </Link>
    </section>
  );
}
