import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { angleFrom } from "../../_shared/lp-angles";
import { resolveLpCity } from "../../_shared/lp-city";
import LpShell from "../../_shared/lp-shell";
import Lp2Hero from "./hero";

/**
 * /lp/2/[city] — Meta cold-traffic landing page, card-first funnel, copy hero.
 *
 * Sibling to /lp/1/[city], and deliberately a different bet: /lp/1 sends cold
 * traffic to a free account with no card, this one sells the 7-day
 * card-required trial straight off the ad. Run them against each other rather
 * than replacing one with the other — they buy different things. /lp/1 buys
 * registrations at a high rate; this buys a much smaller number of people who
 * have already agreed to be charged.
 *
 * /lp/3/[city] is this page with a photo hero. Everything below the hero is
 * literally the same component, so the two can be run head to head.
 *
 * The `?a=` / `utm_content=` angle swaps headline, subhead, eyebrow, feature
 * order and the closing line — see ../../_shared/lp-angles.ts.
 *
 * Score-card numbers are static and are labelled EXAMPLE SPOT for that reason;
 * see the note at the top of ../../_shared/lp-content.ts. The city is real,
 * which is why an unknown one 404s instead of quietly rendering Victoria.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

// Declared to match /lp/1/[city], but be aware it is currently inert: reading
// `searchParams` for the angle opts the route out of static rendering, so this
// builds as ƒ (dynamic) with no revalidate window. /lp/1/[city] lands in the
// same bucket despite its own declaration, so the two are consistent.
//
// That is a smaller problem here than lp-entry.ts's warning implies. The only
// upstream call this page makes is fetchHierarchyLight(), which carries its own
// `next: { revalidate: 3600 }` and is served from the Data Cache — so a dynamic
// render costs a React pass, not the four uncached round trips that argument is
// about. Moving the angle into the path would buy real ISR, at the cost of the
// one-template-per-variant ad-link shape the doorway exists to provide.
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
  const angle = angleFrom(sp);
  const city = await resolveLpCity(slug);
  return {
    title: { absolute: `${angle.title} — ReelCaster` },
    description: city ? `${angle.subhead} Covering ${city.name}.` : angle.subhead,
    robots: { index: false, follow: true },
  };
}

export default async function Lp2CityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ city: slug }, sp] = await Promise.all([params, searchParams]);
  const angle = angleFrom(sp);

  // Unknown, unpublished, or spotless city → 404. Falling back to the pilot
  // city would spend another city's ad budget on a Victoria page and make the
  // campaign read as a success.
  const city = await resolveLpCity(slug);
  if (!city) notFound();

  // `from` is what /plans/checkout records for attribution. It carries the page
  // variant as well as the angle, so "photo hero or copy hero" and "which
  // pitch" are both answerable from the attr_* columns.
  const checkoutHref = `/plans/checkout?from=lp2-${angle.id}`;

  return (
    <LpShell
      angle={angle}
      checkoutHref={checkoutHref}
      year={new Date().getFullYear()}
      hero={<Lp2Hero angle={angle} cityName={city.name} />}
    />
  );
}
