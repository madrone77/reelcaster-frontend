import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchSpotLivePage } from "@/lib/bluecaster";
import SpotDetailShell from "./spot-detail-shell";

const SITE_URL = "https://reelcaster.com";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchSpotLivePage(slug).catch(() => null);
  if (!page) return { title: "Spot | ReelCaster" };

  const name = page.spot.name;
  const where = [page.spot.city, page.spot.region].filter(Boolean).join(", ");
  const title = `${name}${where ? ` · ${where}` : ""} | ReelCaster`;
  const description =
    page.spot.seoIntro ??
    `Live fishing forecast, conditions, and 14-day outlook for ${name}.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/explore/spot/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/explore/spot/${slug}`,
      siteName: "ReelCaster",
      type: "article",
      locale: "en_CA",
    },
    robots: { index: true, follow: true },
  };
}

export default async function SpotDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchSpotLivePage(slug);
  if (!page) notFound();

  return <SpotDetailShell page={page} slug={slug} />;
}
