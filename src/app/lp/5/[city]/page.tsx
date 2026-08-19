import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { angleFrom } from "../../_shared/lp-angles";
import { resolveLpCard } from "../../_shared/lp-spot";
import LpShell from "../../_shared/lp-shell";
import LpPhotoHero from "../../_shared/lp-photo-hero";

/**
 * /lp/5/[city] — /lp/3 with the instrument treatment.
 *
 * A one-variable test against /lp/3: same photo hero, same angles, same score
 * card, same price and trial terms, same city resolution. The only thing that
 * moves is how the body is dressed, which is what `treatment="instrument"`
 * selects in lp-shell.
 *
 * The pitch it is testing is that experienced Salish Sea and Puget Sound
 * boaters read a generic feature list as a beginner's app. They already own
 * plotters and sounders and already read tide, current and pressure by hand,
 * so the thing that earns their attention is naming the signals out loud:
 * current slack rather than "tides", pressure trend, moon phase, and the
 * rigger depth saved against a logged fish. The glyphs follow the same idea,
 * drawn as instrument faces rather than as a bell and a calendar.
 *
 * Everything it claims is a real column (ConditionsV1, migration 093).
 * Deliberately absent, having been checked rather than assumed: offline
 * caching, which does not exist in this app, and HRRR, which is not a model we
 * run. A landing page for this audience survives exactly one false claim.
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
    title: { absolute: `${angle.title} — ReelCaster` },
    description: card ? `${angle.subhead} Covering ${card.cityName}.` : angle.subhead,
    robots: { index: false, follow: true },
  };
}

export default async function Lp5CityPage({
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

  // lp5- so the treatment is distinguishable from both the hero variant and
  // the angle in the attribution columns.
  const checkoutHref = `/plans/checkout?from=lp5-${angle.id}`;

  return (
    <LpShell
      angle={angle}
      checkoutHref={checkoutHref}
      year={new Date().getFullYear()}
      card={card}
      treatment="instrument"
      hero={<LpPhotoHero angle={angle} card={card} />}
    />
  );
}
