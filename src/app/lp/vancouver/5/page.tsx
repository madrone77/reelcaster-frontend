import type { Metadata } from "next";
import City1Page, { city1Metadata } from "@/app/lp/_city1/city1-page";
import { VANCOUVER_1 } from "@/app/lp/_city1/city1-city";

/**
 * `/lp/vancouver/5` -- /lp/vancouver/4 with the second picture rendered.
 *
 * ONE variable against /4, and it is the WHERE / WHAT / WHEN slot. /1 shows a
 * photograph of a spot page with the three arrows pasted on; /4 replaced it
 * with the day chart, live; /5 puts the photograph's own subject there, live
 * -- today's real species cards, score, window and regulations at the mark
 * named in VANCOUVER_1.pictureMark, drawn from the product's components with
 * the callouts measured onto it. Everything else is /4: same shell, same copy,
 * same explore-only CTA, same ranking, and the alert band underneath.
 *
 * Counts under `lpvancouver5` (city1-city.ts). See ../4 for the arm it is
 * measured against and ../1 for the still both of them replace.
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

export default function LpVancouver5() {
  return <City1Page city={VANCOUVER_1} variant={5} />;
}
