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
import SpotHeroPhone from './spot-hero-phone';
import { loadSpotHeroFeed } from './spot-hero-feed';
import { loadAlertSmsFeed } from '@/app/lp/_city1/load-alert-sms';
import { VANCOUVER_1 } from '@/app/lp/_city1/city1-city';

/**
 * The product, four screens of it, on a timer.
 *
 * ── Why these four, and why they are not new ─────────────────────────────
 *
 * The words on three of them come straight from the ad landing pages, which
 * have been making these arguments for months, so a reader who clicked an ad
 * and a reader who typed the domain are shown the same product.
 *
 * All four pictures are LIVE. The map is the Explore map; the spot slide is
 * the top of a real spot page; the day slide is that same mark's real day; the
 * alert is the alert format on a written-down message. None of them is a
 * screenshot, which matters more here than anywhere else on the site: a
 * screenshot of a scoring product is a picture of one afternoon, and it starts
 * going stale the moment it is taken.
 *
 * The one thing that is written down here is the ORDER, and it is an argument:
 * where the fish are, what one mark is telling you, how that mark's day moves,
 * and then the offer that you do not have to watch any of it.
 *
 * ── The mark ─────────────────────────────────────────────────────────────
 *
 * Three of the four slides are The Bell Buoy, in DFO subarea 29-3, because
 * that is the mark the landing page's own screens are about and the mark its
 * alert copy names. Keeping them on one piece of water is deliberate: four
 * screens of four different spots reads as a gallery, and the same mark
 * answered four ways reads as one product. `VANCOUVER_1` is where those facts
 * live, and this file reads them rather than restating them.
 *
 * ── What may fail, and what happens then ─────────────────────────────────
 *
 * Three of the four need the API, and each is wrapped so a bad response costs
 * that slide and nothing else: the map degrades to the chart illustration, and
 * the spot and day phones drop out of the carousel entirely rather than drawing
 * an empty screen. The alert phone reads no live data and always renders.
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

/** PhoneFrame fills the slot, which is where the size lives. See SLOT_CSS. */
const DEVICE = 'w-full';

/**
 * The device box: drawn at true size, shown at 65%.
 *
 * ── Why a transform and not a smaller box ────────────────────────────────
 *
 * Nothing here is re-laid-out. The app inside still gets the 375px a real
 * phone gives it, which is the only width its own breakpoints and measuring
 * floors are built for; handing these components a 258px box instead would not
 * draw a smaller phone, it would draw a broken one — SpotTerminal drops under
 * its 300px measuring floor and redraws itself shrunk, and the spot page starts
 * wrapping at a width no iPhone has. So the device is built at 397 and scaled.
 *
 * 397 is the landing pages' number and it is not arbitrary: 375 of app screen
 * plus 11 of bezel each side. 860 is PhoneFrame's own height at that width —
 * 840 screen units at `94cqw/375` each, plus 3cqw of bezel top and bottom — so
 * the box is the device's real proportion rather than a number picked to look
 * right. At 0.65 it occupies 258.05 by 559.
 *
 * ── Why the height is stated ─────────────────────────────────────────────
 *
 * The four devices do not agree on it: 860, 860, 836 and 834. A device whose
 * bottom edge jumps two dozen pixels every time the timer fires reads as the
 * picture bouncing rather than as the screen changing, so everything in the
 * slot stretches into the stated 860 — the frame's screen, and both
 * landing-page bodies. The alert phone's own 375:812 aspect gives way for the
 * same reason. The screens grow; nothing is squashed.
 *
 * ── Why the slot is out of flow ──────────────────────────────────────────
 *
 * A transform does not change the space an element takes. Left in flow the
 * slot would still occupy 397 by 860 and leave a third of the column empty
 * under the phone, so the box states the scaled size and the slot is drawn
 * inside it, absolutely positioned.
 */
const SLOT_CSS = `
.rcpbox{position:relative;width:258.05px;height:559px;margin-inline:auto}
.rcpslot{
  position:absolute;top:0;left:0;
  display:flex;flex-direction:column;
  width:397px;min-height:860px;
  transform:scale(.65);transform-origin:top left;
}
.rcpslot > *{flex:1 1 auto}
.rcpslot .condbody,.rcpslot .smsbody{display:flex;flex-direction:column}
.rcpslot .condscreen,.rcpslot .smsscreen{flex:1 1 auto}
.rcpslot .smsscreen{aspect-ratio:auto}
`;

/**
 * The mark three of the four slides are about, and the province that numbers
 * it.
 *
 * Read off the landing page's own config rather than typed again here — it is
 * the same water, and two files naming a mark independently is two files free
 * to disagree about it.
 */
