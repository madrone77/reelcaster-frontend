import type { Metadata } from "next";
import City1Page, { city1Metadata } from "@/app/lp/_city1/city1-page";
import { VANCOUVER_1 } from "@/app/lp/_city1/city1-city";

/**
 * `/lp/vancouver/1` is the Vancouver twin of /lp/seattle/1: the same
 * city-first page, opening on Vancouver's own day.
 *
 * It completes the matrix rather than starting a new experiment. Vancouver
 * already ran /2 and /3, which are the blend -- this page's hero over /lp/7's
 * live instrument -- with no /1 underneath them to compare against, so the
 * Seattle series had a baseline the Vancouver series did not.
 *
 * Nothing here is a copy. The page is @/app/lp/_city1/city1-page.tsx and the
 * whole of the difference from Seattle is VANCOUVER_1: the slug, the landing
 * key, the reel capture, the species named in the hero, the spelling of
 * "coloured", and the water in the footer. Everything else that changes -- DFO instead of
 * WDFW, CHS instead of NOAA, the marks, the scores, the area badge -- is
 * resolved from the city's own data and its spots' province, not typed here.
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
  return city1Metadata(VANCOUVER_1, searchParams);
}

export default function LpVancouver1() {
  return <City1Page city={VANCOUVER_1} />;
}
