"use client";

/**
 * The daily reports for the water next door.
 *
 * Anglers here fish across a boundary without thinking of it as travelling:
 * Victoria runs to Sidney and out to Sooke, Seattle crosses to Friday Harbor.
 * The home city's report answers "what is happening at home"; this answers
 * "and what about the next bay over", which on a slow week at home is the more
 * useful of the two and is the reason to come back tomorrow rather than next
 * month.
 *
 * The cities are chosen server-side and are never named by this component —
 * see the route. Passing a slug up from the browser would turn one Pro card
 * into a way to read every city's report by iterating slugs.
 *
 * Headlines side by side, and either one opens in full.
 *
 * Printed open, two neighbours ran four times the height of the home city's
 * own card — 493px against 301px — and the page stopped having an obvious
 * first read. Closed, they are two headlines in a row, which is enough to
 * decide whether to look.
 *
 * The full report opens BELOW the row rather than inside its column. Expanding
 * in place would stretch one half of a two-column grid and leave the other
 * hanging beside a wall of text; full width also gives the prose a sensible
 * measure instead of half of one.
 *
 * One open at a time, for the same reason: two expanded columns of unequal
 * length is the layout this was avoiding.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Paragraphs } from "./daily-report-card";
import { supabase } from "@/lib/supabase";
import { formatReportDate } from "@/lib/time-format";
import type { NearbyCityReport } from "@/app/api/bluecaster/nearby-reports/route";

interface Payload {
  locked?: boolean;
  cities?: NearbyCityReport[];
}

export default function NearbyReports() {
  const [data, setData] = useState<Payload | null>(null);
  /** The city whose report is open, by slug. One at a time. */
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const res = await fetch("/api/bluecaster/nearby-reports", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        setData(await res.json());
      } catch {
        // A block of secondary reports is never worth surfacing an error for.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Locked, still loading, or nothing near enough to name. All three render
  // nothing: the home city's own report above already carries the section, and
  // the paywall for it is stated there once rather than twice on one page.
  if (!data || data.locked || !data.cities?.length) return null;

  const openCity = data.cities.find((c) => c.city.slug === open) ?? null;

  return (
    <section className="rounded border border-rc-rule bg-rc-panel px-5 py-4">
      <p className="font-rc-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rc-ink-mute">
        Nearby water
      </p>

      {/* Side by side above `sm`, stacked below it. */}
      <div className="mt-2.5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {data.cities.map(({ city, headline, distanceKm, reportDate }) => {
          const isOpen = open === city.slug;
          return (
            <div key={city.slug} className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[14px] font-semibold text-rc-ink">
                  {city.name}
                </span>
                {/* Distance and the report's own date. Dated for the same
                    reason the main card is: these are not guaranteed daily,
                    and an undated headline reads as this morning's however old
                    it is. */}
                <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                  {Math.round(distanceKm)} km · {formatReportDate(reportDate)}
                </span>
                {/* The link to the city sits apart from the expander rather
                    than wrapping it. A button inside a link is not a thing a
                    keyboard or a screen reader can resolve. */}
                <Link
                  href={`/explore?loc=${encodeURIComponent(city.slug)}`}
                  aria-label={`Open ${city.name} on the map`}
                  className="ml-auto shrink-0 rounded p-1 text-rc-ink-mute hover:text-rc-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>

              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : city.slug)}
                aria-expanded={isOpen}
                aria-controls={`nearby-${city.slug}`}
                className="mt-0.5 block w-full rounded text-left text-[13px] leading-snug text-rc-ink-soft hover:text-rc-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
              >
                {headline ?? `What anglers are catching around ${city.name}`}
                <span className="mt-0.5 block text-[12px] font-semibold text-rc-brand">
                  {isOpen ? "Hide report" : "See report"}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Full width, under the row. */}
      {openCity && (
        <div
          id={`nearby-${openCity.city.slug}`}
          className="mt-3 border-t border-rc-rule pt-3"
        >
          <p className="mb-2 font-rc-mono text-[10px] uppercase tracking-wide text-rc-ink-mute">
            {openCity.city.name} · from the last {openCity.windowDays} days of
            reports
          </p>
          <div className="space-y-2">
            <Paragraphs
              md={openCity.reportsMd}
              className="text-[14px] leading-relaxed text-rc-ink-soft"
            />
          </div>
        </div>
      )}
    </section>
  );
}
