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
 * Headlines only, side by side. The home city's own report is one line and a
 * control; two neighbours printed in full underneath it made the secondary
 * thing four times the size of the primary one — 493px against 301px at one
 * point — and the page stopped having an obvious first read.
 *
 * So each neighbour is its city, its distance and its headline sentence, in a
 * row. That is enough to decide whether to look, and "Open" carries anyone who
 * wants the rest to the city itself.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatReportDate } from "@/lib/time-format";
import type { NearbyCityReport } from "@/app/api/bluecaster/nearby-reports/route";

interface Payload {
  locked?: boolean;
  cities?: NearbyCityReport[];
}

export default function NearbyReports() {
  const [data, setData] = useState<Payload | null>(null);

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

  return (
    <section className="rounded border border-rc-rule bg-rc-panel px-5 py-4">
      <p className="font-rc-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rc-ink-mute">
        Nearby water
      </p>

      {/* Side by side above `sm`, stacked below it. Two columns of a headline
          each is the whole block; it must not grow taller than the card above
          it. */}
      <div className="mt-2.5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {data.cities.map(({ city, headline, distanceKm, reportDate }) => (
          <Link
            key={city.slug}
            href={`/explore?loc=${encodeURIComponent(city.slug)}`}
            className="group min-w-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
          >
            <span className="flex items-baseline gap-2">
              <span className="text-[14px] font-semibold text-rc-ink group-hover:text-rc-brand">
                {city.name}
              </span>
              {/* Distance and the report's own date. Dated for the same
                  reason the main card is: these are not guaranteed daily, and
                  an undated headline reads as this morning's however old it
                  is. */}
              <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                {Math.round(distanceKm)} km · {formatReportDate(reportDate)}
              </span>
              <ArrowUpRight
                className="ml-auto h-3.5 w-3.5 shrink-0 text-rc-ink-mute group-hover:text-rc-brand"
                aria-hidden
              />
            </span>
            {headline && (
              <span className="mt-0.5 block text-[13px] leading-snug text-rc-ink-soft">
                {headline}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
