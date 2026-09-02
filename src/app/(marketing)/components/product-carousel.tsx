import Image from 'next/image';
import Link from 'next/link';
import { fetchHierarchyLight, fetchMapSpots } from '@/lib/bluecaster';
import { buildExploreData } from '@/app/explore/lib/explore-data';
import MarketingMap, { type MapSpot } from './marketing-map';
import PhoneFrame from './phone-frame';
import PhoneCarousel, { type PhoneSlide } from './phone-carousel';
import ClientErrorBoundary from '@/app/components/client-error-boundary';
import TrialModalButton from '@/app/components/paywall/trial-modal-button';
import { btn } from '@/app/components/ui/button';
import { PHONE_CSS } from '@/app/lp/_city1/phone-css';
import ConditionsPhone from '@/app/lp/_city1/conditions-phone';
import AlertSmsPhone from '@/app/lp/_city1/alert-sms-phone';
import { loadConditionsFeed } from '@/app/lp/_city1/load-conditions';
import { nextSundayFrom } from '@/app/lp/_city1/alert-sms';
import { VANCOUVER_1 } from '@/app/lp/_city1/city1-city';
import { timezoneFor } from '@/lib/regions';

/**
 * The product, four screens of it, on a timer.
 *
 * ── Why these four, and why they are not new ─────────────────────────────
 *
 * Every one of them is already built and already running as an ad landing
 * page: the Explore map is /lp/<city>/1's hero reel, the annotated spot page
 * is that page's where/what/when shot, and the two live phones are
 * /lp/<city>/4's. The components and the words come from there rather than
 * being rewritten here, so a reader who clicked an ad and a reader who typed
 * the domain are shown the same product, and a change to one screen cannot
 * leave the other describing something we no longer ship.
 *
 * The one thing that is written down here is the ORDER, and it is an argument:
 * where the fish are, what one mark is telling you, how that mark's day moves,
 * and then the offer that you do not have to watch any of it.
 *
 * ── The mark ─────────────────────────────────────────────────────────────
 *
 * Three of the four slides are The Bell Buoy, in DFO subarea 29-3, because
 * that is the mark the landing page's screenshot pictures and the mark its
 * alert copy names. Keeping them on one piece of water is deliberate: four
 * screens of four different spots reads as a gallery, and the same mark
 * answered four ways reads as one product. `VANCOUVER_1` is where those facts
 * live, and this file reads them rather than restating them.
 *
 * ── What may fail, and what happens then ─────────────────────────────────
 *
 * The map and the conditions phone are the only slides that need the API. Both
 * are wrapped so a bad response costs that slide and nothing else: the map
 * degrades to the chart illustration, and the conditions phone drops out of
 * the carousel entirely rather than showing an empty chart. The spot-page shot
 * and the alert phone are static and always render.
 */

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
 * The device width every slide is drawn at.
 *
 * 397 is the landing pages' number and it is not arbitrary: 375 of app screen
 * plus 11 of bezel each side. The map phone is told the same, so the four
 * screens are pictures of one device rather than of three.
 */
const DEVICE = 'w-[min(397px,100%)]';

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

