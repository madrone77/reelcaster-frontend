import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchCityGuides,
  fetchHierarchy,
  fetchMapSpots,
  fetchSpeciesGuide,
  type BlueCasterSpeciesGuide,
} from "@/lib/bluecaster";
import { breadcrumbJsonLd, DEFAULT_OG, siteUrl } from "@/lib/site";
import { COVERED_PROVINCES } from "@/lib/regions";
import { getFishingCity, getFishingProvince } from "../../../lib/fishing-data";
import {
  activityPhrase,
  activityTitle,
  howHeading,
  whereHeading,
} from "../../../lib/activity";
import {
  ConditionCard,
  MethodCard,
  RegulationBanner,
  SeasonChart,
  SectionHeading,
  SpotRow,
  type GuideSpotRow,
} from "./guide-sections";

// The prose is stable, the regulation block and the per-spot scores are not.
// Fifteen minutes keeps the page honest without re-deriving it per request.
export const revalidate = 900;

// Prerender the guides the city pages link to. Same reasoning as the city
// route: an on-demand render makes Next stream metadata, which drops <title>
// and the canonical to the end of the body instead of the head.
export async function generateStaticParams() {
  try {
    const hierarchy = await fetchHierarchy();
    const params: Array<{ province: string; city: string; species: string }> = [];
    for (const code of COVERED_PROVINCES) {
      const province = getFishingProvince(hierarchy, code);
      for (const city of province?.cities ?? []) {
        const guides = await fetchCityGuides(city.slug);
        for (const g of guides?.guides ?? []) {
          params.push({
            province: code.toLowerCase(),
            city: city.slug,
            species: g.species_slug,
          });
        }
      }
    }
    return params;
  } catch {
    // Upstream down at build time: fall back to on-demand rendering rather
    // than failing the build.
    return [];
  }
}

