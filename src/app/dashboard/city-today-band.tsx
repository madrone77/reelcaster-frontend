"use client";

/**
 * The angler's home city, today. The first thing on the dashboard.
 *
 * The dashboard used to open on one pinned spot, which meant it had nothing to
 * say to an angler who had not pinned one, and not much to say to one whose
 * spot happened to be poor today. A city always has an answer: something in it
 * is fishing, something is open, and there is a better day coming. That is the
 * question people actually open this page with.
 *
 * Everything here is city-grain and honest at that grain. The verdict is
 * upstream's own band rather than an average of spot scores, the species rows
 * are the city's roster with each one's own best window, and nothing claims a
 * tide or a wind, because those differ across a city's water and inventing a
 * representative one would be a number we made up.
 *
 * `ahead.best` is already entitlement-scoped by the route: it summarises the
 * forecast horizon, and "the best day is Thursday" is day 9 information even
 * when the day 9 cell draws locked.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { BlueCasterCityToday } from "@/lib/bluecaster";
import { speciesDisplayName } from "@/app/explore/lib/explore-data";
import { formatHour12 } from "@/lib/time-format";

/** How many species the roster names before it defers to the city page. */
const SHOWN_SPECIES = 5;

/**
 * The verdict band, in the tokens every other surface uses for a score.
 *
 * Deliberately not `tierFor`: that maps a 0-100 score, and this is upstream's
 * own four-way call about the day. Mapping one onto the other would let the
 * band and the numbers below it disagree in public.
 */
const VERDICT: Record<
  NonNullable<BlueCasterCityToday["verdict"]>,
  { label: string; pill: string }
> = {
  excellent: { label: "Excellent", pill: "bg-rc-good/15 text-rc-good" },
  good: { label: "Good", pill: "bg-rc-good/15 text-rc-good" },
  fair: { label: "Fair", pill: "bg-rc-fair/20 text-rc-fair-ink" },
  slow: { label: "Slow", pill: "bg-rc-poor/15 text-rc-poor" },
};

/**
 * The window as a phrase.
 *
 * `end_hour` names the LAST good hour, so the label closes an hour later. Same
 * convention the city page's headline and the spot page's best window use; a
 * reader who taps through must not find the window moved by an hour.
 */
function windowLabel(w: { start_hour: number; end_hour: number } | null): string | null {
  if (!w) return null;
  return `${formatHour12(w.start_hour)}-${formatHour12((w.end_hour + 1) % 24)}`;
}

/** "Tomorrow", "Thursday", or a date when it is far enough out to need one. */
function dayLabel(daysOut: number, date: string): string {
  if (daysOut <= 0) return "today";
  if (daysOut === 1) return "tomorrow";
  // Parsed as a plain date at noon so a timezone offset cannot roll it back a
  // day. The string is upstream's YYYY-MM-DD.
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return `in ${daysOut} days`;
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

export default function CityTodayBand({
  cityName,
  cityPath,
  today,
}: {
  cityName: string;
  /** The city's own page, for the reader who wants the whole picture. */
  cityPath: string | null;
  /** undefined = still reading, null = it settled with nothing. */
  today: BlueCasterCityToday | null | undefined;
}) {
  if (today === undefined) {
    return <div className="h-[168px] animate-pulse rounded bg-rc-panel" />;
  }

  // Settled with nothing. Say the city and stop rather than drawing an empty
  // band: a dashboard that opens on a broken card is worse than one that opens
  // on the spot list.
  if (!today) return null;

  const verdict = today.verdict ? VERDICT[today.verdict] : null;
  const headline = today.headline;
  const headlineWindow = headline ? windowLabel(headline.window) : null;
  const species = today.species.slice(0, SHOWN_SPECIES);
  const best = today.ahead?.best ?? null;

  return (
    <section className="rounded border border-rc-rule bg-rc-panel p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="rc-title-lg text-xl">{cityName} today</h2>
        {verdict && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${verdict.pill}`}
          >
            {verdict.label}
          </span>
        )}
        {cityPath && (
          <Link
            href={cityPath}
            className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-rc-brand hover:underline"
          >
            The whole city
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>

      {headline && (
        <p className="mt-2 text-sm text-rc-ink-soft">
          Best on{" "}
          <span className="font-semibold text-rc-ink">
            {speciesDisplayName(headline.species_name)}
          </span>
          {headlineWindow ? `, ${headlineWindow}` : null}
          {headline.good_hours > 0 ? ` · ${headline.good_hours} good hours` : null}
        </p>
      )}

      {species.length > 0 && (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-rc-ink-mute">
            What you can fish
          </p>
          <ul className="mt-2 divide-y divide-rc-rule">
            {species.map((s) => {
              const w = windowLabel(s.window);
              return (
                <li
                  key={s.species_id}
                  className="flex items-baseline gap-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-rc-ink">
                    {speciesDisplayName(s.species_name)}
                  </span>
                  {w && (
                    <span className="shrink-0 font-rc-mono text-[11px] text-rc-ink-mute">
                      {w}
                    </span>
                  )}
                  {/* `day_avg`, not `peak`. Post-rescale every healthy day
                      peaks 89 to 92, so peaks separate nothing: a column of
                      them reads as five identical species. */}
                  <span className="w-8 shrink-0 text-right font-rc-mono text-[13px] font-semibold text-rc-ink">
                    {Math.round(s.day_avg)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {best && (
        <p className="mt-4 border-t border-rc-rule pt-3 text-sm text-rc-ink-soft">
          Best day ahead is{" "}
          <span className="font-semibold text-rc-ink">
            {dayLabel(best.days_out, best.date)}
          </span>{" "}
          on {speciesDisplayName(best.species_name)}
          {best.good_hours > 0 ? `, ${best.good_hours} good hours` : null}.
        </p>
      )}
    </section>
  );
}
