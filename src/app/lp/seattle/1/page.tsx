import type { Metadata } from "next";
import City1Page, { city1Metadata } from "@/app/lp/_city1/city1-page";
import { SEATTLE_1 } from "@/app/lp/_city1/city1-city";

/**
 * `/lp/seattle/1` -- the city-first variant, on Puget Sound.
 *
 * The page itself is @/app/lp/_city1/city1-page.tsx; everything that changes
 * with the city is the fields of SEATTLE_1. See /lp/vancouver/1 for the
 * other city running this shape, and ../2 and ../3 for the blend that puts
 * this page's hero over /lp/7's live instrument.
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
  return city1Metadata(SEATTLE_1, searchParams);
}

export default function LpSeattle1() {
  return <City1Page city={SEATTLE_1} />;
}
