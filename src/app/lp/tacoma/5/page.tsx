import type { Metadata } from "next";
import City1Page, { city1Metadata } from "@/app/lp/_city1/city1-page";
import { TACOMA_1 } from "@/app/lp/_city1/city1-city";

/**
 * `/lp/tacoma/5` -- every screen the family has, on one page, for Tacoma.
 *
 * The same page as ../../seattle/5 on a different City1City: the reel walks
 * Tacoma's own sheet (Point Dalco down to Point Fosdick), the second picture
 * is the spot page for Point Defiance (Clay Banks) drawn live from the
 * product's components with the callouts measured onto it, the alert band
 * shows a King Salmon alert for that mark, and the day chart sits under it
 * as a fourth band. Same shell, same copy, same explore-only CTA.
 *
 * Tacoma's first landing page, and the first city to start at /5 rather
 * than /1: there is no /lp/tacoma/1 or /4, so nothing here is an arm of a
 * test yet. Counts under `lptacoma5` (city1-city.ts).
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
  return city1Metadata(TACOMA_1, searchParams);
}

export default function LpTacoma5() {
  return <City1Page city={TACOMA_1} variant={5} />;
}
