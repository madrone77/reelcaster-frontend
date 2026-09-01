import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchHierarchy } from "@/lib/bluecaster";
import { breadcrumbJsonLd, DEFAULT_OG, siteUrl } from "@/lib/site";
import { getFishingCountry, getFishingCountries } from "@/app/fishing/lib/fishing-data";

// Matches the hierarchy's own 1h upstream cache.
export const revalidate = 3600;

/**
 * The country level of the directory.
 *
 * This page exists because the URL below it does. /fishing/ca/bc is a path a
 * reader can truncate and a crawler will try, and a 404 at an intermediate
 * level of a hierarchy you are asking to be indexed reads as a broken site.
 * It is a thin index by design: everything worth reading is a level down.
 */
export async function generateStaticParams() {
  const countries = getFishingCountries(await fetchHierarchy());
  return countries.map((c) => ({ country: c.code.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}): Promise<Metadata> {
  const { country: countryParam } = await params;
  const country = getFishingCountry(await fetchHierarchy(), countryParam);
  // Bail in metadata as well as the body: metadata resolves first, so bailing
  // only below can flush a 200 with 404 UI under it.
  if (!country) notFound();

  const states = country.provinces.map((p) => p.name).join(", ");
  const title = `Saltwater Fishing in ${country.name}`;
  const description = `Fishing spots, live conditions and 14-day forecasts across ${states}.`;
  const canonical = siteUrl(`/fishing/${country.code.toLowerCase()}`);

  return {
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

export default async function CountryPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country: countryParam } = await params;
  const country = getFishingCountry(await fetchHierarchy(), countryParam);
  if (!country) notFound();

  const countryPath = `/fishing/${country.code.toLowerCase()}`;
  const spotCount = country.provinces.reduce(
    (n, p) => n + p.cities.reduce((m, c) => m + c.spots.length, 0),
    0,
  );

  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: `Fishing in ${country.name}`, path: countryPath },
  ]);

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
            Fishing in {country.name}
          </li>
        </ol>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-bold text-rc-ink mt-3">
        Fishing in {country.name}
      </h1>
      <p className="text-rc-ink-soft mt-2 max-w-2xl">
        {spotCount} saltwater fishing spots across{" "}
        {country.provinces.length === 1
          ? country.provinces[0].name
          : `${country.provinces.length} regions`}
        , each with live RC scores, wind, sea and tide conditions, and a 14-day
        outlook.
      </p>

      <div className="mt-8 space-y-8">
        {country.provinces.map((province) => (
          <section key={province.code} aria-labelledby={`state-${province.code}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 border-b border-rc-rule pb-2">
              <h2 id={`state-${province.code}`} className="text-xl font-semibold">
                <Link
                  href={province.path}
                  className="text-rc-ink hover:text-rc-brand transition-colors"
                >
                  {province.name}
                </Link>
              </h2>
              <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                {province.cities.length} {province.cities.length === 1 ? "city" : "cities"}
              </span>
            </div>

            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
              {province.cities.map((city) => (
                <li key={city.slug}>
                  <Link
                    href={city.path}
                    className="group flex items-baseline gap-2 py-1"
                  >
                    <span className="text-[15px] font-medium text-rc-ink group-hover:text-rc-brand transition-colors">
                      {city.name}
                    </span>
                    <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                      {city.spots.length} spot{city.spots.length === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
