import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { fetchCityGuides, fetchHierarchy } from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { breadcrumbJsonLd, DEFAULT_OG, siteUrl } from "@/lib/site";
import { getFishingProvince, locationOf } from "@/app/fishing/lib/fishing-data";
import { guidePath } from "@/lib/paths";
import { activityPhrase } from "@/app/fishing/lib/activity";

// Hierarchy is cached 1h upstream (bcGet revalidate) — match it here so the
// page regenerates on the same cadence.
export const revalidate = 3600;

// Prerender every covered state at build time. Without this the route is
// rendered on demand, and Next STREAMS metadata for on-demand renders — the
// <title> and <link rel="canonical"> land at the end of the body instead of in
// <head>. Prerendering resolves metadata ahead of the response, so the head is
// complete in the first byte.
//
// The country has to come from the tree rather than a hardcoded map, because
// the pair is what the route matches on: /fishing/us/bc must 404, not render
// British Columbia under an American flag.
export async function generateStaticParams() {
  const hierarchy = await fetchHierarchy();
  const params: Array<{ country: string; state: string }> = [];
  for (const country of hierarchy?.countries ?? []) {
    for (const code of COVERED_PROVINCES) {
      const province = getFishingProvince(hierarchy, country.code, code);
      if (!province || province.cities.length === 0) continue;
      params.push({
        country: country.code.toLowerCase(),
        state: code.toLowerCase(),
      });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; state: string }>;
}): Promise<Metadata> {
  const { country: countryParam, state: stateParam } = await params;
  const province = getFishingProvince(
    await fetchHierarchy(),
    countryParam,
    stateParam,
  );
  // 404 here, not just in the page — metadata resolves before the body
  // streams, so bailing late would send a 200 with 404 UI (soft-404).
  if (!province || province.cities.length === 0) notFound();

  const spotCount = province.cities.reduce((n, c) => n + c.spots.length, 0);
  // Place first and no "with Live Scores" tail, matching the city pages —
  // "British Columbia Fishing — 76 Spots" fits the ~60-char render budget.
  const title = `${province.name} Fishing: ${spotCount} Spots`;
  const description = `Browse ${spotCount} saltwater fishing spots across ${province.cities
    .map((c) => c.name)
    .join(", ")} with live RC scores, conditions, and 14-day forecasts.`;
  const canonical = siteUrl(province.path);
  return {
    // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | ReelCaster`,
      description,
      url: canonical,
      type: "website",
      ...DEFAULT_OG,
    },
    robots: { index: true, follow: true },
  };
}

export default async function ProvincePage({
  params,
}: {
  params: Promise<{ country: string; state: string }>;
}) {
  const { country: countryParam, state: stateParam } = await params;
  const province = getFishingProvince(
    await fetchHierarchy(),
    countryParam,
    stateParam,
  );
  if (!province || province.cities.length === 0) notFound();

  const provPath = province.path;
  const spotCount = province.cities.reduce((n, c) => n + c.spots.length, 0);

  // Published species guides per city. One cached read each, on the same
  // hourly cadence as the hierarchy behind this page. A city with no guides
  // renders exactly as it did before.
  const guidesByCity = new Map(
    await Promise.all(
      province.cities.map(async (city) => {
        const res = await fetchCityGuides(city.slug);
        return [city.slug, res?.guides ?? []] as const;
      }),
    ),
  );
  const guideCount = [...guidesByCity.values()].reduce((n, g) => n + g.length, 0);

  // Mirrors the visible breadcrumb below.
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: `Fishing in ${province.name}`, path: provPath },
  ]);

  // The city roster as an ItemList, in the order it renders.
  const cityList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Fishing cities in ${province.name}`,
    numberOfItems: province.cities.length,
    itemListElement: province.cities.map((city, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${city.name}, ${city.provinceCode}`,
      url: siteUrl(city.path),
    })),
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityList) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="font-rc-mono text-[11px] text-rc-ink-mute">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-rc-ink transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-rc-ink-soft" aria-current="page">
            Fishing in {province.name}
          </li>
        </ol>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-bold text-rc-ink mt-3">
        Fishing in {province.name}
      </h1>
      <p className="text-rc-ink-soft mt-2 max-w-2xl">
        {spotCount} saltwater fishing spots across {province.cities.length}{" "}
        {province.cities.length === 1 ? "city" : "cities"}, each with live RC
        scores, wind, sea, and tide conditions, and a 14-day outlook
        {guideCount > 0 ? (
          <>
            , plus {guideCount} species guides covering the tactics, bait and
            tides that work locally
          </>
        ) : null}
        .
      </p>

      <div className="mt-8 space-y-10">
        {province.cities.map((city) => (
          <section key={city.slug} aria-labelledby={`city-${city.slug}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rc-rule pb-2">
              <h2 id={`city-${city.slug}`} className="text-xl font-semibold">
                <Link
                  href={city.path}
                  className="text-rc-ink hover:text-rc-brand transition-colors"
                >
                  {city.name}, {city.provinceCode}
                </Link>
              </h2>
              <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                {city.spots.length} spot{city.spots.length === 1 ? "" : "s"} ·{" "}
                {city.regionName}
              </span>
              <Link
                href={city.path}
                className="ml-auto font-rc-mono text-[11px] font-semibold tracking-[0.08em] text-rc-brand hover:underline"
              >
                VIEW CITY MAP →
              </Link>
            </div>

            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
              {city.spots.map((spot) => (
                <li key={spot.id}>
                  <Link
                    href={spot.path}
                    className="group flex items-baseline gap-2 py-1"
                  >
                    <MapPin
                      className="w-3.5 h-3.5 self-center shrink-0 text-rc-ink-mute group-hover:text-rc-brand transition-colors"
                      aria-hidden
                    />
                    <span className="text-[15px] font-medium text-rc-ink group-hover:text-rc-brand transition-colors truncate">
                      {spot.name}
                    </span>
                    <span className="font-rc-mono text-[11px] text-rc-ink-mute shrink-0">
                      {city.name}, {city.provinceCode}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {(guidesByCity.get(city.slug) ?? []).length > 0 && (
              <nav
                aria-label={`${city.name} species guides`}
                className="mt-4 pt-3 border-t border-rc-rule-soft"
              >
                <span className="rc-label text-[9px] text-rc-ink-mute">
                  Guides
                </span>
                <ul className="inline-flex flex-wrap gap-x-2 gap-y-1.5 ml-2 align-middle">
                  {(guidesByCity.get(city.slug) ?? []).map((g) => (
                    <li key={g.species_slug}>
                      <Link
                        href={guidePath(locationOf(city), g.species_slug)}
                        className="text-[13px] text-rc-ink-soft hover:text-rc-brand transition-colors"
                      >
                        {city.name} {activityPhrase(g.activity)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-rc-ink-soft">
        Looking for the full interactive map?{" "}
        <Link href="/explore" className="text-rc-brand font-medium hover:underline">
          Open Explore
        </Link>
        .
      </p>
    </div>
  );
}
