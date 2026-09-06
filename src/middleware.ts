import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import {
  ENTRY_COOKIE,
  ENTRY_MAX_AGE,
  PAID_COOKIE,
  PAID_MAX_AGE,
  buildEntry,
  buildPaid,
} from '@/lib/attribution'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  resolveSession,
  serializeSession,
} from '@/lib/paywall-session'
import { classifyUserAgent, isBotUserAgent } from '@/lib/device'
import { readEdgeGeo } from '@/lib/edge-geo'
import { classifyPage, classifySource } from '@/lib/traffic-source'
import { pacificDay } from '@/lib/pacific-day'
import { newFishingPath } from '@/lib/legacy-fishing-paths'
import { isSpotPath } from '@/lib/paths'
import { isMetaLpArrival, metaLpDestination } from '@/lib/meta-lp-hop'
import {
  CONTROL_ARM,
  LP_SPLIT_COOKIE,
  LP_SPLIT_COOKIE_MAX_AGE,
  TREATMENT_ARM,
  metaSplit,
  parseLpSplitCookie,
  resolveLpArm,
  serializeLpSplitArms,
  splitForPath,
  type LpArm,
} from '@/lib/lp-splits'

// Legacy coming-soon wall, now scoped to nothing.
//
// This used to rewrite every non-allow-listed path to /coming-soon. As surfaces
// launched, the allow list grew to cover EVERY route the app actually has
// (`/`, /explore, /fishing, /pricing, /login, /signup, /auth, /billing,
// /profile, /alerts, /favorites, /dashboard, /catches, /log-catch,
// /notifications, and the marketing + legal pages). The wall therefore stopped
// gating anything real — its only surviving effect was to answer nonexistent
// URLs with a rewritten /coming-soon body at HTTP **200**.
//
// That is a soft 404: every typo, stale inbound link, and scraped bad URL told
// crawlers "this page exists and is fine" while showing them a holding page.
// Unmatched paths now fall through to Next's own routing, which pairs
// src/app/not-found.tsx with a real 404 status.
//
// To wall a future surface, add its prefix to WALLED_PREFIXES — an explicit
// opt-in list, so it can never silently swallow 404s again.
const WALLED_PREFIXES: string[] = []

/**
 * Is this request a person arriving at a page?
 *
 * Attribution is written here, on the edge, and the edge sees far more than
 * navigations: RSC payload fetches, router prefetches, and the odd
 * same-origin data request all pass through this matcher. Writing first touch
 * from any of those is worse than writing nothing, because rc_entry is
 * write-once: a link the visitor never followed, prefetched while they read
 * the page they are actually on, would claim the credit for ninety days and
 * lock the real landing page out.
 *
 * `sec-fetch-dest` answers this directly and is present on every browser we
 * care about. The accept-header fallback is for the few that are not, and for
 * local curl during development.
 */
function isPageView(req: NextRequest): boolean {
  if (req.headers.get('rsc')) return false
  if (req.headers.get('next-router-prefetch')) return false
  const purpose = req.headers.get('sec-purpose') ?? req.headers.get('purpose') ?? ''
  if (purpose.includes('prefetch')) return false
  const dest = req.headers.get('sec-fetch-dest')
  if (dest) return dest === 'document'
  return (req.headers.get('accept') ?? '').includes('text/html')
}

/**
 * Write first touch and paid touch from the request itself, before any of our
 * JavaScript has reached the browser.
 *
 * This used to be client-only, in a useEffect (src/lib/attribution.ts), and
 * the cost of that showed up in the numbers: half the trials we have taken
 * arrived with no campaign on them at all. Every reason for that is a browser
 * that never ran the effect with the ad's query string still in front of it —
 * storage blocked, an in-app webview, a bounce before hydration, a script
 * error somewhere else on the page. The request, by contrast, always carries
 * the URL the ad was pointed at and the referrer that sent it, and it carries
 * them on the very first byte.
 *
 * The client code stays as the backstop rather than being removed. It sees one
 * case this cannot: a visitor whose first page is a client-side navigation off
 * a link someone else's page prefetched.
 *
 * Both halves write the SAME cookie shape, so nothing downstream has to know
 * or care which one got there first. `NextResponse.cookies.set` URL-encodes
 * the value exactly as `document.cookie` does in src/lib/cookies.ts.
 */
