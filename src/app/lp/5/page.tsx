import type { Metadata } from 'next';
import { enterLp, type LpSearchParams } from '../lp-entry';

// Paid traffic only, and this URL is a doorway rather than a destination.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `/lp/5?city=...` — the shape ad links are generated in. Redirects to the
 * ISR-cached `/lp/5/[city]` page, carrying the attribution query with it.
 * See ../lp-entry.ts for why this is a redirect and not a render.
 */
export default async function LpVariant5Entry({
  searchParams,
}: {
  searchParams: Promise<LpSearchParams>;
}) {
  enterLp('5', await searchParams);
}
