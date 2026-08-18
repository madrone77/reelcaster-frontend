import type { Metadata } from 'next';
import { enterLp, type LpSearchParams } from '../lp-entry';

// Paid traffic only, and this URL is a doorway rather than a destination.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `/lp/3?city=...` — the shape ad links are generated in. Redirects to the
 * ISR-cached `/lp/3/[city]` page, carrying the attribution query with it.
 * See ../lp-entry.ts for why this is a redirect and not a render.
 */
export default async function LpVariant3Entry({
  searchParams,
}: {
  searchParams: Promise<LpSearchParams>;
}) {
  enterLp('3', await searchParams);
}
