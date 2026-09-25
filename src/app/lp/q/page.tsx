import type { Metadata } from "next";
import { enterLp, type LpSearchParams } from "../lp-entry";

// Paid traffic only, and this URL is a doorway rather than a destination.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * `/lp/q?city=...` -- the link-builder shape. Redirects to `/lp/q/[city]`
 * with the attribution query carried along. See ../lp-entry.ts.
 */
export default async function LpQuizEntry({
  searchParams,
}: {
  searchParams: Promise<LpSearchParams>;
}) {
  enterLp("q", await searchParams);
}
