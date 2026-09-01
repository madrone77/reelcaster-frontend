import type { Metadata } from "next";
import City1Page, { city1Metadata } from "@/app/lp/_city1/city1-page";
import { VANCOUVER_1 } from "@/app/lp/_city1/city1-city";

/**
 * `/lp/vancouver/4` -- /lp/vancouver/1 with the second picture alive.
 *
 * ONE variable against /1, and it is the WHERE / WHAT / WHEN slot: /1 shows a
 * still screenshot of a spot page, /4 shows the same screen as a working
 * phone, scrubbing itself across today's real hours at the mark the hero is
 * already about. Same shell, same copy, same explore-only CTA, same ranking,
 * so the pair reads as an experiment rather than as two pages. The argument
 * is that the screen's whole point is that the numbers move together, and a
 * still is the one thing that cannot say so.
 *
 * Counts under `lpvancouver4` (city1-city.ts). See ../1 for the arm it is
 * measured against, and ../2 / ../3 for the blend.
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

export default function LpVancouver4() {
  return <City1Page city={VANCOUVER_1} variant={4} />;
}
