import type { Metadata } from "next";
import { angleFrom } from "../_shared/lp-angles";
import LpShell from "../_shared/lp-shell";
import Lp3Hero from "./hero";

/**
 * /lp/3 — /lp/2 with a photo hero.
 *
 * This is a one-variable test against /lp/2: identical copy angles, identical
 * CTA, identical body, identical price and trial terms. The only difference is
 * that the headline sits over a full-bleed photograph instead of over white,
 * with the score card pulled up across the seam.
 *
 * Because everything except the hero is the same shared component, a copy edit
 * lands on both pages at once and the pair cannot drift apart mid-flight —
 * which is the usual reason a landing-page A/B ends up unreadable.
 *
 * ⚠️ The photos are stock coastline, not fishing photography. See the note in
 * heroes.ts before spending on this variant: the hero is the whole point of the
 * test, and shoreline scenery is probably not the image that wins it.
 *
 * noindex comes from src/app/lp/layout.tsx.
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

export default async function Lp3Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const angle = angleFrom(await searchParams);

  // lp3- rather than lp2-, so the hero variant is distinguishable from the
  // angle in the attribution columns.
  const checkoutHref = `/plans/checkout?from=lp3-${angle.id}`;

  return (
    <LpShell
      angle={angle}
      checkoutHref={checkoutHref}
      year={new Date().getFullYear()}
      hero={<Lp3Hero angle={angle} />}
    />
  );
}
