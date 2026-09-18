import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import { parseWall } from "@/lib/ad-mode";
import { ANGLES } from "@/app/lp/_shared/lp-angles";
import { speciesKeywordName } from "@/lib/species-param";
import { landingTitle, parseTopic } from "@/lib/landing-topic";
import { tierFor } from "@/app/explore/lib/explore-data";
import { formatHour12 } from "@/lib/time-format";
import { TRIAL_DAYS } from "@/lib/pricing";
import type { MapSpot } from "@/app/(marketing)/components/marketing-map";
import { loadCity } from "../instrument/load-city";
import { recognitionLabel } from "../instrument/featured";
import CityInstrument from "../instrument/city-instrument";
import CityTopSpots from "../instrument/city-top-spots";
import KeepToday from "../hub/keep-today";
import AdReel from "../[spot]/ad/ad-reel";
import CityAdView from "./city-ad-view";

/**
 * The ad frame of a city page, for city-level keywords.
 *
 * `/fishing/<country>/<state>/<city>?ad=<wall>&species=<fish>` is rewritten
 * here by src/middleware.ts, the same way a spot URL reaches its `[spot]/ad`.
 * A search for "victoria chinook fishing" lands on the city it named, with
 * the fish it named:
 *
 *   1. The spot ad page's hero, at city grain. The title is the keyword
 *      ("Victoria Chinook Fishing Report"); the answer is read off ONE named
 *      mark, the most-fished one that scored the fish today, and says so,
 *      because a city has no tide or wind of its own.
 *   2. The phone reel: the city's map walking its most-fished marks, then that
 *      top mark's day, page and alert.
 *   3. The city's marks for that fish, most-fished first (Casey's call over
 *      best score today), each opening its framed spot ad page with the
 *      species carried on.
 *   4. The city instrument (14-day strip, 24-hour chart at the top mark, map,
 *      custom spots) and what you can keep, with every link held in the frame.
 *
 * Data comes through `loadCity`, the loader the public page and /lp/7 share,
 * so the anonymous-horizon slicing applies here too. noindex; canonical at the
 * public city page.
 */

