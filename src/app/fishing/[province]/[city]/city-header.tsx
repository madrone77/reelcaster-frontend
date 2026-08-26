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
  window,
}: {
  city: FishingCity;
  provincePath: string;
  /**
   * Today's best window at the top-ranked mark, already formatted, or null.
   *
   * Computed on the SERVER and deliberately not re-pointed by the species
   * chips. The block below re-ranks on every chip tap; an H1 that moved with
   * it would rewrite the page's title under the reader, and the H1 is the one
   * line that has to be stable for search.
   */
  window: string | null;
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

      {/* Leads with the answer, and still carries the phrase people search.
          Falls back to the plain form on a day with nothing scored, because
          "Today's best fishing in Seattle:" with no time after it is worse
          than a title that promises less. */}
      <h1 className="mt-2 text-[26px] sm:text-[32px] font-bold leading-tight text-rc-ink">
        {window
          ? `Today's best fishing in ${city.name}: ${window}`
          : `Fishing in ${city.name}, ${city.provinceCode}`}
      </h1>
      {/* No measure cap and no balancing: this is ONE line. At 15px the
          sentence runs about 600px, well inside the 1152px container, so it
          fits unbroken on any desktop width. The old 54ch cap was sized for
          the previous two-clause lede and forced this one to wrap mid-phrase.
          A phone still wraps it, which is the width doing it rather than us. */}
      <p className="mt-2 text-[15px] leading-relaxed text-rc-ink-soft">
        {/* Casey's wording, kept verbatim. It frames the page as a sample of
            the product rather than a description of it, which is what the
            page now IS: every number below is live, and the locked days are
            the only thing held back.

            It replaced "We score every fishing spot in {city}, every hour for
            14 days ahead, so you always know when to go." That line described
            the service; this one points at the evidence underneath it. */}
        This page is full of real data to show you what you can see with
        ReelCaster in {city.name}.
      </p>
    </header>
  );
}