function stampAttribution(req: NextRequest, res: NextResponse): NextResponse {
  if (!isPageView(req)) return res

  const { pathname, search } = req.nextUrl
  const options = {
    path: '/',
    sameSite: 'lax' as const,
    secure: req.nextUrl.protocol === 'https:',
  }

  // First touch is write-once, so an existing cookie always wins. Note this
  // reads the REQUEST jar: a cookie set on an earlier response is already
  // here, and a second write in the same visit is impossible.
  if (!req.cookies.has(ENTRY_COOKIE)) {
    const entry = buildEntry({
      pathname,
      search,
      referrer: req.headers.get('referer') ?? '',
      host: req.nextUrl.host,
    })
    if (entry) {
      res.cookies.set(ENTRY_COOKIE, JSON.stringify(entry), {
        ...options,
        maxAge: ENTRY_MAX_AGE,
      })
    }
  }

  // Paid touch overwrites, because the newest bought click is the one that
  // closed the sale. It writes only on a URL that carries a marker, so the
  // organic pages in between leave the record alone.
  const paid = buildPaid({ pathname, search })
  if (paid) {
    res.cookies.set(PAID_COOKIE, JSON.stringify(paid), {
      ...options,
      maxAge: PAID_MAX_AGE,
    })
  }

  // The visit id that lets a wall shown three times to one undecided reader be
  // read as one reader. Re-set on every page view, which is what makes the
  // 30-minute window idle-based rather than fixed; `resolveSession` replaces it
  // outright once it passes the absolute cap, so rolling it cannot turn it into
  // a durable identifier for this browser. See src/lib/paywall-session.ts.
  const session = resolveSession(req.cookies.get(SESSION_COOKIE)?.value)
  res.cookies.set(SESSION_COOKIE, serializeSession(session), {
    ...options,
    maxAge: SESSION_MAX_AGE,
  })

  return res
}

/**
 * Count one page view into `traffic_events_daily`.
 *
 * WHY THIS RUNS HERE AND NOT IN A BEACON. The campaign counter that already
 * exists is client-side, so an ad-blocked or no-JavaScript reader never reaches
 * it. That is a tolerable bias when measuring a bought click, because the ad
 * network reports its own click count as a cross-check. It is not tolerable for
 * organic search traffic, which is the population most likely to be running a
 * blocker and the population this table exists to see. Counting here, off the
 * request, is the same move the attribution cookies above made for the same
 * reason.
 *
 * WHAT IT COSTS. Middleware does not get crawler filtering for free the way a
 * script tag does. Two guards stand in. `isBotUserAgent` drops the
 * self-declaring ones, and the `sec-fetch-dest: document` test below is
 * STRICTER than `isPageView`: no accept-header fallback, because that fallback
 * exists to be generous to odd clients and here generosity means counting
 * robots. Real browsers have sent sec-fetch-dest on navigations for years; most
 * crawlers send it not at all.
 *
 * NEVER BLOCKS THE RESPONSE. The write goes out under `waitUntil`, so the
 * visitor's page is already on its way while this happens, and a failure is
 * swallowed. A counter that can make the site slow, or down, is not worth
 * having: every error path here ends in a missing row, which the admin shows as
 * a smaller number rather than an outage.
 */
function countPageView(req: NextRequest, event: NextFetchEvent): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  // Stricter than isPageView on purpose. See above.
  if (req.headers.get('sec-fetch-dest') !== 'document') return
  if (req.headers.get('rsc')) return
  if (req.headers.get('next-router-prefetch')) return

  const userAgent = req.headers.get('user-agent')
  if (isBotUserAgent(userAgent)) return

  const { pathname, search } = req.nextUrl
  const page = classifyPage(pathname)
  if (!page) return

  // The same builder the rc_paid cookie uses, so a view counted as paid here
  // and a signup credited as paid downstream cannot disagree about what paid
  // means.
  const source = classifySource({
    referrer: req.headers.get('referer') ?? '',
    selfHost: req.nextUrl.host,
    isPaid: Boolean(buildPaid({ pathname, search })),
  })

  const geo = readEdgeGeo(req.headers)
  const { device, os } = classifyUserAgent(userAgent)

  const body = JSON.stringify({
    p_day: pacificDay(),
    p_page_kind: page.kind,
    p_page_slug: page.slug,
    p_source_kind: source.kind,
    p_referrer_host: source.host,
    p_geo_country: geo.country ?? '',
    p_geo_region: geo.region ?? '',
    p_device: device,
    p_os: os,
  })

  // PostgREST directly rather than through an API route of our own. A route
  // would have to be told the visitor's geo and User-Agent by us, since its own
  // request headers would describe this server rather than the reader, and a
  // route that trusts a caller's description of the visitor needs a shared
  // secret to stop anyone else describing one. One hop and no new secret beats
  // two hops and a secret that can silently go unset.
  event.waitUntil(
    fetch(`${url}/rest/v1/rpc/bump_traffic_counter`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: key,
        authorization: `Bearer ${key}`,
      },
      body,
    }).catch(() => {
      // A counter is never worth an error page. See the doc comment.
    }),
  )
}

