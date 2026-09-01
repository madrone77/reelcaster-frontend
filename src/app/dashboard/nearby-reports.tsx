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
 * Each city gets its headline and the first two sentences, not the whole
 * report. The point of this block is the scan: enough to decide whether the
 * run is worth it, and the city page carries the rest.
 *
 * That cap is load-bearing. Untrimmed, these reports run the same length as
 * the home city's — the block came out 493px against the main card's 301px,
 * so the secondary thing was larger than the thing it sits under, and the
 * page stopped having an obvious first read.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { NearbyCityReport } from "@/app/api/bluecaster/nearby-reports/route";

interface Payload {
  locked?: boolean;
  cities?: NearbyCityReport[];
}

/** How many sentences of a neighbour's report to show. */
const SENTENCES = 2;

/**
 * The opening sentences of the report, with the `**bold**` BlueCaster wraps
 * spot and species names in.
 *
 * Deliberately not a markdown renderer, same as the main card: this text is
 * LLM-written from scraped forum posts, so the less of it that becomes markup
 * the better. Bold is the only formatting the prompt emits.
 *
 * Trimmed on whole sentences rather than a character count, so a cut can never
 * land inside a `**...**` pair and leave the asterisks on screen.
 */
function Excerpt({ md }: { md: string }) {
  const firstPara = md.split(/\n{2,}/)[0]?.trim() ?? "";
  const sentences = firstPara.match(/[^.!?]+[.!?]+(\s|$)/g);
  const text = sentences
    ? sentences.slice(0, SENTENCES).join("").trim()
    : firstPara;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="mt-1 text-[13.5px] leading-relaxed text-rc-ink-soft">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} className="font-semibold text-rc-ink">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
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

      <div className="mt-3 divide-y divide-rc-rule">
        {data.cities.map(({ city, headline, reportsMd, distanceKm }) => {
          return (
            <div key={city.slug} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-[15px] font-semibold text-rc-ink">
                  {city.name}
                </h3>
                <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                  {Math.round(distanceKm)} km
                </span>
                <Link
                  href={`/explore?loc=${encodeURIComponent(city.slug)}`}
                  className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-rc-brand hover:underline"
                >
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>

              {headline && (
                <p className="mt-1 text-[14px] font-medium leading-snug text-rc-ink">
                  {headline}
                </p>
              )}
              <Excerpt md={reportsMd} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
