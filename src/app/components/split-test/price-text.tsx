'use client';

/**
 * The price, as a span, for server components that render on a cached page.
 *
 * The marketing home and the city hub are statically rendered: one HTML
 * document serves everybody, so the server cannot know which arm of a price
 * test a particular reader is in. Rather than make those pages dynamic — which
 * would slow every visitor down so that some of them avoid a flicker — the
 * number itself becomes a client island that corrects itself once
 * /api/split-tests answers.
 *
 * With no price test running, which is the normal state and the state this
 * ships in, the fetched answer equals the server-rendered one and nothing on
 * screen ever changes.
 *
 * Use the props where the surface knows its reader's region, so a Washington
 * page quotes USD in the first paint instead of correcting itself twice.
 */

import { usePricing } from './use-pricing';

/** The yearly amount: "$33", or "$45" for a reader in that arm. */
export function PriceAmount({ region }: { region?: string }) {
  return <>{usePricing(region).amount}</>;
}

/** The same price expressed monthly: "$2.75". */
export function PricePerMonth({ region }: { region?: string }) {
  return <>{usePricing(region).perMonth}</>;
}
