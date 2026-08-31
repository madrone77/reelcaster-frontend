import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchSpotLivePage } from "@/lib/bluecaster";
import { siteUrl } from "@/lib/site";
import { readShareCard } from "@/lib/share-cards-server";
import { shareDescription, shareTitle } from "@/lib/share-cards";
import SpotDetailShell from "@/app/explore/spot/[slug]/spot-detail-shell";
import { loadSpotPage } from "@/app/explore/spot/[slug]/load-spot-page";
import SharedCardDialog from "./shared-card-dialog";
import OrphanShareView from "./orphan-share-view";

type PageProps = { params: Promise<{ token: string }> };

/**
 * The receiving end of a share.
 *
 * This is a REAL page, not a redirect to the spot. It has to serve its own
 * metadata and its own opengraph-image, which is the entire reason the token
 * exists: unfurlers cache one scrape per URL forever, so a dated card can only
 * live at a URL that is never reused.
 *
 * Its body, though, is the LIVE spot page, with the frozen card over the top as
 * a modal. Dismissing the card is therefore the click-through — the recipient
 * never has to make a second decision, and lands in the product rather than on
 * a leaflet about it.
 */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const card = await readShareCard(token).catch(() => null);
  if (!card) notFound();

  return {
    title: shareTitle(card),
    description: shareDescription(card),
    openGraph: {
      title: shareTitle(card),
      description: shareDescription(card),
      siteName: "ReelCaster",
      url: siteUrl(`/s/${token}`),
      type: "website",
      // No `images` on purpose: this route has its own opengraph-image.tsx, and
      // an explicit entry here would beat the file convention and pin every
      // share back to the site-wide card.
    },
    // A share link is addressed to one person and names a day that expires.
    // It has no business in an index, and the canonical spot page is the URL
    // that should rank.
    alternates: { canonical: siteUrl(`/explore/spot/${card.spotSlug}`) },
    robots: { index: false, follow: false },
  };
}

export default async function SharedCardPage({ params }: PageProps) {
  const { token } = await params;
  const card = await readShareCard(token).catch(() => null);
  if (!card) notFound();

  // A card outlives its spot: an unpublished or deleted spot, or a private
  // custom one, cannot be read by this anonymous render. The card is still
  // valid content someone was sent, so it gets its own standalone page rather
  // than a 404 in the face of a person who did nothing wrong.
  const live = await fetchSpotLivePage(card.spotSlug).catch(() => null);
  if (!live) return <OrphanShareView card={card} />;

  const { page, freshTracked, cityLink, tz, serverNowMs } = await loadSpotPage(
    card.spotSlug,
  );

  return (
    <>
      <SpotDetailShell
        page={page}
        freshTracked={freshTracked}
        slug={card.spotSlug}
        tz={tz}
        serverNowMs={serverNowMs}
        cityLink={cityLink}
      />
      <SharedCardDialog card={card} />
    </>
  );
}