/**
 * Remember which arm of a landing split this browser is in.
 *
 * Written only when the membership changed, so a visitor already in an arm
 * gets no Set-Cookie on every page of their visit. httpOnly, because nothing
 * in the browser needs to read it: the page a visitor is on IS their arm.
 */
function withLpArms(
  req: NextRequest,
  res: NextResponse,
  arms: string | null,
): NextResponse {
  if (arms === null) return res
  res.cookies.set(LP_SPLIT_COOKIE, arms, {
    path: '/',
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    httpOnly: true,
    maxAge: LP_SPLIT_COOKIE_MAX_AGE,
  })
  return res
}

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl

  // Fold mixed-case paths onto their lowercase form.
  //
  // Vercel compiles Next's DYNAMIC routes to case-insensitive regexes, so every
  // dynamic page answered 200 at any casing of its static segments —
  // /Fishing/BC/victoria-bc, /EXPLORE/spot/constance-bank-7615cc, and so on for
  // each of the 80 spot/city/province URLs. Static routes are matched off the
  // filesystem and stayed case-sensitive (/About 404s), so the site served two
  // different duplicate-URL policies depending on the route type.
  //
  // Each variant carried a self-referencing lowercase canonical, which is a
  // hint rather than a directive — a crawler still has to fetch every casing it
  // finds before it can honour one. A 308 settles it at the edge and gives the
  // odd-cased inbound link somewhere permanent to point.
  //
  // Safe to apply to every matched path: all route segments and all spot slugs
  // are lowercase, and the matcher below already skips anything with a dot in
  // it (the only uppercase assets are the /fonts/Open Sans Semibold/*.pbf glyph
  // ranges the Explore map fetches).
  if (pathname !== pathname.toLowerCase()) {
    const url = req.nextUrl.clone()
    url.pathname = pathname.toLowerCase()
    return NextResponse.redirect(url, 308)
  }

  // The retired /fishing/<province>/... URLs.
  //
  // Above countPageView on purpose, for the same reason the lowercase fold is:
  // a redirected request and the request that follows it are one visit, and
  // counting both would double every legacy hit in traffic_events_daily.
  //
  // These are derived rather than looked up, so this costs no data at the edge.
  // See lib/legacy-fishing-paths.ts for why that is safe and when it stops
  // being safe. The spot page is not here: it carries no city, so it needs the
  // hierarchy and lives as a route instead.
  const movedFishingPath = newFishingPath(pathname)
  if (movedFishingPath) {
    const url = req.nextUrl.clone()
    url.pathname = movedFishingPath
    return NextResponse.redirect(url, 308)
  }

  // The arm memberships this browser already holds, and whether they need
  // writing back. Both landing splits below read and extend the same jar, so
  // one cannot overwrite the other's fresh assignment.
  let lpArms = parseLpSplitCookie(req.cookies.get(LP_SPLIT_COOKIE)?.value)
  let pendingLpArms: string | null = null
  const isPerson = !isBotUserAgent(req.headers.get('user-agent'))

  // Meta traffic on a landing page: the city's /5 page, or the ad-framed map.
  //
  // The Meta ads keep pointing at /lp pages (re-pointing an ad restarts its
  // learning); the edge decides what the click reads. Half are sent on to
  // `/explore?loc=<city>&ad=day2`, the same href the landing pages' own CTA
  // carries; the other half read the city's /5 landing page (a click on
  // /lp/vancouver/4 is sent to /lp/vancouver/5 first). Google traffic falls
  // through and reads the page. Above the page split and above the
  // page-view count for the same reason the page split is: the request that
  // follows the 307 is the one counted and stamped, and a Meta visitor must
  // not be dealt a page-split arm for a page they never see. Only a person
  // arriving at a page is hopped; prefetches and RSC fetches pass through.
  // A self-declaring crawler is dealt the control and no cookie, so Meta's
  // link preview is the /5 landing page. See src/lib/meta-lp-hop.ts for the
  // destinations and src/lib/lp-splits.ts for the share.
  if (req.method === 'GET' && isPageView(req)) {
    const arrival = {
      pathname,
      search: req.nextUrl.search,
      referrer: req.headers.get('referer') ?? '',
    }
    const meta = metaSplit()
    let arm: LpArm = CONTROL_ARM
    if (meta && isPerson && isMetaLpArrival(arrival)) {
      const resolved = resolveLpArm(meta, lpArms, Math.random())
      lpArms = resolved.arms
      if (resolved.changed) pendingLpArms = serializeLpSplitArms(resolved.arms)
      arm = resolved.arm
    }
    const hop = meta ? metaLpDestination({ ...arrival, arm }) : null
    if (hop) {
      const url = req.nextUrl.clone()
      const [hopPath, hopQuery = ''] = hop.split('?')
      url.pathname = hopPath
      url.search = hopQuery ? `?${hopQuery}` : ''
      return withLpArms(req, NextResponse.redirect(url, 307), pendingLpArms)
    }
  }

  // A whole-page landing split: the ad points at the control, and a share of
  // the people who click it are sent on to the treatment instead.
  //
  // Decided HERE, above the page-view count and returned as a redirect rather
  // than stamped, on purpose: the request that follows the 307 is the one
  // that gets counted and gets the first-touch cookie, so a split visit is
  // counted once and every record names the page the visitor actually saw.
  // The query string rides along untouched, because the click id and the UTM
  // fields on it are the only attribution the visit has.
  //
  // Only a person arriving at a page is split. Prefetches and RSC fetches
  // pass straight through (isPageView), and a self-declaring crawler always
  // gets the control, so an ad network's link preview is stable. The arm is
  // held in a cookie so a return visit lands on the same page. See
  // src/lib/lp-splits.ts for the table, and for why this is not the
  // registry-driven split-test system.
  const lpSplit = splitForPath(pathname)
  if (lpSplit && req.method === 'GET' && isPageView(req) && isPerson) {
    const resolved = resolveLpArm(lpSplit, lpArms, Math.random())
    lpArms = resolved.arms
    if (resolved.changed) pendingLpArms = serializeLpSplitArms(resolved.arms)
    if (resolved.arm === TREATMENT_ARM) {
      const url = req.nextUrl.clone()
      url.pathname = lpSplit.treatment
      return withLpArms(req, NextResponse.redirect(url, 307), pendingLpArms)
    }
  }

  // Counted here rather than at the top of this function, so a mixed-case URL
  // is counted once on the lowercase request the browser follows the 308 to,
  // not twice.
  countPageView(req, event)

  // Paid traffic on a spot page renders the ad frame at ./ad — same payload,
  // same components, no navigation out and the trial ask inline. See
  // src/lib/ad-mode.ts.
  //
  // A rewrite rather than a branch inside the page, because reading
  // `searchParams` in the spot page would opt that route out of
  // static generation for every visitor, organic ones included, and the
  // prerender is what puts its <title> and canonical in <head> rather than
  // streaming them into the body.
  //
  // The URL the visitor sees is unchanged, which is the point: the ad points at
  // the real spot page, and the frame is our business rather than something the
  // reader is made to look at in their address bar.
  //
  // Matched on the spot route's new home. The legacy /explore/spot/<slug> is a
  // redirect now, and a rewrite there would frame a page that is about to
  // 308 anyway; the ?ad= query survives the redirect, so an ad click on an old
  // link still lands framed, one hop later.
  if (
    isSpotPath(pathname) &&
    !pathname.endsWith('/ad') &&
    req.nextUrl.searchParams.has('ad')
  ) {
    const url = req.nextUrl.clone()
    url.pathname = `${pathname.replace(/\/$/, '')}/ad`
    // Stamped, not skipped: this IS the ad landing, and its query string is
    // the only place the click id will ever appear.
    return stampAttribution(req, NextResponse.rewrite(url))
  }

  const walled = WALLED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
  if (!walled) {
    return withLpArms(req, stampAttribution(req, NextResponse.next()), pendingLpArms)
  }

  const url = req.nextUrl.clone()
  url.pathname = '/coming-soon'
  return withLpArms(req, stampAttribution(req, NextResponse.rewrite(url)), pendingLpArms)
}

export const config = {
  // Skip Next internals and static assets (any path containing a dot).
  //
  // /ingest is the PostHog reverse proxy and /mp the Mixpanel one (see
  // next.config.ts rewrites). Both are excluded for three reasons: analytics beacons should not each pay for an
  // edge invocation, the lowercase 308 above would rewrite paths this file has
  // no business touching, and countPageView must never see them. That last one
  // holds today only because it demands sec-fetch-dest: document, which an XHR
  // beacon is not. Relying on that would make traffic_events_daily one header
  // change away from counting every analytics POST as an organic pageview.
  matcher: ['/((?!_next/|ingest/|mp/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
}
