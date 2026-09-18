import type { Metadata } from "next";
import Link from "next/link";
import { fetchHierarchy } from "@/lib/bluecaster";
import { breadcrumbJsonLd, DEFAULT_OG, siteUrl } from "@/lib/site";
import { getFishingCountries } from "@/app/fishing/lib/fishing-data";

// The directory's front door. /fishing/ca and /fishing/us have existed for
// months with nothing above them: the natural parent URL was a 404, which is
// what a visitor typing the path or trimming a breadcrumb got. This lists
// every country and region we cover, in the same shape as the pages below it.
export const revalidate = 3600;

const TITLE = "Saltwater Fishing Spots";
const DESCRIPTION =
  "Every coast ReelCaster forecasts: British Columbia, Washington, Oregon and California. Live scores, wind, sea and tide by the hour at every spot.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: siteUrl("/fishing") },
  openGraph: {
    title: `${TITLE} | ReelCaster`,
    description: DESCRIPTION,
    url: siteUrl("/fishing"),
    type: "website",
    ...DEFAULT_OG,
  },
  robots: { index: true, follow: true },
};

export default async function FishingIndexPage() {
  const countries = getFishingCountries(await fetchHierarchy());

  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Fishing", path: "/fishing" },
  ]);

  const spotCount = countries.reduce(
    (n, c) =>
      n +
      c.provinces.reduce(
        (m, p) => m + p.cities.reduce((k, city) => k + city.spots.length, 0),
        0,
      ),
    0,
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />

      <nav aria-label="Breadcrumb" className="font-rc-mono text-[11px] text-rc-ink-mute">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-rc-ink transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-rc-ink-soft" aria-current="page">
            Fishing
          </li>
        </ol>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-bold text-rc-ink mt-3">
        Where we forecast
      </h1>
      <p className="text-rc-ink-soft mt-2 max-w-2xl">
        {spotCount} saltwater fishing spots, each with live RC scores, wind,
        sea and tide conditions, and a 14-day outlook. Pick a coast.
      </p>

      <div className="mt-8 space-y-8">
        {countries.map((country) => {
          const countryPath = `/fishing/${country.code.toLowerCase()}`;
          return (
            <section key={country.code} aria-labelledby={`country-${country.code}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 border-b border-rc-rule pb-2">
                <h2 id={`country-${country.code}`} className="text-xl font-semibold">
                  <Link
                    href={countryPath}
                    className="text-rc-ink hover:text-rc-brand transition-colors"
                  >
                    {country.name}
                  </Link>
                </h2>
                <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                  {country.provinces.length}{" "}
                  {country.provinces.length === 1 ? "region" : "regions"}
                </span>
              </div>

              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
                {country.provinces.map((province) => {
                  const spots = province.cities.reduce((m, c) => m + c.spots.length, 0);
                  return (
                    <li key={province.code}>
                      <Link
                        href={province.path}
                        className="group flex items-baseline gap-2 py-1"
                      >
                        <span className="text-[15px] font-medium text-rc-ink group-hover:text-rc-brand transition-colors">
                          {province.name}
                        </span>
                        <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                          {province.cities.length}{" "}
                          {province.cities.length === 1 ? "city" : "cities"} · {spots}{" "}
                          {spots === 1 ? "spot" : "spots"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
