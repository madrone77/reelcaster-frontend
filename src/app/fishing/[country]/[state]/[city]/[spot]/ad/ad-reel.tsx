import { fetchHierarchyLight, fetchMapSpots } from "@/lib/bluecaster";
import { buildExploreData } from "@/app/explore/lib/explore-data";
import MarketingMap, { type MapSpot } from "@/app/(marketing)/components/marketing-map";
import PhoneFrame from "@/app/(marketing)/components/phone-frame";
import SpotHeroPhone from "@/app/(marketing)/components/spot-hero-phone";
import { loadSpotHeroFeed } from "@/app/(marketing)/components/spot-hero-feed";
import { SLOT_CSS } from "@/app/(marketing)/components/product-carousel";
import ClientErrorBoundary from "@/app/components/client-error-boundary";
import { PHONE_CSS } from "@/app/lp/_city1/phone-css";
import ConditionsPhone from "@/app/lp/_city1/conditions-phone";
import AlertSmsPhone from "@/app/lp/_city1/alert-sms-phone";
import { loadConditionsFeed } from "@/app/lp/_city1/load-conditions";
import { nextSundayFrom } from "@/app/lp/_city1/alert-sms";
import { speciesKeywordName } from "@/lib/species-param";
import AdPhoneReel, { type ReelSlide } from "./ad-phone-reel";

/**
 * The product, four screens of it, all about the spot the ad was for.
 *
 * The homepage carousel's four phones (see product-carousel.tsx), pointed at
 * one mark instead of The Bell Buoy, in the order Casey set for an ad landing:
 * the map with THIS spot selected and its card up, this spot's day chart, this
 * spot's page, and the alert text naming it. Same components, same device
 * shells, so a change to a phone lands here and on the homepage together.
 *
 * Every screen but the text is the live product on today's payload. The text
 * is a picture of a message, exactly as on the landing pages: today's real
 * peak and hour for the fish, dated to the next Sunday. See alert-sms.ts.
 *
 * A thin payload costs a slide, never the page. With fewer than two screens
 * left there is no reel and the hero stands on its copy.
 */

/** How far around the spot the map loads neighbours: enough to fill a phone at z10.5. */
const PAD_LNG = 0.28;
const PAD_LAT = 0.2;
const ZOOM = 10.4;

const CHART_FALLBACK = null;

export default async function AdReel({
  slug,
  provinceCode,
  fishName,
  serverNowMs,
}: {
  slug: string;
  provinceCode: string;
  /** The species the page opens on, by display name, or null for its lead. */
  fishName: string | null;
  serverNowMs: number;
}) {
  const hero = await loadSpotHeroFeed(slug, provinceCode).catch(() => null);
  if (!hero) return null;

  const spot = hero.spot;
  // Open the spot phone on the fish the ad named, when that fish scores today.
  const named = fishName ? hero.species.find((s) => s.name === fishName) : undefined;
  const selectedId =
    named && hero.scoresToday[named.id] ? named.id : hero.selectedId;
  const heroFeed = { ...hero, selectedId };
  const selected = hero.species.find((s) => s.id === selectedId) ?? null;
  const fish = selected ? speciesKeywordName(selected.name) : null;

  const bbox = [
    spot.lng - PAD_LNG,
    spot.lat - PAD_LAT,
    spot.lng + PAD_LNG,
    spot.lat + PAD_LAT,
  ]
    .map((n) => n.toFixed(4))
    .join(",");

  const [conditions, spots] = await Promise.all([
    loadConditionsFeed(null, provinceCode, {
      slug,
      species: selected?.name ?? "",
    }).catch(() => null),
    Promise.all([fetchHierarchyLight(), fetchMapSpots({ bbox })])
      .then(([hierarchy, payload]) =>
        buildExploreData(hierarchy, payload)
          .spots.filter((s) => s.score !== null)
          .map(
            ({ slug, name, lat, lng, score, scoresBySpecies }): MapSpot => ({
              slug,
              name,
              lat,
              lng,
              score,
              scoresBySpecies,
            }),
          ),
      )
      .catch(() => [] as MapSpot[]),
  ]);

  // The text's number is today's real peak for the fish, and its hour.
  let peak: number | null = null;
  let peakHour = 7;
  (conditions?.scores ?? []).forEach((v, i) => {
    if (v != null && (peak == null || v > peak)) {
      peak = v;
      peakHour = i;
    }
  });

  const slides: ReelSlide[] = [];

  if (spots.some((s) => s.slug === slug)) {
    slides.push({
      id: "map",
      tab: "The map",
      title: `${spot.name}, on the live map`,
      body: "Every spot is scored for today, out of 100. Green is worth the trip, amber is fair, red is slow.",
      phone: (
        <PhoneFrame
          width="w-full"
          label={`The ReelCaster map on a phone with ${spot.name} selected and today's score on its card.`}
        >
          <ClientErrorBoundary label="MarketingMap" fallback={CHART_FALLBACK}>
            <MarketingMap
              spots={spots}
              center={{ lat: spot.lat, lng: spot.lng }}
              zoom={ZOOM}
              featuredSlug={slug}
              fallback={CHART_FALLBACK}
            />
          </ClientErrorBoundary>
        </PhoneFrame>
      ),
    });
  }

  if (conditions) {
    slides.push({
      id: "day",
      tab: "The day",
      title: `${spot.name}'s day, hour by hour`,
      body: `The ${fish ?? "fishing"} score across the top, with the tide, current, wind and weather lined up under every hour. The green hours are when to go.`,
      phone: <ConditionsPhone feed={conditions} serverNowMs={serverNowMs} />,
    });
  }

  slides.push({
    id: "spot",
    tab: "The spot",
    title: `Everything about ${spot.name}, on one screen`,
    body: `Every fish here scored separately, the best window to be on the water, and what ${hero.regulator.name} lets you keep.`,
    // The second MapLibre map in the reel: held until its slide first shows.
    lazy: true,
    phone: (
      <PhoneFrame
        width="w-full"
        label={`The ReelCaster spot page for ${spot.name} on a phone.`}
      >
        <ClientErrorBoundary label="SpotHeroPhone" fallback={CHART_FALLBACK}>
          <SpotHeroPhone feed={heroFeed} serverNowMs={serverNowMs} regsLink={false} />
        </ClientErrorBoundary>
      </PhoneFrame>
    ),
  });

  if (peak != null && fish) {
    slides.push({
      id: "alerts",
      tab: "Alerts",
      title: `A text when ${spot.name} is on`,
      body: `Pick the score you'd get up for. We check ${spot.name} every morning and text you when a day clears it.`,
      phone: (
        <AlertSmsPhone
          parts={{ species: fish, spot: spot.name, score: peak, hour: peakHour }}
          when={nextSundayFrom(serverNowMs, hero.tz)}
          timeLabel="6:02"
        />
      ),
    });
  }

  if (slides.length < 2) return null;

  return (
    <div className="rcp">
      <style dangerouslySetInnerHTML={{ __html: PHONE_CSS + SLOT_CSS }} />
      <AdPhoneReel slides={slides} />
    </div>
  );
}
