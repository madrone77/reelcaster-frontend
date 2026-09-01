"use client";

import { usePathname } from "next/navigation";
import { spotSlugFromPath } from "@/lib/paths";
import OwnerSpotFallback from "./owner-spot-fallback";

/**
 * Next hands not-found.tsx no params, so recover the slug from the URL.
 *
 * There are two URLs a spot can be at now, and this component renders under
 * both: the canonical /fishing/<country>/<state>/<city>/<spot> and the retired
 * /explore/spot/<slug>, which is the one private custom spots never leave and
 * therefore the one that matters most here.
 *
 * An unrecognised shape yields "", and OwnerSpotFallback denies immediately on
 * an empty slug rather than fetching a garbage URL.
 */
export default function OwnerSpotFallbackFromPath() {
  const slug = spotSlugFromPath(usePathname() ?? "");

  return <OwnerSpotFallback slug={slug} />;
}
