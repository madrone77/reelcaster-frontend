import Image from 'next/image';
import Link from 'next/link';
import { fetchHierarchyLight, fetchMapSpots } from '@/lib/bluecaster';
import { buildExploreData } from '@/app/explore/lib/explore-data';
import MarketingMap, { type MapSpot } from './marketing-map';
import { btn } from '@/app/components/ui/button';

// Salish Sea — South Vancouver Island through Vancouver. Wider than the
// opening frame so panning reveals more spots rather than running into an
// empty basemap; not the full covered extent, which would ship every BC/WA/OR
// spot in the landing page payload.
const BBOX = '-125.60,48.00,-122.60,49.60';
const CENTER = { lat: 48.45, lng: -123.55 };
const ZOOM = 9.1;

export default async function MapSection() {
  // The map is a nice-to-have on the landing page, not load-bearing — a bad
  // response from the API (or a spot the data build chokes on) must never 500
  // the whole homepage. Anything thrown here degrades to the illustration.
  let spots: MapSpot[] = [];
  try {
    const [hierarchy, payload] = await Promise.all([
      fetchHierarchyLight(),
      fetchMapSpots({ bbox: BBOX }),
    ]);

    const data = buildExploreData(hierarchy, payload);

    // No cap: every scored spot in the bbox draws. Unscored spots are dropped —
    // a grey "—" pin sells nothing.
    spots = data.spots
      .filter((s) => s.score !== null)
      .map(({ slug, name, lat, lng, score, scoresBySpecies }) => ({
        slug,
        name,
        lat,
        lng,
        score,
        scoresBySpecies,
      }));
  } catch (err) {
    console.error('[MapSection] falling back to the chart illustration:', err);
  }

  return (
    <section className="border-t border-rc-rule/60 bg-rc-panel">
      <div className="max-w-6xl mx-auto grid gap-14 px-6 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <div className="h-[340px] w-full overflow-hidden rounded border border-rc-rule/60 shadow-rc-bar">
            {spots.length > 0 ? (
              <MarketingMap spots={spots} center={CENTER} zoom={ZOOM} />
            ) : (
              // The API is the one dependency here we don't control. If it's
              // down or returns nothing scored, fall back to the chart
              // illustration rather than shipping an empty grey box.
              <Image
                src="/landing/chart-illustration.svg"
                alt="Nautical chart with depth contours and scored fishing spots"
                width={620}
                height={340}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <h2 className="text-balance text-3xl md:text-4xl font-black tracking-[-0.02em] leading-[1.15]">
            <span className="block text-rc-ink">Every reef, bank and ledge.</span>
            <span className="block text-rc-brand">Mapped.</span>
          </h2>
          <p className="mt-5 max-w-lg text-pretty text-sm md:text-base leading-relaxed text-rc-ink-soft">
            Discover productive fishing structure, save your favorite spots,
            and explore waters with confidence.
          </p>
          <p className="mt-3 max-w-lg text-pretty text-sm md:text-base leading-relaxed text-rc-ink-soft">
            Whether you&apos;re chasing salmon, halibut, or lingcod, you&apos;ll
            always know where to start.
          </p>
          <Link href="/explore" className={`mt-9 ${btn.primary}`}>
            Explore the map
          </Link>
        </div>
      </div>
    </section>
  );
}
