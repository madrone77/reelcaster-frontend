"use client";

// The marketing bar, with the city page's CTA relabelled.
//
// A tiny client wrapper rather than a prop on the layout, because a layout
// segment cannot see which child route it is rendering, and the alternative —
// making /fishing/layout.tsx itself a client component — would put the whole
// directory tree behind a client boundary to change four words.
//
// Only the city page is relabelled. The province index and the species guides
// keep "Start free trial": they are read as reference, not arrived at from an
// ad, and the button that follows a paid click is the one worth naming an
// outcome for. The `from` attribution key is untouched, so a relabelled
// button still reports as the same entry point.
//
// It says "Try Pro free", which is what the same offer is called everywhere it
// is made on these pages: the landing hero's own filled button under the
// headline, and the ad spot page's top bar. It replaced "Unlock 14-day radar",
// which named a feature the reader had not been shown yet and named the trial
// nowhere. Where that hero is on the page the bar's button is also centred
// over its phone column, so the two offers are one column apart rather than
// one at the page edge and one in the middle.

import { usePathname } from "next/navigation";
import MarketingHeader from "@/app/components/marketing/marketing-header";
import { useFishingPlace } from "./fishing-place";
import { spotSlugFromPath } from "@/lib/paths";
import { seoHeroEnabled } from "@/lib/seo-hero";
import { AD_HERO_REEL_COL } from "./[country]/[state]/[city]/[spot]/ad-intro";

export default function FishingHeader() {
  const pathname = usePathname() ?? "";
  const place = useFishingPlace();

  // The spot page brings its own bar, so this one stands down.
  //
  // It is an app surface that happens to live at an indexable URL, not a
  // directory page: it renders ExploreTopBar (fixed, h-16, rolls away on
  // scroll) and offsets itself by `pt-16` to clear it. Rendering a second,
  // sticky 65px bar underneath left both stacked — the fixed one covering the
  // sticky one, the sticky one still holding its height in the flow — so the
  // page opened on 80px of nothing and the spot's name started below the fold
  // on a phone.
  //
  // Suppressed on the ad frame too, which is a rewrite one segment below the
  // spot page. That one matters for more than spacing: paid traffic gets
  // AdBrandBar precisely because every link in a real bar is a way out of a
  // page that cost money to land on.
  if (spotSlugFromPath(pathname)) return null;

  // /fishing/ca/bc/victoria exactly, which is FOUR segments under the country
  // /state/city shape. It was three when a single `province` segment stood in
  // for country and state, and the slug migration moved every level down one
  // without moving this count — so the relabel had been landing on
  // /fishing/ca/bc, the state index, and the city page it was written for had
  // stopped getting it.
  //
  // Depths, for the next person who adds a level: 2 country, 3 state, 4 city,
  // 5 spot (returned above), 6 species guide.
  const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const isCityPage = segments.length === 4;

  // The landing hero's phone column, when this city page carries one — the
  // button then sits centred over the phone instead of out at the page edge.
  //
  // Read off the route, the same way the hero's own switch is (lib/seo-hero.ts),
  // so it is settled in the server render rather than after hydration: the
  // fishing-place context is set in an effect, and a button that jumped 200px
  // on hydrate would be worse than one that never moved. The cost of reading
  // the route rather than the page is a city with nothing scored today, where
  // the hero renders single-column and this centres over a column that is not
  // there.
  const heroColumn =
    isCityPage && seoHeroEnabled(segments[1], segments[2])
      ? AD_HERO_REEL_COL
      : undefined;

  // Only the city page names a place, for the same reason only it is
  // relabelled: it is the page paid traffic lands on, and it is the only one
  // under /fishing whose subject is a single city. The province index covers a
  // whole province and the licence guides cover none, so both keep the plain
  // headline rather than naming whichever city happened to be declared last.
  // `data-fishing-chrome`: the city ad page (`?ad=` on this same path, see
  // [city]/ad) wears its own top bar, and globals.css hides this one under it.
  // Decided in CSS rather than here because reading the query string would opt
  // the prerendered public city page out of static rendering. `contents`, so
  // the wrapper draws no box and the header's `sticky` still works.
  return (
    <div data-fishing-chrome="" className="contents">
      <MarketingHeader
        ctaLabel={isCityPage ? "Try Pro free" : undefined}
        ctaOverColumn={heroColumn}
        placeName={isCityPage ? (place ?? undefined) : undefined}
      />
    </div>
  );
}
