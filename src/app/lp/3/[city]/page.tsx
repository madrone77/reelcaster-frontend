import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { angleFrom } from "../../_shared/lp-angles";
import { resolveLpCard } from "../../_shared/lp-spot";
import LpShell from "../../_shared/lp-shell";
import { lpCheckoutHref } from "../../_shared/lp-checkout";
import LpPhotoHero from "../../_shared/lp-photo-hero";

/**
 * /lp/3/[city] — /lp/2/[city] with a photo hero.
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
 * ⚠️ The photo is stock, not fishing photography we own. See the note in
 * heroes.ts before spending on this variant: the hero is the whole point of the
 * test, and stock is probably not the image that wins it.
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
  const angle = angleFrom(sp);
  const card = await resolveLpCard(slug);
  return {
    title: { absolute: `${angle.title} | ReelCaster` },
    description: card ? `${angle.subhead} Covering ${card.cityName}.` : angle.subhead,
    robots: { index: false, follow: true },
  };
}

export default async function Lp3CityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ city: slug }, sp] = await Promise.all([params, searchParams]);
  const angle = angleFrom(sp);

  const card = await resolveLpCard(slug);
  if (!card) notFound();

  // lp3- rather than lp2-, so the hero variant is distinguishable from the
  // angle in the attribution columns.
  const checkoutHref = lpCheckoutHref("3", angle.id, card);

  return (
    <LpShell
      angle={angle}
      checkoutHref={checkoutHref}
      year={new Date().getFullYear()}
      card={card}
      hero={<LpPhotoHero angle={angle} card={card} />}
    />
  );
}