async function load(provinceParam: string, citySlug: string, speciesSlug: string) {
  const hierarchy = await fetchHierarchy();
  const province = getFishingProvince(hierarchy, provinceParam);
  const city = getFishingCity(province, citySlug);
  if (!province || !city) return null;

  const guide = await fetchSpeciesGuide(citySlug, speciesSlug);
  if (!guide) return null;

  return { province, city, guide };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ province: string; city: string; species: string }>;
}): Promise<Metadata> {
  const { province: provinceParam, city: citySlug, species: speciesSlug } = await params;
  const loaded = await load(provinceParam, citySlug, speciesSlug);
  // 404 in metadata too: bailing only in the body would send a 200 with 404
  // UI, which reads as a soft 404.
  if (!loaded) notFound();
  const { city, guide } = loaded;

  // "Chinook Salmon Fishing in Vancouver, BC" is the phrase people search,
  // and it fits the ~60 characters Google renders. Crab and prawn take their
  // own verb: nobody searches "dungeness crab fishing", they search crabbing.
  const title = `${activityTitle(guide.activity)} in ${city.name}, ${city.provinceCode}`;
  const description = descriptionFor(guide, city.name, city.provinceCode);
  const canonical = siteUrl(
    `/fishing/${provinceParam.toLowerCase()}/${citySlug}/${speciesSlug}`,
  );

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | ReelCaster`,
      description,
      url: canonical,
      type: "article",
      ...DEFAULT_OG,
    },
    robots: { index: true, follow: true },
  };
}

/** One sentence built from what this city actually has, not a template. */
function descriptionFor(
  guide: BlueCasterSpeciesGuide,
  cityName: string,
  provinceCode: string,
): string {
  const parts: string[] = [
    guide.activity.verb === "fishing"
      ? `Where and how to catch ${guide.species.name.toLowerCase()} around ${cityName}, ${provinceCode}`
      : `Where and how to go ${guide.activity.verb} around ${cityName}, ${provinceCode}`,
  ];
  if (guide.season.peak_label) parts.push(`peak season ${guide.season.peak_label}`);
  if (guide.methods.length) {
    parts.push(
      `${guide.methods
        .slice(0, 2)
        .map((m) => m.name)
        .join(" and ")} tactics`,
    );
  }
  parts.push(`${guide.regulations.spot_count} spots with live conditions`);
  return `${parts.join(", ")}.`;
}

export default async function SpeciesGuidePage({
  params,
}: {
  params: Promise<{ province: string; city: string; species: string }>;
}) {
  const { province: provinceParam, city: citySlug, species: speciesSlug } = await params;
  const loaded = await load(provinceParam, citySlug, speciesSlug);
  if (!loaded) notFound();
  const { city, guide } = loaded;

  // Today's scores for this species, from the same payload the city map
  // renders, so the guide's ranking and the map's agree by construction.
  const [payload, cityGuides] = await Promise.all([
    fetchMapSpots({ city: citySlug }),
    fetchCityGuides(citySlug),
  ]);
  const scoreBySpotId = new Map<string, number>();
  for (const s of payload?.spots ?? []) {
    // Payload peaks are 0..1 and get scaled exactly once per surface; this
    // page reads the payload directly rather than through buildExploreData,
    // which is where Explore does the same multiply.
    const peak = s.scores?.[guide.species.id]?.peak;
    if (typeof peak === "number") scoreBySpotId.set(s.id, Math.round(peak * 100));
  }

  const spots: GuideSpotRow[] = guide.spots
    .map((s) => ({ ...s, score: scoreBySpotId.get(s.id) ?? null }))
    .sort((a, b) => {
      // Open spots first, then by today's score, then alphabetically. An
      // angler cannot act on a high score at a spot that is shut.
      const rank = (s: GuideSpotRow) => (s.regulatory_state === "retention_open" ? 0 : 1);
      return (
        rank(a) - rank(b) ||
        (b.score ?? -1) - (a.score ?? -1) ||
        a.name.localeCompare(b.name)
      );
    });

  const provincePath = `/fishing/${provinceParam.toLowerCase()}`;
  const cityPath = `${provincePath}/${citySlug}`;
  const cityLabel = `${city.name}, ${city.provinceCode}`;
  const siblings = (cityGuides?.guides ?? []).filter(
    (g) => g.species_slug !== speciesSlug,
  );

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: `Fishing in ${city.provinceName}`, path: provincePath },
    { name: city.name, path: cityPath },
    { name: activityPhrase(guide.activity), path: `${cityPath}/${speciesSlug}` },
  ]);

  const spotList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${activityPhrase(guide.activity)} spots near ${cityLabel}`,
    numberOfItems: spots.length,
    itemListElement: spots.map((spot, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Place",
        name: spot.name,
        url: siteUrl(`/explore/spot/${spot.slug}`),
        geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lng },
      },
    })),
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(spotList) }}
      />

      <nav aria-label="Breadcrumb" className="font-rc-mono text-[11px] text-rc-ink-mute">
        <ol className="flex items-center gap-1.5 flex-wrap">
          <li>
            <Link href="/" className="hover:text-rc-ink transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={provincePath} className="hover:text-rc-ink transition-colors">
              {city.provinceName}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={cityPath} className="hover:text-rc-ink transition-colors">
              {city.name}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-rc-ink-soft" aria-current="page">
            {guide.species.name}
          </li>
        </ol>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-bold text-rc-ink mt-3">
        {activityTitle(guide.activity)} in {cityLabel}
      </h1>
      <p className="font-rc-mono text-[12px] text-rc-ink-soft mt-1.5">
        {guide.regulations.spot_count} spot
        {guide.regulations.spot_count === 1 ? "" : "s"}
        {guide.season.peak_label ? ` · peak ${guide.season.peak_label}` : ""}
        {guide.species.scientific_name ? ` · ${guide.species.scientific_name}` : ""}
      </p>

      <div className="mt-5">
        <RegulationBanner guide={guide} citySpeciesLabel={`${guide.species.name} here`} />
      </div>

      {guide.intro && (
        <div className="mt-6 space-y-4">
          {guide.intro.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="text-[16px] leading-relaxed text-rc-ink-soft">
              {para}
            </p>
          ))}
        </div>
      )}

      {(guide.season.months.length > 0 || guide.season.notes) && (
        <section className="mt-10">
          <SectionHeading id="when">When to go</SectionHeading>
          {guide.season.notes && (
            <p className="text-[15px] leading-relaxed text-rc-ink-soft mt-4">
              {guide.season.notes}
            </p>
          )}
          {guide.season.months.length > 0 && (
            <div className="mt-5">
              <SeasonChart season={guide.season} />
              <p className="font-rc-mono text-[11px] text-rc-ink-mute mt-2">
                Relative abundance through the year around {city.name}
                {guide.season.peak_label ? `. Peak: ${guide.season.peak_label}` : ""}
              </p>
            </div>
          )}
        </section>
      )}

      {guide.methods.length > 0 && (
        <section className="mt-10">
          <SectionHeading id="how">{howHeading(guide.activity, city.name)}</SectionHeading>
          <div className="mt-4 space-y-3">
            {guide.methods.map((m) => (
              <MethodCard key={m.name} method={m} />
            ))}
          </div>
        </section>
      )}

      {guide.conditions.length > 0 && (
        <section className="mt-10">
          <SectionHeading id="conditions">Tide, current and light</SectionHeading>
          <p className="text-[15px] leading-relaxed text-rc-ink-soft mt-4">
            These are the conditions ReelCaster weights when it scores{" "}
            {guide.species.name.toLowerCase()} at {city.name} spots, and they are
            the ones worth planning a trip around.
          </p>
          <div className="mt-4 space-y-3">
            {guide.conditions.map((c) => (
              <ConditionCard key={c.factor} condition={c} />
            ))}
          </div>
          {guide.tide_stations.length > 0 && (
            <p className="font-rc-mono text-[11px] text-rc-ink-mute mt-3">
              Tides here read off {guide.tide_stations.join(", ")}
            </p>
          )}
        </section>
      )}

      {spots.length > 0 && (
        <section className="mt-10">
          <SectionHeading id="where">
            {whereHeading(guide.activity, guide.species.name)}
          </SectionHeading>
          <p className="text-[15px] leading-relaxed text-rc-ink-soft mt-4">
            Every spot we cover around {city.name} that holds{" "}
            {guide.species.name.toLowerCase()}, with today&apos;s score for this
            species. Open the spot for the tide, wind and the next 14 days.
          </p>
          <ul className="mt-3">
            {spots.map((spot) => (
              <SpotRow key={spot.id} spot={spot} />
            ))}
          </ul>
          <Link
            href={cityPath}
            className="inline-block mt-4 font-rc-mono text-[11px] font-semibold tracking-[0.08em] text-rc-brand hover:underline"
          >
            SEE THEM ON THE {city.name.toUpperCase()} MAP →
          </Link>
        </section>
      )}

      {siblings.length > 0 && (
        <section className="mt-10">
          <SectionHeading id="more">Other {city.name} guides</SectionHeading>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {siblings.map((g) => (
              <li key={g.species_slug}>
                <Link
                  href={`${cityPath}/${g.species_slug}`}
                  className="group flex items-baseline gap-2 py-1"
                >
                  <span className="text-[15px] font-medium text-rc-ink group-hover:text-rc-brand transition-colors">
                    {activityPhrase(g.activity)}
                  </span>
                  <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                    {g.spot_count} spot{g.spot_count === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {guide.meta.intro_generated_at && (
        <p className="font-rc-mono text-[11px] text-rc-ink-mute mt-10 border-t border-rc-rule pt-4">
          Guide last reviewed{" "}
          {new Date(guide.meta.intro_generated_at).toLocaleDateString("en-CA", {
            month: "long",
            year: "numeric",
          })}
          . Seasons, limits and closures change: confirm the current
          {guide.regulations.regulator ? ` ${guide.regulations.regulator}` : ""}{" "}
          notice before you fish.
        </p>
      )}
    </div>
  );
}
