import { NextResponse, type NextRequest } from 'next/server'
import {
  isLandingHost,
  isLandingPath,
  landingDoorwayVariant,
} from '@/lib/landing-host'
import {
  forwardedQuery,
  resolveLpCity,
  DEFAULT_LP_CITY,
  LP_FALLBACK_CITY,
  type LpSearchParams,
} from '@/lib/lp-routing'
import { SITE_URL } from '@/lib/site'

/**
 * What crawlers are told on the landing host.
 *
 * Adding try.reelcaster.com as an alias on this project makes every route the
 * app has answer on a second hostname, which is a duplicate copy of the whole
 * site unless something says otherwise. The redirect below removes the copy;
 * this removes any reason to go looking for it in the first place.
 *
 * `Disallow: /` rather than a per-path list, because nothing on this host is
 * ever meant to be a search result: the landing pages are paid-traffic-only
 * and already carry `noindex`, and everything else here is a redirect to www.
 *
 * Served from middleware instead of teaching src/app/robots.ts about the host,
 * which would make robots.txt a per-request render on www to answer a question
 * only this host asks.
 */
const LANDING_ROBOTS = 'User-agent: *\nDisallow: /\n'

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

export function middleware(req: NextRequest) {
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

  // ── try.reelcaster.com, the paid-traffic host ──────────────────────────
  //
  // It is an alias on this same project, so the whole app resolves here and
  // has to be cut back to the landing pages deliberately. See
  // src/lib/landing-host.ts for what the host is and, more usefully, what it
  // is not.
  //
  // Placed after the lowercase fold so every rule below only ever sees a
  // lowercase path, which is what the landing patterns are written against.
  if (isLandingHost(req.headers.get('host'))) {
    if (pathname === '/robots.txt') {
      return new NextResponse(LANDING_ROBOTS, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    // The long form still resolves, because links get pasted and an ad can be
    // built by hand. 308 rather than serve it: two URLs for one page on a host
    // whose only job is to be a clean URL is a small contradiction worth
    // spending a redirect on, and it is off the hot path (the generated links
    // and the doorway redirect both emit the short form already).
    if (pathname === '/lp' || pathname.startsWith('/lp/')) {
      const url = req.nextUrl.clone()
      url.pathname = pathname.slice('/lp'.length) || '/'
      return NextResponse.redirect(url, 308)
    }

    // The doorway hop, answered here rather than by /lp/<variant>/page.tsx.
    //
    // NOT an optimisation, though it is one (a redirect with no render at all,
    // on the one navigation every ad click makes). A `redirect()` raised inside
    // a REWRITTEN request never reaches the browser as a 307: Next serialises
    // it into the RSC payload and answers 200, so the reader gets an empty
    // document and, at best, a client-side hop once the payload is parsed.
    // Both middleware rewrites and next.config rewrites behave this way, which
    // is why the doorway is answered before the rewrite instead of behind it.
    //
    // The city resolution is the doorway page's own, imported rather than
    // restated. See src/lib/lp-routing.ts.
    const doorway = landingDoorwayVariant(pathname)
    if (doorway) {
      // Not `Object.fromEntries(...entries())`, which keeps only the last of
      // a repeated key and would quietly drop half of `?a=x&a=y`. The page's
      // own resolver accepts an array, so hand it one and let the two hosts
      // agree on what a malformed link means.
      const sp: LpSearchParams = {}
      for (const key of new Set(req.nextUrl.searchParams.keys())) {
        const all = req.nextUrl.searchParams.getAll(key)
        sp[key] = all.length > 1 ? all : all[0]
      }
      const city = resolveLpCity(sp.city, LP_FALLBACK_CITY[doorway] ?? DEFAULT_LP_CITY)
      const url = req.nextUrl.clone()
      url.pathname = `/${doorway}/${city}`
      url.search = forwardedQuery(sp)
      return NextResponse.redirect(url, 307)
    }

    // The short form onto the real route. A rewrite, so the reader keeps the
    // URL the ad promised and the page keeps its ISR cache entry.
    if (isLandingPath(pathname)) {
      const url = req.nextUrl.clone()
      url.pathname = `/lp${pathname}`
      return NextResponse.rewrite(url)
    }

    // The landing pages post their own telemetry and open checkout, so the API
    // has to answer here too.
    if (pathname.startsWith('/api/')) return NextResponse.next()

    // Everything else is the app, and the app has one home. This is what stops
    // the alias from being a second crawlable copy of the site, and it is why
    // a landing page's CTA can safely be a same-origin path: the navigation to
    // /plans/checkout lands on www with one hop and stays there.
    return NextResponse.redirect(new URL(pathname + req.nextUrl.search, SITE_URL), 308)
  }

  // Paid traffic on a spot page renders the ad frame at ./ad — same payload,
  // same components, no navigation out and the trial ask inline. See
  // src/app/explore/spot/[slug]/ad-mode.ts.
  //
  // A rewrite rather than a branch inside the page, because reading
  // `searchParams` in /explore/spot/[slug]/page.tsx would opt that route out of
  // static generation for every visitor, organic ones included, and the
  // prerender is what puts its <title> and canonical in <head> rather than
  // streaming them into the body.
  //
  // The URL the visitor sees is unchanged, which is the point: the ad points at
  // the real spot page, and the frame is our business rather than something the
  // reader is made to look at in their address bar.
  if (
    pathname.startsWith('/explore/spot/') &&
    !pathname.endsWith('/ad') &&
    req.nextUrl.searchParams.has('ad')
  ) {
    const url = req.nextUrl.clone()
    url.pathname = `${pathname.replace(/\/$/, '')}/ad`
    return NextResponse.rewrite(url)
  }

  const walled = WALLED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
  if (!walled) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/coming-soon'
  return NextResponse.rewrite(url)
}

export const config = {
  // Skip Next internals and static assets (any path containing a dot).
  matcher: [
    '/((?!_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
    // Both are excluded above (they contain a dot) but the landing host needs
    // to answer robots.txt itself and to send sitemap.xml back to www, so they
    // are matched back in explicitly. On www both fall straight through to
    // their routes.
    '/robots.txt',
    '/sitemap.xml',
  ],
}