type PageProps = {
  params: Promise<{ country: string; state: string; city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const VERDICT = {
  good: "looks good today",
  fair: "is fair today",
  poor: "is slow today",
} as const;

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { country, state, city: cityUrlSlug } = await params;
  const sp = await searchParams;
  const { city, fish } = await loadCity(country, state, cityUrlSlug, {
    speciesParam: first(sp.species) || null,
  });
  const topic = parseTopic(first(sp.topic));
  const fishName = fish ? speciesKeywordName(fish.name) : null;
  return {
    title:
      fishName || topic
        ? landingTitle(city.name, fishName, topic)
        : `${city.name} Fishing Forecast`,
    robots: { index: false, follow: false },
    alternates: { canonical: siteUrl(city.path) },
  };
}

export default async function CityAdPage({ params, searchParams }: PageProps) {
  const { country, state, city: cityUrlSlug } = await params;
  const sp = await searchParams;

  const wall = parseWall(first(sp.ad));
  const angleRaw = first(sp.a).trim().toLowerCase();
  const angle = ANGLES.some((a) => a.id === angleRaw) ? angleRaw : "";
  const topic = parseTopic(first(sp.topic));

  const {
    city,
    tz,
    regulator,
    spots,
    rankedRows,
    featured,
    cityForecast,
    seasonRows,
    fish,
    hubSpots,
  } = await loadCity(country, state, cityUrlSlug, {
    speciesParam: first(sp.species) || null,
  });

  const fishName = fish ? speciesKeywordName(fish.name) : null;

  // The mark the answer is read from: under a keyword, the most-fished mark
  // that scored the fish (the loader's `featured` is that row); otherwise the
  // city's featured mark for its headline species. The same row the 24-hour
  // chart below draws, so the hero and the chart name the same water.
  const leadSlug = featured?.slug ?? rankedRows[0]?.spot.slug ?? null;
  const leadSpot = leadSlug ? hubSpots.find((s) => s.slug === leadSlug) ?? null : null;
  const leadSpeciesId = fish?.id ?? featured?.speciesId ?? rankedRows[0]?.speciesId ?? null;
  const entry = leadSpot && leadSpeciesId ? leadSpot.bySpecies[leadSpeciesId] ?? null : null;
  const leadSpeciesFull = fish?.name ?? featured?.speciesName ?? null;
  const leadFishSlug = fish?.slug ?? featured?.speciesSlug ?? null;
  const leadFish = fishName ?? (leadSpeciesFull ? speciesKeywordName(leadSpeciesFull) : null);

  const tier = tierFor(entry?.peak ?? null);
  const Fish = leadFish ? leadFish.charAt(0).toUpperCase() + leadFish.slice(1) : null;
  // "Most-fished" only when a year of reports says so; a city with thin intel
  // ranks its marks on score, and the sentence has to say that instead.
  const descriptor =
    leadSpot && recognitionLabel(leadSpot)
      ? `the most-fished mark near ${city.name}`
      : `the top-scoring mark near ${city.name}`;
  const verdictText =
    leadSpot && tier !== "none"
      ? `${Fish ? `${Fish} fishing` : "Fishing"} at ${leadSpot.name}, ${descriptor}, ${VERDICT[tier]}.`
      : null;
  const whenText = entry?.window
    ? `The best time to go there is ${formatHour12(entry.window.start_hour)} to ${formatHour12(
        (entry.window.end_hour + 1) % 24,
      )}.`
    : null;

  const scoredCount = rankedRows.length;
  const pill = "rounded-full px-2.5 py-1 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.06em]";
  const pills = (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`${pill} bg-rc-surface text-rc-ink-mute`}>
        {city.name}, {city.provinceCode}
      </span>
      {scoredCount > 0 && (
        <span className={`${pill} bg-rc-brand-soft text-rc-brand`}>
          {fishName ? `${fishName} · ` : ""}
          {scoredCount} {scoredCount === 1 ? "spot" : "spots"} scored today
        </span>
      )}
    </div>
  );

  // The map screen's pucks read the searched fish's score where the spot has
  // one, so the card agrees with the list under the hero.
  const mapSpots: MapSpot[] = spots
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      score: fish ? (s.scoresBySpecies[fish.id] ?? null) : s.score,
      scoresBySpecies: s.scoresBySpecies,
    }))
    .filter((s) => s.score !== null);

  const serverNowMs = Date.now();

  return (
    <CityAdView
      citySlug={city.slug}
      cityName={city.name}
      wall={wall}
      angle={angle}
      speciesParam={fish?.slug ?? null}
      hero={{
        pills,
        title:
          fishName || topic
            ? landingTitle(city.name, fishName, topic)
            : `${city.name} Fishing Forecast`,
        spotName: city.name,
        fish: leadFish,
        fishSlug: leadFishSlug,
        score: entry?.peak ?? null,
        windowLabel: null,
        verdictText,
        whenText,
        explainerText: `ReelCaster scores every hour at all ${spots.length} spots around ${city.name} from 0 to 100, reading the tide, current, wind and weather${
          leadFish ? ` for ${leadFish}` : ""
        }. The higher the score, the better your odds. Green means go.`,
        footnoteText: `Pro is free for ${TRIAL_DAYS} days: all 14 days, full catch reports and text alerts for every spot near ${city.name}.`,
      }}
      reel={
        leadSlug ? (
          <AdReel
            slug={leadSlug}
            provinceCode={city.provinceCode}
            fishName={leadSpeciesFull}
            serverNowMs={serverNowMs}
            city={{
              name: city.name,
              spots: mapSpots,
              featuredSlugs: rankedRows.slice(0, 5).map((r) => r.spot.slug),
              center: { lat: city.lat, lng: city.lng },
            }}
          />
        ) : null
      }
    >
      <CityTopSpots
        rows={rankedRows}
        cityName={city.name}
        title={
          fishName
            ? `Top ${fishName} spots near ${city.name}`
            : `The spots people actually fish in ${city.name}`
        }
        limit={10}
      />
      <CityInstrument
        citySlug={city.slug}
        cityName={city.name}
        cityLat={city.lat}
        cityLng={city.lng}
        tz={tz}
        serverNowMs={serverNowMs}
        initialForecast={cityForecast}
        featured={featured}
        rows={rankedRows}
        rosterCount={spots.length}
        hideTopSpots
      />
      <KeepToday rows={seasonRows} cityName={city.name} regulator={regulator} adFrame />
    </CityAdView>
  );
}
