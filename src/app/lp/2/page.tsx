import type { Metadata } from "next";
import { angleFrom } from "../_shared/lp-angles";
import LpShell from "../_shared/lp-shell";
import Lp2Hero from "./hero";

/**
 * /lp/2 — Meta cold-traffic landing page, card-first funnel, copy-led hero.
 *
 * Sibling to /lp/1/[city], and deliberately a different bet: /lp/1 sends cold
 * traffic to a free account with no card, this one sells the 7-day
 * card-required trial straight off the ad. Run them against each other rather
 * than replacing one with the other — they buy different things. /lp/1 buys
 * registrations at a high rate; this buys a much smaller number of people who
 * have already agreed to be charged.
 *
 * /lp/3 is this page with a photo hero instead of a copy hero. Everything below
 * the hero is literally the same component, so the two can be run head to head.
 *
 * noindex comes from src/app/lp/layout.tsx, which also supplies the chrome-free
 * shell. Paid traffic only — this page should never be a search result.
 *
 * Angle selection lives in ../_shared/lp-angles.ts; the page reads `?a=` (or
 * `utm_content=`) and swaps headline, subhead, eyebrow, feature order, and the
 * closing line. Numbers on the page are static — read the note at the top of
 * ../_shared/lp-content.ts before pointing real spend at it.
 *
 * Rendering is per-request rather than static: the copy is query-driven, and
 * `force-static` hands the page an empty searchParams, which would silently
 * serve the control angle to every ad set and make the test look like a tie.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const angle = angleFrom(await searchParams);
  return {
    title: { absolute: `${angle.title} — ReelCaster` },
    description: angle.subhead,
    robots: { index: false, follow: true },
  };
}

export default async function Lp2Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const angle = angleFrom(await searchParams);

  // `from` is what /plans/checkout records for attribution. It carries the page
  // variant as well as the angle, so "photo hero or copy hero" and "which
  // pitch" are both answerable from the attr_* columns rather than inferred
  // from ad-platform numbers.
  const checkoutHref = `/plans/checkout?from=lp2-${angle.id}`;

  return (
    <LpShell
      angle={angle}
      checkoutHref={checkoutHref}
      year={new Date().getFullYear()}
      hero={<Lp2Hero angle={angle} />}
    />
  );
}
