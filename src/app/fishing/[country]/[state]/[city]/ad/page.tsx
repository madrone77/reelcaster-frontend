import type { Metadata } from "next";
import CityLanding, { cityLandingMetadata } from "./city-landing";

/**
 * `/fishing/<country>/<state>/<city>?ad=<wall>`, rewritten here by
 * src/middleware.ts: the framed city page, which is the paid landing page.
 * See ./city-landing.tsx.
 */

type PageProps = {
  params: Promise<{ country: string; state: string; city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { country, state, city: cityUrlSlug } = await params;
  return cityLandingMetadata({
    city: { country, state, cityUrlSlug },
    searchParams: await searchParams,
  });
}

export default async function CityAdPage({ params, searchParams }: PageProps) {
  const { country, state, city: cityUrlSlug } = await params;
  return <CityLanding city={{ country, state, cityUrlSlug }} searchParams={await searchParams} />;
}
