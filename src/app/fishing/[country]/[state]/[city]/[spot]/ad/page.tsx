import type { Metadata } from "next";
import { fetchSpotLivePage } from "@/lib/bluecaster";
import { siteUrl } from "@/lib/site";
import { trialChargeDate } from "@/app/lp/_shared/lp-checkout";
import { PRICE } from "@/app/lp/_shared/lp-content";
import { ANGLES } from "@/app/lp/_shared/lp-angles";
import SpotDetailShell from "../spot-detail-shell";
import { loadSpotPage } from "../load-spot-page";
import { parseWall } from "@/lib/ad-mode";
import { spotPath } from "@/lib/paths";

/**
 * The ad frame of a spot page.
 *
 * Not linked from anywhere and not meant to be typed. The URL that goes in an
 * ad is the product's own `/explore/spot/<slug>?ad=<wall>`, which
 * src/middleware.ts rewrites here. Two reasons it is a separate segment rather
 * than a branch inside the public page:
 *
 * 1. Reading `searchParams` in the public page would opt that route out of
 *    static generation. Its own comments explain what the prerender buys:
 *    <title> and the canonical resolved before the first byte instead of
 *    streamed into the body. One ad parameter would cost every organic visit
 *    that, to serve a variant almost nobody sees.
 * 2. This render must never be indexed. The content is the public page's, so
 *    an indexable copy at a second URL is a duplicate competing with the page
 *    it was copied from.
 */

type PageProps = {
  params: Promise<{ country: string; state: string; city: string; spot: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { country, state, city, spot: slug } = await params;
  const page = await fetchSpotLivePage(slug).catch(() => null);
  const name = page?.spot.name ?? "This spot";

  return {
    title: `${name} Fishing Forecast`,
    // noindex, and a canonical pointing at the page this one is a frame of.
    // The robots directive is what actually keeps it out of the index; the
    // canonical is what stops any link that leaks into the wild from splitting
    // the public page's signals.
    robots: { index: false, follow: false },
    // The public page this frame wraps, in the new shape. Pointing it at the
    // retired URL would aim the canonical at a redirect, which is a hint a
    // crawler has to resolve before it can honour it.
    alternates: {
      canonical: siteUrl(
        spotPath(
          { countryCode: country, stateCode: state, cityUrlSlug: city },
          slug,
        ),
      ),
    },
  };
}

export default async function SpotAdPage({ params, searchParams }: PageProps) {
  const { spot: slug } = await params;
  const sp = await searchParams;
  const { page, freshTracked, cityLink, tz, serverNowMs } =
    await loadSpotPage(slug);

  const wall = parseWall(first(sp.ad));

  // The pitch, shared with the /lp variants so the two kinds of ad can be
  // compared on one axis. An unknown value counts as no angle rather than
  // inventing one, matching how the campaign counter validates it.
  const angleRaw = first(sp.a).trim().toLowerCase();
  const angle = ANGLES.some((a) => a.id === angleRaw) ? angleRaw : "";

  return (
    <SpotDetailShell
      page={page}
      freshTracked={freshTracked}
      slug={slug}
      tz={tz}
      serverNowMs={serverNowMs}
      cityLink={cityLink}
      ad={{ wall, angle, chargeDate: trialChargeDate(PRICE.trialDays) }}
    />
  );
}