const MARK = VANCOUVER_1.conditionsMark!;
const PROVINCE = 'BC';

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
  //
  // Read on the server and passed down, like serverNowMs: the page is cached
  // hourly, so a date read during a client render would disagree with the HTML
  // it is hydrating.
  const now = Date.now();

  // All three reads hit the same upstream payload for the same mark, which
  // Next de-duplicates inside one render as long as they ask for the same
  // lifetime. The alert text is read off that payload too (load-alert-sms.ts),
  // so the text cannot name a fish the forecast is not scoring that Sunday.
  const [conditions, hero, alert] = await Promise.all([
    loadConditionsFeed(null, PROVINCE, MARK, 300).catch(() => null),
    loadSpotHeroFeed(MARK.slug, PROVINCE, 300).catch(() => null),
    loadAlertSmsFeed(VANCOUVER_1.alertMark ?? MARK, PROVINCE, now, 300).catch(() => null),
  ]);

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
    // The spot page, from the top, at true size. Dropped rather than faked
    // when the payload came back thin.
    ...(hero
      ? [
          {
            id: 'spot',
            tab: 'A spot',
            kicker: 'One screen, three answers',
            title: ['Where, what and when.', 'Answered.'] as [string, string],
            body: [
              "Pick a spot and ReelCaster tells you what's open, what's worth targeting, its hourly score out of 100, and the best window to get the rods in.",
            ],
            points: [
              {
                term: 'Where',
                detail: 'Every mark we score, with the water under it drawn to depth',
              },
              {
                term: 'What',
                detail: 'Every species at that spot, scored separately — tap one and the whole screen follows',
              },
              {
                term: 'When',
                detail: "The best window highlighted, so you don't scan five apps",
              },
            ],
            cta: (
              <Link href="/explore" className={btn.primary}>
                Find your spot
              </Link>
            ),
            // Held back until the slide is first shown: it is the second
            // MapLibre map on this page. See PhoneSlide.lazy.
            lazy: true,
            phone: (
              <PhoneFrame
                width={DEVICE}
                label={`The ReelCaster spot page for ${hero.spot.name} on a phone: the mark, every species scored for it, today's best window, its regulations, and the water underneath.`}
              >
                {/* Same boundary as the map slide, and for the same reason:
                    this screen draws a MapLibre map too, and a lost WebGL
                    context must not take the homepage with it. */}
                <ClientErrorBoundary label="SpotHeroPhone" fallback={CHART_FALLBACK}>
                  <SpotHeroPhone feed={hero} serverNowMs={now} />
                </ClientErrorBoundary>
              </PhoneFrame>
            ),
          },
        ]
      : []),
    // The day chart, one level deeper into the same mark.
    ...(conditions
      ? [
          {
            id: 'conditions',
            tab: 'The day',
            kicker: 'Hour by hour',
            title: ['Tide, current, wind and sky.', 'On the same hour.'] as [
              string,
              string,
            ],
            body: [
              `${conditions.spotName}, today, scored for ${conditions.speciesName ?? 'the species you fish'}. Every reading belongs to the hour the line is sitting on, and you can drag it yourself.`,
              'The same screen carries the spot\u2019s DFO regulations and a full bathymetry map underneath it.',
            ],
            cta: (
              <Link href="/explore" className={btn.primary}>
                See today&rsquo;s conditions
              </Link>
            ),
            phone: <ConditionsPhone feed={conditions} serverNowMs={now} />,
          },
        ]
      : []),
    // Falls away when the mark has nothing scored on the Sunday the text
    // would name, as the conditions slide does on a thin feed.
    ...(alert
      ? [
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
                parts={alert.parts}
                when={alert.when}
                timeLabel={VANCOUVER_1.alertSmsTime ?? '5:58'}
              />
            ),
          } satisfies PhoneSlide,
        ]
      : []),
  ];

  return (
    <section className="border-t border-rc-rule/60 bg-rc-panel">
      {/* The two live phones' device shells, shared verbatim with the landing
          pages that already draw them. One injected block rather than Tailwind
          classes, because it is the landing pages' stylesheet and the point is
          that there is exactly one copy of it. See lp/_city1/phone-css.ts. */}
      <style dangerouslySetInnerHTML={{ __html: PHONE_CSS + SLOT_CSS }} />
      <div className="rcp mx-auto max-w-6xl px-6 py-16 md:py-24">
        <PhoneCarousel slides={slides} />
      </div>
    </section>
  );
}