export default async function ProductCarousel() {
  // Neither of these is load-bearing on the landing page — a bad response from
  // the API (or a spot the data build chokes on) must never 500 the homepage.
  // Anything thrown here costs one slide, not the section.
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
    console.error('[ProductCarousel] falling back to the chart illustration:', err);
  }

  // Day 0 at the mark the shot pictures. Returns null on any thin payload —
  // see load-conditions.ts — and a null costs the slide.
  //
  // Cached for the same 5 minutes as the map payload above, not the spot
  // page's own 60 seconds. This page is STATIC, and a static page regenerates
  // as often as the shortest-lived fetch under it: at 60 the homepage would
  // have started rebuilding five times as often as it did, to move a chart
  // nobody is reading a number off.
  const conditions = await loadConditionsFeed(
    null,
    'BC',
    VANCOUVER_1.conditionsMark,
    300,
  ).catch(() => null);

  // Read on the server and passed down, like serverNowMs: the page is cached
  // hourly, so a date read during a client render would disagree with the HTML
  // it is hydrating.
  const now = Date.now();
  const tz = conditions?.tz ?? timezoneFor('BC');

  const slides: PhoneSlide[] = [
    {
      id: 'map',
      tab: 'The map',
      kicker: 'Every mark, scored',
      title: ['Every reef, bank and ledge.', 'Mapped.'],
      body: [
        'Discover productive fishing structure, save your favorite spots, and explore waters with confidence.',
        "Whether you're chasing salmon, halibut, or lingcod, you'll always know where to start.",
      ],
      cta: (
        <Link href="/explore" className={btn.primary}>
          Explore the map
        </Link>
      ),
      phone: (
        <PhoneFrame
          width={DEVICE}
          label="The ReelCaster Explore map on a phone, panning between scored fishing spots in the Salish Sea."
        >
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
      ),
    },
    {
      id: 'spot',
      tab: 'A spot',
      kicker: 'One screen, three answers',
      title: ['Where, what and when.', 'Answered.'],
      body: [
        "Pick a spot and ReelCaster tells you what's open, what's worth targeting, its hourly score out of 100, and the best window to get the rods in.",
      ],
      points: [
        { term: 'Where', detail: 'Every mark we score, with the water under it drawn to depth' },
        { term: 'What', detail: 'Every species at that spot, scored separately' },
        { term: 'When', detail: "The best window highlighted, so you don't scan five apps" },
      ],
      cta: (
        <Link href="/explore" className={btn.primary}>
          Find your spot
        </Link>
      ),
      phone: (
        // Already a whole device, arrows and all, so it wears no frame of
        // ours.
        //
        // It is the one screen here that does not come out at 397: the arrows
        // hang off the left of the file, so the device inside it is only about
        // 62% of the picture's width, and a column wide enough to draw it at
        // the others' height is a column taken out of the copy beside it. The
        // height cap is what it would need if the room were ever there; today
        // the column's own width is what governs.
        <Image
          src={VANCOUVER_1.shot.src}
          alt={`A ReelCaster spot page for ${VANCOUVER_1.shot.mark}. Arrows label the spot name as Where, the species score card as What, and the best window as When.`}
          width={VANCOUVER_1.shot.width}
          height={VANCOUVER_1.shot.height}
          sizes="(min-width: 1024px) 645px, 92vw"
          className="h-auto max-h-[860px] w-auto max-w-full object-contain drop-shadow-[0_18px_40px_rgba(18,21,26,0.16)]"
        />
      ),
    },
    {
      id: 'alerts',
      tab: 'Alerts',
      kicker: 'And when you are not looking',
      title: ["We text you,", "so you don't miss them."],
      body: [
        "Set the score you'd get up for at the spots you fish. We watch them every morning and send one text when a day clears your bar. No app to open, nothing to remember.",
      ],
      points: [
        { term: 'Your bar', detail: 'You pick the score, not us' },
        { term: 'Your spots', detail: 'Including custom ones you add yourself' },
        { term: 'One text', detail: 'The best day in the window, not one a morning' },
      ],
      cta: (
        <TrialModalButton from="marketing-carousel-alerts" className={btn.primary}>
          Start free trial
        </TrialModalButton>
      ),
      phone: (
        <AlertSmsPhone
          parts={VANCOUVER_1.alertSms!}
          when={nextSundayFrom(now, tz)}
          timeLabel={VANCOUVER_1.alertSmsTime ?? '5:58'}
        />
      ),
    },
  ];

  // The day chart goes between the spot page and the alert: it is the same
  // mark as the shot above it, one level deeper. Dropped rather than faked
  // when the payload came back thin.
  if (conditions) {
    slides.splice(2, 0, {
      id: 'conditions',
      tab: 'The day',
      kicker: 'Hour by hour',
      title: ['Tide, current, wind and sky.', 'On the same hour.'],
      body: [
        `${conditions.spotName}, today, scored for ${conditions.speciesName ?? 'the species you fish'}. Every reading belongs to the hour the line is sitting on, and you can drag it yourself.`,
        'The same screen carries the spot’s DFO regulations and a full bathymetry map underneath it.',
      ],
      cta: (
        <Link href="/explore" className={btn.primary}>
          See today&rsquo;s conditions
        </Link>
      ),
      phone: <ConditionsPhone feed={conditions} serverNowMs={now} />,
    });
  }

  return (
    <section className="border-t border-rc-rule/60 bg-rc-panel">
      {/* The two live phones' device shells, shared verbatim with the landing
          pages that already draw them. One injected block rather than Tailwind
          classes, because it is the landing pages' stylesheet and the point is
          that there is exactly one copy of it. See lp/_city1/phone-css.ts. */}
      <style dangerouslySetInnerHTML={{ __html: PHONE_CSS }} />
      <div className="rcp mx-auto max-w-6xl px-6 py-16 md:py-24">
        <PhoneCarousel slides={slides} />
      </div>
    </section>
  );
}
