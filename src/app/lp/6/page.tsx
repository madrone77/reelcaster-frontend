import type { Metadata } from 'next';
import { enterLp, DEFAULT_US_LP_CITY, type LpSearchParams } from '../lp-entry';

// Paid traffic only, and this URL is a doorway rather than a destination.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `/lp/6?city=...` — the shape ad links are generated in. Redirects to the
 * ISR-cached `/lp/6/[city]` page, carrying the attribution query with it.
 *
 * Falls back to Seattle rather than the pilot city: this variant is the
 * American one, and an untagged link should not open on Canadian water.
 * See ../lp-entry.ts for why this is a redirect and not a render.
 */
export default async function LpVariant6Entry({
  searchParams,
}: {
  searchParams: Promise<LpSearchParams>;
}) {
  enterLp('6', await searchParams, DEFAULT_US_LP_CITY);
}
