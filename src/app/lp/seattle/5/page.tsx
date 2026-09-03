import type { Metadata } from "next";
import City1Page, { city1Metadata } from "@/app/lp/_city1/city1-page";
import { SEATTLE_1 } from "@/app/lp/_city1/city1-city";

/**
 * `/lp/seattle/5` -- every screen the family has, on one page.
 *
 * /4 with the second picture rendered and the day chart kept. /1 shows a
 * photograph of a spot page with the three arrows pasted on; /4 replaced it
 * with the day chart, live; /5 puts the photograph's own subject there, live
 * -- today's real species cards, score, window and regulations at the mark
 * named in SEATTLE_1.pictureMark, drawn from the product's components with
 * the callouts measured onto it -- and moves the day chart to a fourth band
 * under the alert text. Same shell, same copy, same explore-only CTA, same
 * ranking as /4. What the reader meets, in order: the map, the spot, the
 * text, and the day.
 *
 * Counts under `lpseattle5` (city1-city.ts). See ../4 for the arm it is
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
  return city1Metadata(SEATTLE_1, searchParams);
}

export default function LpSeattle5() {
  return <City1Page city={SEATTLE_1} variant={5} />;
}
