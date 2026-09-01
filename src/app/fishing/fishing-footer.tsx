"use client";

// The marketing footer, minus the one route under /fishing that renders its
// own.
//
// Same reasoning as ./fishing-header: the spot page is an app surface at an
// indexable URL, and it already ends with a footer of its own — one that
// swaps to AdFooter on the ad frame. Moving under this layout in the slug
// migration gave it a second, unconditional one stacked underneath.
//
// The ad frame is the case that makes this more than a duplicate. A footer of
// Locations / Company / Product links at the foot of a page someone paid to
// land on is a wall of exits, which is the whole reason that page swaps both
// its bar and its footer in the first place.

import { usePathname } from "next/navigation";
import MarketingFooter from "@/app/components/marketing/marketing-footer";
import { spotSlugFromPath } from "@/lib/paths";

export default function FishingFooter() {
  const pathname = usePathname() ?? "";
  if (spotSlugFromPath(pathname)) return null;
  return <MarketingFooter />;
}
