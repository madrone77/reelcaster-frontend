// The breadcrumb and the H1 for a city page.
//
// ── Why the H1 is back here ──────────────────────────────────────────────
//
// It moved into the bite radar, on the reasoning that a page's H1 belongs on
// the thing the reader came for. That was right about emphasis and wrong
// about mechanics: the radar lives inside `CityHub`, which reads
// `useSearchParams()` for the `?species=` deep link, and in Next 15 that
// bails its whole subtree out of prerendering. The static HTML got the
// Suspense fallback instead, so the shipped page had **no H1 at all** — the
// served markup carried six H2s and nothing above them.
//
// Nothing caught it because every check was a browser with JavaScript on.
//
// This component is a server component outside that boundary, so the heading
// is in the markup unconditionally. That is the right home for it even if the
// block below is later made to prerender: an H1 is page-level structure, and
// hanging it off a client component's render path is what made it possible to
// lose in the first place.
//
// No photo. There is deliberately no hero image on these pages, and the
// social card is generated rather than photographed: a generic harbour shot
// tells an angler nothing, and sourcing one per city is a licensing
// dependency on every new city we launch.

import Link from "next/link";
import type { FishingCity } from "../../lib/fishing-data";

export default function CityHeader({
  city,
  provincePath,
  spotCount,
}: {
  city: FishingCity;
  provincePath: string;
  /** Published spots the page is showing. Rendered beside the region so the
   *  H1 block states the page's scope without waiting on any client data. */
  spotCount: number;
}) {
  return (
    <header>
      <nav
        aria-label="Breadcrumb"
        className="font-rc-mono text-[11px] text-rc-ink-mute"
      >
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-rc-ink transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href={provincePath}
              className="hover:text-rc-ink transition-colors"
            >
              Fishing in {city.provinceName}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-rc-ink-soft" aria-current="page">
            {city.name}
          </li>
        </ol>
      </nav>

      {/* Carries the phrase people search AND the promise the ad made, for
          the same reason the radar's version did. */}
      <h1 className="mt-2 text-[26px] sm:text-[30px] font-bold leading-tight text-rc-ink">
        Fishing in {city.name}, {city.provinceCode}: today&apos;s forecast
      </h1>
      <p className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-soft">
        {spotCount} spot{spotCount === 1 ? "" : "s"} · {city.regionName}
      </p>
    </header>
  );
}
