import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { angleFrom, localizeAngle } from "../../_shared/lp-angles";
import { resolveLpCard } from "../../_shared/lp-spot";
import { lpRegionFor } from "../../_shared/lp-region";
import { DEFAULT_US_LP_CITY } from "../../lp-entry";
import LpShell from "../../_shared/lp-shell";
import LpPhotoHero from "../../_shared/lp-photo-hero";

/**
 * /lp/6/[city] — the American variant, aimed at Seattle and Puget Sound.
 *
 * /lp/5 with the market chrome made explicit: a US flag in the header chip,
 * WDFW and NOAA cited rather than DFO, gallons rather than litres, the
 * coverage answer opening with Washington, and the local-knowledge pitch
 * saying Puget Sound instead of naming another country's coast. Against /lp/5
 * it isolates exactly one thing, which is whether saying "this is your water,
 * in your units, under your agency" out loud is worth anything on cold Meta
 * traffic out of Seattle.
 *
 * Almost all of that already falls out of the shared region resolution, since
 * these pages have carried the spot's province since the jurisdiction fix. The
 * genuinely new parts are the flag, the Seattle default, and the guard below.
 *
 * The guard matters. Every other variant serves both sides of the border from
 * one URL and stays deliberately neutral about it; this one flies a flag. A
 * mistyped or recycled ad link carrying `?city=victoria-bc` would otherwise
 * put the Stars and Stripes over Canadian water with DFO regulations printed
 * underneath, which is worse than any 404. Non-US cities are sent to Seattle
 * rather than 404'd, because the click is already paid for.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

// Inert for the same reason as /lp/2/[city] — see the note there.
export const revalidate = 900;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ city: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const [{ city: slug }, sp] = await Promise.all([params, searchParams]);
  const card = await resolveLpCard(slug);
  const angle = localizeAngle(angleFrom(sp), lpRegionFor(card?.provinceCode));
  return {
    title: { absolute: `${angle.title} — ReelCaster` },
    description: card ? `${angle.subhead} Covering ${card.cityName}.` : angle.subhead,
    robots: { index: false, follow: true },
  };
}

export default async function Lp6CityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ city: slug }, sp] = await Promise.all([params, searchParams]);

  const card = await resolveLpCard(slug);
  if (!card) notFound();

  const region = lpRegionFor(card.provinceCode);
  // American chrome over Canadian water is the one outcome this page must
  // never produce. Send it to Seattle instead of rendering a contradiction.
  if (!region.isUS && slug !== DEFAULT_US_LP_CITY) {
    redirect(`/lp/6/${DEFAULT_US_LP_CITY}`);
  }

  const angle = localizeAngle(angleFrom(sp), region);

  // lp6- so the American variant is distinguishable from /lp/5 in the
  // attribution columns, since the two are otherwise the same treatment.
  const checkoutHref = `/plans/checkout?from=lp6-${angle.id}`;

  return (
    <LpShell
      angle={angle}
      checkoutHref={checkoutHref}
      year={new Date().getFullYear()}
      card={card}
      treatment="instrument"
      showFlag
      hero={<LpPhotoHero angle={angle} card={card} />}
    />
  );
}
