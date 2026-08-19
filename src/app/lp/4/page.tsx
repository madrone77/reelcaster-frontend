import type { Metadata } from 'next';
import { enterLp, type LpSearchParams } from '../lp-entry';

// Paid traffic only, and this URL is a doorway rather than a destination.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `/lp/4?city=...&species=...` — the shape ad links are generated in.
 * Redirects to `/lp/4/[city]`, carrying the attribution query with it, and the
 * species with it: this variant is the one that reads `?species=`.
 * See ../lp-entry.ts for why this is a redirect and not a render.
 */
export default async function LpVariant4Entry({
  searchParams,
}: {
  searchParams: Promise<LpSearchParams>;
}) {
  enterLp('4', await searchParams);
}
