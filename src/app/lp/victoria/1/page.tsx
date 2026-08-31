import type { Metadata } from "next";
import City1Page, { city1Metadata } from "@/app/lp/_city1/city1-page";
import { VICTORIA_1 } from "@/app/lp/_city1/city1-city";

/**
 * `/lp/victoria/1` -- the city-first page on Juan de Fuca.
 *
 * Victoria is the fallback city every untagged `/lp/<n>` link already lands on
 * (see ../../lp-entry.ts), and until now it had no page of its own shape to
 * land on. The reel carries eight stops, the most of any city running this
 * page: the whole waterfront from Esquimalt Harbour Entrance out to Trial
 * Islands.
 *
 * Nothing here is a copy. The page is @/app/lp/_city1/city1-page.tsx and the
 * whole of the difference from Seattle and Vancouver is VICTORIA_1. DFO
 * instead of WDFW, CHS instead of NOAA, the marks, the scores and the area
 * badge all resolve from the city's own data and its spots' province.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Matches the other variants. Inert while generateMetadata reads searchParams
// for the angle, and correct the moment it stops.
export const revalidate = 900;

export function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  return city1Metadata(VICTORIA_1, searchParams);
}

export default function LpVictoria1() {
  return <City1Page city={VICTORIA_1} />;
}
