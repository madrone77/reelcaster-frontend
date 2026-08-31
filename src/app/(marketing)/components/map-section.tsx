import Image from 'next/image';
import Link from 'next/link';
import { fetchHierarchyLight, fetchMapSpots } from '@/lib/bluecaster';
import { buildExploreData } from '@/app/explore/lib/explore-data';
import MarketingMap, { type MapSpot } from './marketing-map';
import PhoneFrame from './phone-frame';
import ClientErrorBoundary from '@/app/components/client-error-boundary';
import { btn } from '@/app/components/ui/button';

// Salish Sea — South Vancouver Island through Vancouver. Wider than the
// opening frame so panning reveals more spots rather than running into an
// empty basemap; not the full covered extent, which would ship every BC/WA/OR
// spot in the landing page payload.
const BBOX = '-125.60,48.00,-122.60,49.60';
// The fallback frame, and the zoom the map actually runs at. The map opens on
// the best-scoring spot rather than here — see MarketingMap — so this centre
// is only reached when there is nothing to centre on; it is the Strait of
// Georgia, which on a portrait screen runs top to bottom.
//
// The zoom is unchanged from the landscape box this replaced. It has to work
// on a screen a third as wide now, but it also has twice the height to spend,
// and z9 is where the relief raster still reads as seabed rather than a
// smear. Anything tighter and the phone shows one bay and three pucks.
const CENTER = { lat: 48.85, lng: -123.4 };
const ZOOM = 9.1;

/**
 * What the map slot shows when there is no map to show: the API returned
 * nothing scored, or the live map failed and its boundary caught it. Declared
 * once because both paths render the identical thing.
 *
 * Contained rather than covered, on the paper the drawing is already on. The
 * illustration is a landscape sheet of contour rings around its own centre,
 * and covering a portrait phone screen with it crops away everything but a
 * finger's width through the middle of the rings.
 */
const CHART_FALLBACK = (
  <Image
    src="/landing/chart-illustration.svg"
    alt="Nautical chart with depth contours and scored fishing spots"
    width={620}
    height={340}
    className="h-full w-full bg-[#F4F8FA] object-contain"
  />
);

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
          <PhoneFrame label="The ReelCaster Explore map on a phone, panning between scored fishing spots in the Salish Sea.">
            {spots.length > 0 ? (
              // The map is the one thing on this page that needs a GPU, and a
              // renderer can take the GPU away mid-session — a crawler under
              // memory pressure does it routinely. When that happens MapLibre
              // tears its own internals down and the next React update walks
              // into a null style, which without this boundary took the entire
              // document with it. See client-error-boundary.tsx.
              <ClientErrorBoundary label="MarketingMap" fallback={CHART_FALLBACK}>
                <MarketingMap
                  spots={spots}
                  center={CENTER}
                  zoom={ZOOM}
                  fallback={CHART_FALLBACK}
                />
              </ClientErrorBoundary>
            ) : (
              // The API is the one dependency here we don't control. If it's
              // down or returns nothing scored, fall back to the chart
              // illustration rather than shipping an empty grey box.
              CHART_FALLBACK
            )}
          </PhoneFrame>
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
