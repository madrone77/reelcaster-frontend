import type { Metadata } from "next";
import { enterLp, type LpSearchParams } from "../lp-entry";

// Paid traffic only, and this URL is a doorway rather than a destination.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `/lp/7?city=...` — the shape ad links are generated in. Redirects to the
 * ISR-cached `/lp/7/[city]`, carrying the attribution query with it.
 *
 * Takes the pilot city when a link carries no `?city=`, like every variant
 * except /lp/6. This one is not market-specific: it renders whatever city it
 * is given, on that city's own regulator, tide authority and units, because it
 * is the product's city page rather than a pitch written for one market.
 *
 * See ../lp-entry.ts for why this is a redirect and not a render.
 */
export default async function LpVariant7Entry({
  searchParams,
}: {
  searchParams: Promise<LpSearchParams>;
}) {
  enterLp("7", await searchParams);
}
