import type { Metadata } from "next";
import City1Page, { city1Metadata } from "@/app/lp/_city1/city1-page";
import { NANAIMO_1 } from "@/app/lp/_city1/city1-city";

/**
 * `/lp/nanaimo/1` -- the city-first page on the Strait of Georgia.
 *
 * Six stops down the run an angler out of Nanaimo actually works: Neck Point,
 * Hudson Rocks, Five Finger Island, Snake Island Reef, Entrance Island and the
 * Gabriola Bluffs, north to south, in that order.
 *
 * Same page as /lp/victoria/1 and /lp/vancouver/1, and the same slang: the
 * hero says Springs, because a Strait of Georgia angler does. Everything
 * jurisdictional resolves from the city's own spots.
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
  return city1Metadata(NANAIMO_1, searchParams);
}

export default function LpNanaimo1() {
  return <City1Page city={NANAIMO_1} />;
}
