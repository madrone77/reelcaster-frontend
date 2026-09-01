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

import { usePathname } from "next/navigation";
import MarketingHeader from "@/app/components/marketing/marketing-header";
import { spotSlugFromPath } from "@/lib/paths";

export default function FishingHeader() {
  const pathname = usePathname() ?? "";

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

  // /fishing/wa/seattle-wa exactly. Two segments is the province index, four
  // is a species guide.
  const isCityPage = pathname.replace(/\/$/, "").split("/").filter(Boolean).length === 3;

  return (
    <MarketingHeader
      ctaLabel={isCityPage ? "Unlock 14-day radar" : undefined}
    />
  );
}
