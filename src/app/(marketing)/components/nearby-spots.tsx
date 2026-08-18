'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { btn } from '@/app/components/ui/button';
import { TIER_PILL, tierFor } from '@/app/explore/lib/explore-data';
import { scoreColor } from '@/app/explore/lib/spot-geojson';
import type { NearbyPayload, NearbySpot } from '@/lib/nearby-spots';

/**
 * "Top fishing spots near you" — the homepage's one personalized section.
 *
 * A client component on purpose. The page around it is statically rendered and
 * revalidated hourly, and it has to stay that way: personalizing the document
 * would mean a crawler indexing whichever city its data centre happens to sit
 * near, and the homepage is the site's strongest ranking surface. So the HTML
 * ships with no city in it, and this fills in after hydration or not at all.
 *
 * Renders nothing while loading and nothing when the API says `located: false`
 * — a missing geo header, a visitor further than 150 km from covered water, or
 * a city with nothing scored today all land in the same silent case.
 */

/**
 * Dot size, in px, by score.
 *
 * The Explore map encodes score as COLOUR (`scoreColor`) and reserves shape
 * for ownership; there is no species colour anywhere in the app, so the dot
 * follows score and the species is named in the sub-line instead. Size is the
 * one extra channel this list can afford, and it makes the ranking legible at
 * a glance without reading a single numeral.
 */
function dotSize(score: number): number {
  const t = Math.max(0, Math.min(100, score)) / 100;
  return 7 + t * 6;
}

function SpotRow({ spot, rank }: { spot: NearbySpot; rank: number }) {
  const size = dotSize(spot.score);
  return (
    <li>
      <Link
        href={`/explore/spot/${spot.slug}`}
        className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-rc-surface"
      >
        <span className="w-4 shrink-0 text-right font-rc-mono text-[11px] tabular-nums text-rc-ink-mute">
          {rank}
        </span>

        {/* Fixed-width box so a big dot and a small one leave the names on the
            same left edge. */}
        <span className="flex w-4 shrink-0 items-center justify-center">
          <span
            aria-hidden
            className="rounded-full"
            style={{
              width: size,
              height: size,
              backgroundColor: scoreColor(spot.score),
            }}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight text-rc-ink">
            {spot.name}
          </span>
          {spot.topSpecies && (
            <span className="mt-0.5 block truncate font-rc-mono text-[10px] uppercase tracking-[0.08em] text-rc-ink-mute">
              {spot.topSpecies}
            </span>
          )}
        </span>

        <span
          className={`shrink-0 rounded px-2 py-0.5 font-rc-mono text-[12px] font-bold tabular-nums ${
            TIER_PILL[tierFor(spot.score)]
          }`}
        >
          {spot.score}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-rc-ink-mute" />
      </Link>
    </li>
  );
}

