import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import SpotDetailShell from "@/app/fishing/[country]/[state]/[city]/[spot]/spot-detail-shell";
import { loadSpotPage } from "@/app/fishing/[country]/[state]/[city]/[spot]/load-spot-page";

type PageProps = { params: Promise<{ slug: string }> };

/**
 * The retired one-segment spot URL.
 *
 * It cannot be a blanket redirect, and it cannot be deleted:
 *
 * - A spot with a published home city 308s to
 *   /fishing/<country>/<state>/<city>/<spot>. These URLs are in score alert
 *   and weekend digest emails that have already been sent, so the hop has to
 *   keep working indefinitely; mail does not get rewritten.
 * - A spot with NO published home has no address in the new shape at all.
 *   Private custom spots are the main case, plus spots in cities that are
 *   still building. Those keep rendering here, which is why this file holds a
 *   real page rather than a redirect stub.
 *
 * ⚠️ `force-dynamic` is load-bearing. Under `force-static` Next bakes
 * permanentRedirect() into the prerendered RSC payload: a browser follows it
 * on hydration, but curl and every crawler get a 200 and a 40KB app shell.
 * That exact failure shipped once already on the retired notification stubs,
 * and the test that was supposed to catch it asserted on page.waitForURL,
 * which a client-side redirect satisfies. Verify this route with `curl -sI`
 * and assert on the status line, never in a browser.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // Only spots with no public home ever render here; everything else has left
  // via a 308 before this matters. A page with no canonical address of its own
  // should not be competing for one, and it becomes indexable the moment its
  // city publishes and it gets a real /fishing URL.
  return { robots: { index: false, follow: true } };
}

export default async function LegacySpotPage({ params }: PageProps) {
  const { slug } = await params;

  // notFound() inside for an unreadable slug, which renders this segment's
  // not-found.tsx and lets an owner recover a private spot client-side.
  const { page, freshTracked, cityLink, canonicalPath, tz, serverNowMs } =
    await loadSpotPage(slug);

  if (canonicalPath) permanentRedirect(canonicalPath);

  // No JSON-LD and no breadcrumb here on purpose: both describe a page's place
  // in a public hierarchy, and a spot that reaches this line has none.
  return (
    <SpotDetailShell
      page={page}
      freshTracked={freshTracked}
      slug={slug}
      tz={tz}
      serverNowMs={serverNowMs}
      cityLink={cityLink}
    />
  );
}
