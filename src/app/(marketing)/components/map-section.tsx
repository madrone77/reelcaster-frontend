import Image from 'next/image';
import Link from 'next/link';
import { fetchHierarchy, fetchMapSpots } from '@/lib/bluecaster';
import { buildExploreData } from '@/app/explore/lib/explore-data';
import MarketingMap, { type MapPin } from './marketing-map';

// South Vancouver Island — Sooke through Sidney. Tight enough that the frame
// holds real coastline and bathymetry instead of open water.
const BBOX = '-124.30,48.20,-123.00,48.80';
const CENTER = { lat: 48.45, lng: -123.55 };
const ZOOM = 9.1;

// Cap the pins so the frame reads as a map, not a swarm. Highest scores win —
// they're the ones worth showing on a landing page.
const MAX_PINS = 7;

export default async function MapSection() {
  const [hierarchy, payload] = await Promise.all([
    fetchHierarchy(),
    fetchMapSpots({ bbox: BBOX }),
  ]);

  const pins: MapPin[] = buildExploreData(hierarchy, payload)
    .spots.filter((s) => s.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PINS)
    .map(({ slug, name, lat, lng, score }) => ({ slug, name, lat, lng, score }));

  return (
    <section className="border-t border-rc-rule/60 bg-rc-panel">
      <div className="max-w-6xl mx-auto grid gap-14 px-6 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <div className="h-[300px] w-full overflow-hidden rounded border border-rc-rule/60 shadow-rc-bar">
            {pins.length > 0 ? (
              <MarketingMap pins={pins} center={CENTER} zoom={ZOOM} />
            ) : (
              // The API is the one thing here we don't control. If it's down or
              // returns nothing scored, fall back to the chart illustration
              // rather than shipping an empty grey box on the landing page.
              <Image
                src="/landing/chart-illustration.svg"
                alt="Nautical chart with depth contours and scored fishing spots"
                width={620}
                height={300}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] leading-[1.15]">
            <span className="block text-rc-ink">Every reef, bank and ledge.</span>
            <span className="block text-rc-brand">Mapped.</span>
          </h2>
          <p className="mt-5 max-w-lg text-sm md:text-base leading-relaxed text-rc-ink-soft">
            Discover productive fishing structure, save your favorite spots,
            and explore waters with confidence.
          </p>
          <p className="mt-3 max-w-lg text-sm md:text-base leading-relaxed text-rc-ink-soft">
            Whether you&apos;re chasing salmon, halibut, or lingcod, you&apos;ll
            always know where to start.
          </p>
          <Link
            href="/explore"
            className="mt-9 inline-flex items-center justify-center rounded bg-rc-brand px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover"
          >
            Explore the map
          </Link>
        </div>
      </div>
    </section>
  );
}
