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

export default function FishingHeader() {
  const pathname = usePathname() ?? "";
  // /fishing/wa/seattle-wa exactly. Two segments is the province index, four
  // is a species guide.
  const isCityPage = pathname.replace(/\/$/, "").split("/").filter(Boolean).length === 3;

  return (
    <MarketingHeader
      ctaLabel={isCityPage ? "Unlock 14-day radar" : undefined}
    />
  );
}
