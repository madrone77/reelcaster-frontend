import type { Metadata } from "next";
import City1Page, { city1Metadata } from "@/app/lp/_city1/city1-page";
import { FRIDAY_HARBOR_1 } from "@/app/lp/_city1/city1-city";

/**
 * `/lp/friday-harbor/1` -- the city-first page in the San Juans.
 *
 * The second American city to run this shape, and the first that is not
 * Seattle. It is NOT /lp/6: that variant flies a US flag in its header and
 * hard-redirects any Canadian city away, which is a market decision baked into
 * the chrome. This page has no flag and no market. It renders WDFW, "MARINE
 * AREA" and NOAA because its spots are in Washington, and the same file
 * renders DFO, "DFO PFMA" and CHS on /lp/victoria/1 because Victoria's are
 * not.
 *
 * Four stops rather than six or eight, which is the roster's doing: at the
 * zoom the seabed reads at, the San Juans spread their scored marks across
 * more water than one affordable sheet holds. The marks band lower down the
 * page still lists all twenty.
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
  return city1Metadata(FRIDAY_HARBOR_1, searchParams);
}

export default function LpFridayHarbor1() {
  return <City1Page city={FRIDAY_HARBOR_1} />;
}
