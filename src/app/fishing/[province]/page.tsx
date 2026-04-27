import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchHierarchy, fetchPublishedCities } from "@/lib/bluecaster";
import {
  PROVINCE_DISPLAY_NAMES,
  PROVINCE_EDITORIAL,
  isCovered,
} from "@/lib/regions";

const SITE_URL = "https://reelcaster.com";

interface PageProps {
  params: Promise<{ province: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { province } = await params;
  const code = province.toUpperCase();
  const name = PROVINCE_DISPLAY_NAMES[code] ?? code;
  const canonical = `${SITE_URL}/fishing/${province.toLowerCase()}`;
  const title = `Fishing ${name} | ReelCaster`;
  const description = `Live fishing forecasts and city pages for ${name}. Browse covered cities, regulations, and 24-hour scoring.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "ReelCaster",
      type: "website",
      locale: "en_CA",
    },
    robots: { index: true, follow: true },
  };
}

export default async function ProvincePage({ params }: PageProps) {
  const { province } = await params;
  const code = province.toUpperCase();

  const [hierarchy, publishedCities] = await Promise.all([
    fetchHierarchy(),
    fetchPublishedCities(),
  ]);

  // Locate the province in the hierarchy.
  let provinceNode:
    | {
        name: string;
        code: string;
        regions: Array<{
          cities: Array<{
            name: string;
            slug: string;
            lat: number;
            lng: number;
          }>;
        }>;
      }
    | undefined;
  for (const country of hierarchy?.countries ?? []) {
    const found = country.states_provinces.find(
      (p) => p.code.toUpperCase() === code,
    );
    if (found) {
      provinceNode = found;
      break;
    }
  }

  // Render the page if the province is recognized either by the hierarchy or
  // by our local editorial map. This keeps known provinces working when the
  // upstream API is briefly unavailable; truly unknown slugs still 404.
  if (!provinceNode && !PROVINCE_EDITORIAL[code]) {
    notFound();
  }

  // Filter cities to those that have published pages.
  const publishedSlugs = new Set<string>(
    (publishedCities ?? []).map(
      (p: { slug?: string; cities?: { slug?: string } }) =>
        (p.cities?.slug ?? p.slug ?? "") as string,
    ),
  );

  const allCities: Array<{
    name: string;
    slug: string;
    lat: number;
    lng: number;
  }> = [];
  for (const region of provinceNode?.regions ?? []) {
    for (const city of region.cities) {
      if (publishedSlugs.has(city.slug)) {
        allCities.push(city);
      }
    }
  }
  allCities.sort((a, b) => a.name.localeCompare(b.name));

  const editorial = PROVINCE_EDITORIAL[code];
  const displayName =
    PROVINCE_DISPLAY_NAMES[code] ?? provinceNode?.name ?? code;
  const covered = isCovered(code);

  // Build a Mapbox Static Image URL with city pins. Skip when no token,
  // no cities, or province is uncovered.
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapImageUrl =
    mapboxToken && allCities.length > 0
      ? buildStaticMapUrl(allCities, mapboxToken)
      : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Fishing Forecasts",
        item: `${SITE_URL}/fishing`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: displayName,
        item: `${SITE_URL}/fishing/${province.toLowerCase()}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <article>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-14 pb-8 md:pt-20 md:pb-10">
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center text-stone-500 text-xs tracking-[0.25em] uppercase font-medium">
              <li>
                <Link href="/fishing" className="hover:text-slate-700">
                  Fishing
                </Link>
              </li>
              <li className="before:content-['/'] before:mx-1.5">
                <span className="text-slate-700">{code}</span>
              </li>
            </ol>
          </nav>

          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-slate-900 mb-5">
            {editorial?.headline ?? `Fishing ${displayName}`}
          </h1>
          {editorial?.intro && (
            <p className="max-w-2xl text-base md:text-lg leading-relaxed text-slate-700">
              {editorial.intro}
            </p>
          )}
          {!covered && (
            <p className="mt-4 inline-block px-3 py-1 rounded-full text-xs tracking-widest uppercase bg-stone-100 text-slate-500 border border-stone-200">
              Coming Soon
            </p>
          )}
        </section>

        {/* Map */}
        {mapImageUrl && (
          <section className="max-w-6xl mx-auto px-6 py-6">
            <div className="relative w-full overflow-hidden rounded-lg border border-stone-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapImageUrl}
                alt={`Map of fishing cities in ${displayName}`}
                className="w-full h-auto"
              />
            </div>
          </section>
        )}

        {/* City list */}
        <section className="max-w-6xl mx-auto px-6 py-8">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 mb-6">
            Cities
          </h2>

          {allCities.length === 0 ? (
            <p className="text-slate-500">
              No published city pages yet. Check back soon, or{" "}
              <Link
                href="/explore"
                className="underline underline-offset-2 hover:text-slate-700"
              >
                drop a waitlist pin
              </Link>{" "}
              to vote for your region.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allCities.map((c) => (
                <Link
                  key={c.slug}
                  href={`/fishing/${province.toLowerCase()}/${c.slug}`}
                  className="bg-white border border-stone-200 rounded-lg px-4 py-4 hover:border-slate-400 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {c.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {c.lat.toFixed(2)}, {c.lng.toFixed(2)}
                    </p>
                  </div>
                  <span className="text-slate-300">›</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-stone-200 text-center">
          <p className="text-xs text-slate-400">
            Data provided by ReelCaster. Regulations are reference only &mdash;
            always verify with DFO.
          </p>
        </footer>
      </article>
    </>
  );
}

function buildStaticMapUrl(
  cities: Array<{ slug: string; lat: number; lng: number }>,
  token: string,
): string {
  // Mapbox Static Images API caps overlays around 100, but a province typically
  // has well under 30 cities. Use small pins keyed to the slug initial.
  const pins = cities
    .slice(0, 50)
    .map((c) => `pin-s+334155(${c.lng},${c.lat})`)
    .join(",");

  const style = "mapbox/light-v11";
  return `https://api.mapbox.com/styles/v1/${style}/static/${pins}/auto/1280x640@2x?access_token=${token}&padding=80`;
}
