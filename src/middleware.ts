import { NextResponse, type NextRequest } from 'next/server'

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
  matcher: ['/((?!_next/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
}
