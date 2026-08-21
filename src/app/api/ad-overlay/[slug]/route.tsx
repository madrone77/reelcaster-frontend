import { ImageResponse } from 'next/og'
import { fetchSpotLivePage, fetchSpotsOutlook14d } from '@/lib/bluecaster'
import { provinceCodeFromName } from '@/lib/regions'
import { BRAND, FOOT, INK, MUTED, cardSpeciesName, nameSize } from '@/lib/creative'

/**
 * Transparent overlay for a video ad about one spot.
 *
 * The still card next door works as a still and dies in a feed. This is the
 * half that goes OVER footage: the spot's name, where it is, and the best score
 * it reaches in the next seven days, on a transparent PNG that ffmpeg lays on
 * top of a clip (see scripts/make-ad-video.sh).
 *
 * Why a forward claim rather than today's number. Meta freezes an uploaded
 * asset, so "87 today" is wrong by tomorrow and there is no re-scrape to fix
 * it. "Hits 87 this week" is a claim about a window that is still open when
 * someone sees it, and it comes from the same 14-day outlook the spot page
 * renders rather than from a copywriter. It still wants a human glance before
 * it runs, which is the point of printing the day and the species too.
 *
 *   GET /api/ad-overlay/<slug>?format=4x5|1x1|9x16
 *
 * The bottom scrim is not decoration. Footage is arbitrary and white text over
 * a bright sky is unreadable, so the gradient guarantees contrast no matter
 * what is underneath.
 */

const FORMATS = {
  '4x5': { width: 1080, height: 1350 },
  '1x1': { width: 1080, height: 1080 },
  '9x16': { width: 1080, height: 1920 },
} as const

type FormatKey = keyof typeof FORMATS

function isFormat(v: string | null): v is FormatKey {
  return v === '4x5' || v === '1x1' || v === '9x16'
}

/** Days 0..6 of the outlook, which is the week the ad is promising. */
const WEEK = 7

const DOW_FULL: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
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
  if (!page) return new Response('No such spot', { status: 404 })

  const name = page.spot.name
  const region = page.spot.region ? provinceCodeFromName(page.spot.region) : null
  const where = [page.spot.city, region].filter(Boolean).join(', ')

  // Best day in the next week, and what makes it. Null entries are days with no
  // score at all; skipping them is right, because a missing day is not a zero.
  const outlook = await fetchSpotsOutlook14d({ spotIds: [page.spot.id] }).catch(
    () => null,
  )
  const series = outlook?.by_spot?.[page.spot.id]?.slice(0, WEEK) ?? []

  // A plain loop rather than forEach: TypeScript cannot see that a callback
  // reassigns `peak`, so it narrows the binding to `null` and every read below
  // becomes an error on `never`.
  type Peak = { score: number; dow: string; species: string | null }
  let peak: Peak | null = null
  for (let i = 0; i < series.length; i += 1) {
    const day = series[i]
    if (!day || typeof day.score !== 'number') continue
    if (peak && day.score <= peak.score) continue
    const speciesName = outlook?.species?.[day.species_id]?.name
    peak = {
      score: Math.round(day.score),
      dow: DOW_FULL[outlook?.days?.[i]?.dow ?? ''] ?? '',
      species: speciesName ? cardSpeciesName(speciesName) : null,
    }
  }

  const tall = format === '9x16'
  // Stories put platform UI over the top and bottom fifths, so the copy sits
  // further in on 9:16 rather than being scaled down.
  const bottomPad = tall ? 360 : 120

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          // Transparent everywhere except the scrim below: the footage is the
          // background.
          backgroundImage: `linear-gradient(to bottom, rgba(11,16,32,0.72) 0%, rgba(11,16,32,0) 26%, rgba(11,16,32,0) 34%, rgba(11,16,32,0.92) 72%)`,
          padding: `${tall ? 300 : 90}px 90px ${bottomPad}px 90px`,
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              color: MUTED,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            {where || 'Fishing forecast'}
          </div>
          <div
            style={{
              fontSize: nameSize(name, 112),
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: '-0.03em',
            }}
          >
            {name}
          </div>

          {peak ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: BRAND,
                  borderRadius: 24,
                  padding: '10px 30px',
                  fontSize: 92,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                }}
              >
                {peak.score}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>
                  hits this week
                </div>
                <div style={{ display: 'flex', fontSize: 32, color: MUTED }}>
                  {[peak.dow, peak.species].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>
              Is it worth going this week?
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 8,
            }}
          >
            <div style={{ display: 'flex', fontSize: 32, color: MUTED }}>
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
      </div>
    ),
    { ...size },
  )
}
