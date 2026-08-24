import type { Metadata } from "next";
import { enterLp, type LpSearchParams } from "../lp-entry";

// Paid traffic only, and this URL is a doorway rather than a destination.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `/lp/8?city=...` — the shape ad links are generated in. Redirects to the
 * ISR-cached `/lp/8/[city]` page, carrying the attribution query with it.
 *
 * Falls back to the default pilot city rather than Seattle: unlike /lp/6, this
 * variant flies no flag and reads correctly on either side of the border, so
 * there is nothing here that an untagged Canadian link would render wrongly.
 * See ../lp-entry.ts for why this is a redirect and not a render.
 */
export default async function LpVariant8Entry({
  searchParams,
}: {
  searchParams: Promise<LpSearchParams>;
}) {
  enterLp("8", await searchParams);
}
