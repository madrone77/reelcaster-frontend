"use client";

// "Dockside checks" — WDFW's ramp counts for the marine area a spot or a city
// sits in, over the trailing fortnight.
//
// Sits directly under "Recent reports" on a spot page and stands in for it on
// most Washington water, where the forums are not scraped and the report band
// never renders. Same shell as the report band so the two read as one stack.
//
// Everything here is the state's own sampling and public, so it renders for
// every reader, locked or not, and nothing in it is source attribution. What
// it must never do is pretend to be this spot's tally: the label names the
// whole marine area and the copy says "across", because "Shilshole ramp,
// Area 10" is somebody who launched at Shilshole and fished somewhere in
// central Puget Sound. See lib/bluecaster/creel-types.ts.
//
// Collapsed by default to the headline row and the kept-fish bars. Ramps and
// the trend line sit behind one expander, same pattern as the report band.

import { useState } from "react";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import type { CreelAreaReport } from "@/lib/bluecaster/creel-types";
import { describePerAngler, fmtCount } from "@/lib/bluecaster/creel-types";
import { reportAge } from "@/app/explore/lib/fresh-catch-types";

function Header({ report, title }: { report: CreelAreaReport; title: string }) {
  const age = reportAge(report.latestSurveyDate);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="rc-label text-[9px]">{title}</div>
      <span className="shrink-0 font-rc-mono text-[10px] uppercase tracking-[0.06em] text-rc-ink-mute">
        {age ? `Checked ${age}` : `last ${report.windowDays} days`}
      </span>
    </div>
  );
}

/** One species: name, a bar scaled to the best rate in the list, the kept
 *  count and the plain-words rate. The bar compares species with each other,
 *  which is the question ("what are they keeping"), not a hit rate. */
function KeptRow({
  species,
  kept,
  perAngler,
  maxPerAngler,
}: {
  species: string;
  kept: number;
  perAngler: number | null;
  maxPerAngler: number;
}) {
  const pct =
    perAngler != null && maxPerAngler > 0
      ? Math.max(3, Math.round((perAngler / maxPerAngler) * 100))
      : 0;
  return (
    <li className="flex items-center gap-3">
      <span className="w-[128px] shrink-0 truncate text-[13.5px] font-semibold text-rc-ink">
        {species}
      </span>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-rc-surface" aria-hidden>
        <span className="block h-full rounded-full bg-rc-good" style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 whitespace-nowrap font-rc-mono text-[11px] text-rc-ink-mute">
        <span className="text-rc-ink">{fmtCount(kept)}</span> kept
        {perAngler != null && (
          <span className="hidden sm:inline">{` · ${describePerAngler(perAngler)}`}</span>
        )}
      </span>
    </li>
  );
}

export function DocksideChecks({
  report,
  title = "Dockside checks",
  /** The spots this page covers in the area, for the city page. */
  spotCount,
  className = "",
}: {
  report: CreelAreaReport | null;
  title?: string;
  spotCount?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!report || report.anglers === 0) return null;

  const maxPerAngler = Math.max(0, ...report.kept.map((k) => k.perAngler ?? 0));
  const lead = report.kept[0] ?? null;
  const trend = report.trend;

  return (
    <section className={`rounded border border-rc-rule bg-rc-panel p-4 lg:p-5 ${className}`}>
      <Header report={report} title={title} />

      <div className="mt-3 grid gap-x-8 gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-snug text-rc-ink lg:text-[19px]">
            {lead
              ? `${lead.species} ${lead.kept === 1 ? "is" : "are"} what anglers are keeping across ${report.areaLabel}`
              : `Nothing kept across ${report.areaLabel} lately`}
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-snug text-rc-ink-soft">
            WDFW samplers checked {fmtCount(report.anglers)} anglers at the ramps over{" "}
            {report.surveyDays} day{report.surveyDays === 1 ? "" : "s"}.
            {spotCount != null && spotCount > 0
              ? ` ${spotCount} spot${spotCount === 1 ? "" : "s"} on this page sit${spotCount === 1 ? "s" : ""} in this water.`
              : ""}{" "}
            Counts are for the whole area, and only fish kept are counted.
          </p>
        </div>

        {trend && (
          <div className="flex items-center gap-2 lg:w-[188px] lg:justify-end">
            {trend.direction === "building" ? (
              <TrendingUp className="h-4 w-4 shrink-0 text-rc-good" aria-hidden />
            ) : trend.direction === "fading" ? (
              <TrendingDown className="h-4 w-4 shrink-0 text-rc-fair" aria-hidden />
            ) : null}
            <span className="font-rc-mono text-[11px] text-rc-ink-mute">
              {trend.species}{" "}
              <span className="text-rc-ink">
                {trend.direction === "steady" ? "holding steady" : trend.direction}
              </span>
            </span>
          </div>
        )}
      </div>

      {report.kept.length > 0 && (
        <div className="mt-4 border-t border-rc-rule pt-4">
          <div className="font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute">
            Kept, per angler checked
          </div>
          <ul className="mt-3 flex flex-col gap-3.5">
            {report.kept.map((k) => (
              <KeptRow key={k.species} {...k} maxPerAngler={maxPerAngler} />
            ))}
          </ul>
        </div>
      )}

      {expanded && (
        <>
          {report.topRamps.length > 0 && (
            <div className="mt-4 border-t border-rc-rule pt-4">
              <div className="font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute">
                Where the boats are launching
              </div>
              <ul className="mt-2 grid gap-x-8 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
                {report.topRamps.map((r) => (
                  <li key={r.ramp} className="flex gap-2 text-[12.5px] leading-snug text-rc-ink-soft">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rotate-45 bg-rc-brand" />
                    <span className="min-w-0">
                      <span className="text-rc-ink">{r.ramp}</span>
                      {`, ${fmtCount(r.anglers)} anglers`}
                      {r.kept.length > 0 &&
                        `, ${r.kept
                          .slice(0, 2)
                          .map((k) => `${fmtCount(k.kept)} ${k.species.toLowerCase()}`)
                          .join(" and ")} kept`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {trend && (
            <p className="mt-4 border-t border-rc-rule pt-4 text-[12.5px] leading-snug text-rc-ink-soft">
              {trend.species} went from {describePerAngler(trend.priorPerAngler) || "none"} in the
              older half of the window to {describePerAngler(trend.recentPerAngler) || "none"} in
              the newer half.
            </p>
          )}
          {report.chinookPerAngler != null && (
            <p className="mt-2 text-[12.5px] leading-snug text-rc-ink-soft">
              WDFW&apos;s own published Chinook rate for the area:{" "}
              {describePerAngler(report.chinookPerAngler) || "none"}.
            </p>
          )}
        </>
      )}

      {(report.topRamps.length > 0 || trend) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 flex items-center gap-1.5 font-rc-mono text-[11px] font-bold uppercase tracking-[0.06em] text-rc-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDown
            aria-hidden
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </section>
  );
}
