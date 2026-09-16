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

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import type { FishingCity } from "@/app/fishing/lib/fishing-data";
import SeoHero from "@/app/fishing/seo-hero";

export default function CityHeader({
  city,
  provincePath,
  window,
  hero,
}: {
  city: FishingCity;
  provincePath: string;
  /**
   * The landing hero, in the markets that carry it.
   *
   * Wraps the H1 and the line under it, NOT the breadcrumb: those three links
   * are the page's way back up the hierarchy and are worth as much to a
   * crawler as the heading is. See fishing/seo-hero.tsx.
   */
  hero?: {
    enabled: boolean;
    /** The city's lead mark, which is what the hero's copy is written about. */
    spotName: string;
    fish: string | null;
    fishSlug: string | null;
    score: number | null;
    mapHref: string;
    /** The four-phone reel, built on the server against the lead mark. */
    reel?: ReactNode;
  } | null;
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

      <SeoHero
        enabled={hero?.enabled ?? false}
        place={city.slug}
        pills={null}
        /* The SAME heading the block below would have rendered, answer-first
           and with the hours in it. The hero must not quietly cost this page
           the H1 it was given on purpose — see the note over that <h1>. */
        title={
          window
            ? `Today's best fishing in ${city.name}: ${window}`
            : `Fishing in ${city.name}, ${city.provinceCode}`
        }
        spotName={hero?.spotName ?? city.name}
        fish={hero?.fish ?? null}
        fishSlug={hero?.fishSlug ?? null}
        score={hero?.score ?? null}
        /* Null, not `window`: the H1 above already names the hours, and the
           hero's sentence would otherwise repeat them two lines later. The
           verdict ("Chinook fishing at Sand Point Hump looks good today")
           still carries, which is the half the heading does not say. */
        windowLabel={null}
        /* Spot pages name the tide beside the window; a city's headline window
           is read off one mark and the phase would not be true of the rest. */
        tidePhase={null}
        mapHref={hero?.mapHref ?? `/explore?loc=${city.slug}`}
        reel={hero?.reel ?? null}
      >
      {/* Leads with the answer, and still carries the phrase people search.
          Falls back to the plain form on a day with nothing scored, because
          "Today's best fishing in Seattle:" with no time after it is worse
          than a title that promises less. */}
      <h1 className="mt-2 text-[26px] sm:text-[32px] font-bold leading-tight text-rc-ink">
        {window
          ? `Today's best fishing in ${city.name}: ${window}`
          : `Fishing in ${city.name}, ${city.provinceCode}`}
      </h1>
      </SeoHero>

      {/* The lede, and it is OUTSIDE the hero on purpose.
          It used to sit under the H1 as one of SeoHero's children, which
          meant the hero swallowed it: in the markets that carry a hero the
          page lost this line entirely, and it is the one sentence that says
          what everything below it IS. Out here it renders on every city page
          — under the H1 where there is no hero, under the hero where there
          is — and the order a reader sees is unchanged either way.

          Not folded into the hero's own paragraph. That one describes the
          scoring at one mark; this one frames the whole page under it as
          evidence rather than a pitch, which is a different claim.

          No measure cap and no balancing: this is ONE line. At 15px the
          sentence runs about 600px, well inside the 1152px container, so it
          fits unbroken on any desktop width. The old 54ch cap was sized for
          the previous two-clause lede and forced this one to wrap mid-phrase.
          A phone still wraps it, which is the width doing it rather than us. */}
      <p
        className={`text-[15px] leading-relaxed text-rc-ink-soft ${
          hero?.enabled ? "mt-8" : "mt-2"
        }`}
      >
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

      {/* Down to the map.
          The map is the piece of this page that reads as a product rather
          than a page — every mark we cover, on charted seabed — and it sits
          four sections below the fold, past the 14-day strip, the 24-hour
          chart and the top-spots list. A reader who came for "where do I fish
          around here" had no way to reach it without scrolling through the
          sell.

          A plain anchor, not a scroll handler: it works before hydration and
          with JavaScript off, and it leaves a real fragment in the URL that
          can be shared. No smooth easing, deliberately — `scroll-behavior`
          only takes effect on <html>, so buying it here would mean turning it
          on for Explore and the dashboard too. The section it lands on
          carries `scroll-mt` to clear the sticky bar: see
          instrument/section.tsx. */}
      <a
        href="#city-map"
        className="mt-5 inline-flex items-center gap-2 rounded bg-rc-brand-soft px-4 py-2.5 text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.04em] hover:bg-rc-brand-soft/70 transition-colors"
      >
        View {city.name} fishing map
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      </a>
    </header>
  );
}
