import { ImageResponse } from 'next/og'
import { fetchSpotLivePage } from '@/lib/bluecaster'
import { provinceCodeFromName } from '@/lib/regions'
import {
  BRAND,
  CANVAS,
  FOOT,
  INK,
  MUTED,
  cardSpeciesName,
  nameSize,
} from '@/lib/creative'

/**
 * Paid-ad creative for one spot, rendered from the same data the spot page
 * shows.
 *
 * Meta needs one image per ad, and the ads that work name the water: someone
 * scrolling past "Possession Point" is exactly who we wanted, which on a
 * network with no keywords is the only targeting that actually happens. Making
 * sixteen of those by hand is an afternoon of design work that goes stale the
 * moment a spot is renamed or its roster changes. This makes them from the
 * roster instead, so the ad and the page it lands on can never disagree.
 *
 * Deliberately evergreen: no score, no best hour, no report count, even though
 * all three sit in the payload below. Meta stores an uploaded image as a fixed
 * asset — a baked-in score would be a lie by the following morning, and unlike
 * a social card there is not even a re-scrape that could fix it.
 *
 *   GET /api/ad-creative/possession-point-b18acd?format=4x5
 *
 * Grab the Seattle set in one go (slugs from the campaign keyword file):
 *
 *   for s in possession-point-b18acd jefferson-head-d0d536 ...; do
 *     curl -s "https://www.reelcaster.com/api/ad-creative/$s?format=4x5" -o "$s.png"
 *   done
 */

/** Meta placements worth their own crop, keyed by what Ads Manager calls them. */
const FORMATS = {
  // Feed. The tallest thing Meta will show in-feed, so the most attention per
  // impression; this is the one to build first.
  '4x5': { width: 1080, height: 1350 },
  // Square. Safe everywhere, including the placements that letterbox 4:5.
  '1x1': { width: 1080, height: 1080 },
  // Stories and Reels.
  '9x16': { width: 1080, height: 1920 },
} as const

type FormatKey = keyof typeof FORMATS

function isFormat(v: string | null): v is FormatKey {
  return v === '4x5' || v === '1x1' || v === '9x16'
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const requested = new URL(request.url).searchParams.get('format')
  const format: FormatKey = isFormat(requested) ? requested : '4x5'
  const size = FORMATS[format]

  const page = await fetchSpotLivePage(slug).catch(() => null)
  if (!page) {
    return new Response('No such spot', { status: 404 })
  }

  const name = page.spot.name
  const region = page.spot.region ? provinceCodeFromName(page.spot.region) : null
  const where = [page.spot.city, region].filter(Boolean).join(', ')
  const roster = page.species.slice(0, 4).map((s) => cardSpeciesName(s.name))

  // Portrait has room the social card does not, so the type runs larger. 9:16
  // is mostly safe-area padding rather than bigger type: Stories put UI over
  // the top and bottom fifths of the frame.
  const tall = format === '9x16'
  const pad = tall ? '260px 90px' : '110px 90px'
  const heroBase = tall ? 118 : 128

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CANVAS,
          backgroundImage: `radial-gradient(circle at 80% 14%, ${BRAND}66 0%, transparent 58%)`,
          padding: pad,
          color: INK,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 13,
              background: BRAND,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            R
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            ReelCaster
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              color: MUTED,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            {where || 'Fishing forecast'}
          </div>
          <div
            style={{
              fontSize: nameSize(name, heroBase),
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: '-0.03em',
            }}
          >
            {name}
          </div>
          <div style={{ display: 'flex', fontSize: 44, color: INK, lineHeight: 1.25 }}>
            Is it worth going today?
          </div>
          {roster.length > 0 ? (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {roster.map((s) => (
                <div
                  key={s}
                  style={{
                    display: 'flex',
                    fontSize: 30,
                    color: INK,
                    border: `2px solid ${BRAND}`,
                    borderRadius: 999,
                    padding: '10px 26px',
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', fontSize: 34, color: MUTED, lineHeight: 1.3 }}>
            Every day scored from tide, current, wind and season.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: FOOT,
              letterSpacing: '0.08em',
            }}
          >
            www.reelcaster.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