export default function NearbySpots() {
  const [data, setData] = useState<NearbyPayload | null>(null);
  const [safeToInsert, setSafeToInsert] = useState(false);
  // One ref for two element types across renders: the zero-height anchor and
  // the <section> that replaces it in the same slot.
  const anchorRef = useRef<HTMLElement | null>(null);

  /**
   * Insert only once doing so cannot move anything the visitor can see.
   *
   * Dropping ~900px of list into the document the moment the fetch lands cost
   * a measured CLS of 0.23 on a 1280x900 desktop — not because the section
   * lands in view, but because it landed while the hero above it was still
   * settling, so the ticker below was briefly on screen and got shoved off it.
   * Baseline for the same page is 0.0001.
   *
   * Two conditions, both necessary:
   *   • the page has finished loading, so the hero is at its final height and
   *     the anchor's position is worth trusting;
   *   • the anchor sits at or below the fold, so everything this displaces is
   *     off-screen. A layout shift below the viewport contributes nothing to
   *     CLS, and nobody watches content move where they cannot see it.
   *
   * This is why the section sits below <SignalsSection /> rather than directly
   * under the hero. Measured on the current homepage at 1280 wide: the hero
   * ends at 604px, so a slot under it is above a 900px fold and could never
   * insert cleanly; the slot here is at 1348px and does. Anything that grows
   * the page above this point pushes the slot further down, which is the safe
   * direction. Anything that shrinks it needs a fresh look at these numbers.
   *
   * A window tall enough to see past 1348px on load (say 1512x1400) still
   * holds the section back. That is the honest trade and it is rare.
   *
   * Re-checking on scroll would not help: scrolling down moves the anchor
   * further ABOVE the viewport, never below it, and inserting there relies on
   * scroll anchoring, which Safari does not implement, so an iOS visitor would
   * get the page yanked out from under them mid-read.
   */
  useEffect(() => {
    let cancelled = false;

    const check = () => {
      if (cancelled) return;
      const top = anchorRef.current?.getBoundingClientRect().top;
      if (typeof top === 'number' && top >= window.innerHeight) {
        setSafeToInsert(true);
      }
    };

    if (document.readyState === 'complete') {
      // A frame's grace so layout settles after the load handlers run.
      requestAnimationFrame(check);
    } else {
      window.addEventListener('load', () => requestAnimationFrame(check), {
        once: true,
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    // Carry a `?geo_lat=&geo_lng=` override on the page URL through to the
    // API, so the section can be exercised on localhost and on a preview
    // where the platform sets no geo headers. Inert in production: the route
    // reads the override only when VERCEL_ENV is not "production", so these
    // params cannot make the live site claim a visitor is somewhere else.
    const here = new URLSearchParams(window.location.search);
    const url = new URL('/api/nearby-spots', window.location.origin);
    for (const key of ['geo_lat', 'geo_lng'] as const) {
      const value = here.get(key);
      if (value) url.searchParams.set(key, value);
    }

    fetch(url.toString(), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: NearbyPayload | null) => setData(json))
      // An aborted or failed fetch leaves `data` null, which renders nothing.
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // The anchor is always in the tree and always zero-height, so there is a
  // stable thing to measure BEFORE deciding to insert anything above it.
  if (!data?.located || !data.city || !data.spots?.length || !safeToInsert) {
    return (
      <div
        ref={anchorRef as React.RefObject<HTMLDivElement>}
        aria-hidden
      />
    );
  }

  const { city, spots } = data;

  return (
    <section
      ref={anchorRef as React.RefObject<HTMLElement>}
      data-testid="homepage-nearby-spots"
      // Wears the same clothes as the sections around it: the panel/band
      // alternation, the hairline top rule, the 6xl two-column grid. By the
      // time this renders, `safeToInsert` has established that the space it is
      // about to occupy is below the fold, so the height it adds pushes only
      // off-screen content.
      className="animate-fade-in border-t border-rc-rule/60 bg-rc-panel motion-reduce:animate-none"
    >
      <div className="max-w-6xl mx-auto grid gap-14 px-6 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="flex items-center gap-2 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-rc-brand">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rc-brand" />
            Near you
          </p>
          {/* Two lines, second one brand — the headline shape every other
              section on this page uses. The city is the payoff, so it lands on
              the blue line. */}
          <h2 className="mt-4 text-balance text-3xl md:text-4xl font-black tracking-[-0.02em] leading-[1.15]">
            <span className="block text-rc-ink">Today&apos;s best water</span>
            <span className="block text-rc-brand">near {city.name}.</span>
          </h2>
          <p className="mt-5 max-w-lg text-pretty text-sm md:text-base leading-relaxed text-rc-ink-soft">
            These are the {spots.length} spots scoring highest right now,
            ranked by the same forecast the map draws from.
          </p>
          <p className="mt-3 max-w-lg text-pretty text-sm md:text-base leading-relaxed text-rc-ink-soft">
            Tides, current, weather, and open seasons, updated through the day.
          </p>
          <Link href={`/explore?loc=${city.slug}`} className={`mt-9 ${btn.primary}`}>
            See them on the map
          </Link>
        </div>

        {/* Same card treatment as the map on this page: hairline border, soft
            bar shadow, rows split by the internal-divider rule rather than by
            a full-strength border. */}
        <ol className="overflow-hidden rounded border border-rc-rule/60 bg-rc-panel shadow-rc-bar divide-y divide-rc-rule-soft">
          {spots.map((spot, i) => (
            <SpotRow key={spot.id} spot={spot} rank={i + 1} />
          ))}
        </ol>
      </div>
    </section>
  );
}
