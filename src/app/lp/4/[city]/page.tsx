import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { angleFrom } from "../../_shared/lp-angles";
import { resolveLpCard } from "../../_shared/lp-spot";
import { targetAngle, targetedLocality, type LpTargeting } from "../../_shared/lp-target";
import LpCopyHero from "../../_shared/lp-copy-hero";
import LpShell from "../../_shared/lp-shell";

/**
 * /lp/4/[city] — the species-targeted landing page.
 *
 * /lp/2 is this page's control: same copy hero, same body, same trial terms.
 * The one variable is that this page is told which species the ad was bought
 * for, and says so. The headline, the eyebrow, the line under the subhead and
 * the score card all name the same fish, and the card's number, bars and best
 * window are that species' own, read from the strip the payload already
 * carries.
 *
 * Targeting is best-effort by design. `?species=` that does not resolve, or
 * resolves to something this city has no scored water for, drops the page back
 * to the untargeted copy rather than 404ing or inventing a card. The click is
 * already paid for at that point, and a generic page still sells the product.
 * See _shared/lp-species.ts for the matching rules and _shared/lp-target.ts
 * for the copy.
 *
 * A city with no scored spot at all still 404s, exactly as /lp/2 does: that is
 * a link pointing somewhere the product does not cover, which is a different
 * mistake and worth failing loudly.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

// Inert for the same reason as /lp/2/[city] — reading searchParams for the
// angle opts the route out of static rendering. See the note there.
export const revalidate = 900;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ city: string }>;

/** The species param, and the card built from it, resolved once per render. */
async function resolve(slug: string, sp: Record<string, string | string[] | undefined>) {
  const card = await resolveLpCard(slug, { species: sp.species ?? null });
  const targeting: LpTargeting | null =
    card && card.targetedSpecies
      ? { species: card.targetedSpecies, city: card.cityName }
      : null;
  return { card, targeting };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const [{ city: slug }, sp] = await Promise.all([params, searchParams]);
  const { card, targeting } = await resolve(slug, sp);
  const angle = targetAngle(angleFrom(sp), targeting);
  return {
    title: { absolute: `${angle.title} — ReelCaster` },
    description: card ? `${angle.subhead} Covering ${card.cityName}.` : angle.subhead,
    robots: { index: false, follow: true },
  };
}

export default async function Lp4CityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ city: slug }, sp] = await Promise.all([params, searchParams]);
  const { card, targeting } = await resolve(slug, sp);
  if (!card) notFound();

  const angle = targetAngle(angleFrom(sp), targeting);

  // lp4- rather than lp2-, so a targeted click is distinguishable from an
  // untargeted one in the attribution columns without reading the URL back.
  const checkoutHref = `/plans/checkout?from=lp4-${angle.id}`;

  return (
    <LpShell
      angle={angle}
      checkoutHref={checkoutHref}
      year={new Date().getFullYear()}
      card={card}
      hero={
        <LpCopyHero
          angle={angle}
          card={card}
          locality={targeting ? targetedLocality(targeting) : undefined}
        />
      }
    />
  );
}
