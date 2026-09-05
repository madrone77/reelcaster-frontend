import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  trailingSlash: false,
  // Required by the /ingest rewrites below. PostHog's ingest endpoints carry a
  // trailing slash (/i/v0/e/), and with trailingSlash:false Next would answer
  // those with a 308 to the slashless path. A 308 preserves the method, so an
  // ordinary POST survives it, but the capture that matters most does not: the
  // last events of a visit go out via sendBeacon/keepalive during unload, and
  // a redirect hop there is not reliably followed. That would lose exactly the
  // events at the end of a session.
  //
  // The cost is that /plans/ no longer 308s to /plans, so both spellings now
  // render. That is an SEO duplicate, and it is already neutralised: every
  // indexable page emits a self-referencing <link rel="canonical"> (see
  // alternates.canonical throughout src/app), and middleware.ts still folds
  // mixed case to lowercase with a real 308.
  skipTrailingSlashRedirect: true,
  env: {
    // A real build timestamp for the sitemap's static entries.
    //
    // src/app/sitemap.ts is a dynamic route, so a module-scope `new Date()`
    // there is evaluated per serverless cold start, not at build — the static
    // pages' <lastmod> drifted forward by minutes every time a new instance
    // answered, claiming the copy had just changed when it hadn't. That is the
    // same always-says-now signal the file already fixed for the scored URLs.
    //
    // `env` entries are inlined at compile time, so every instance of a given
    // deployment reports the one moment that deployment's copy could have
    // changed, and the value only advances on a new build.
    BUILD_TIMESTAMP: new Date().toISOString(),
  },
  images: {
    remotePatterns: [
      // Unsplash hero images for city pages (seeded by
      // bluecaster/scripts/seed-demo-content.ts).
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async rewrites() {
    // Reverse proxy for PostHog ingestion.
    //
    // The browser posts to reelcaster.com/ingest/* and Vercel forwards it. The
    // reason is not cosmetic: requests to known analytics hostnames are blocked
    // outright by the common filter lists, and that loss is not evenly spread.
    // It skews toward the technical, ad-blocking end of the audience, which
    // means the missing rows are systematically the wrong rows to be missing.
    // This project has already been bitten once by capture that only ran where
    // nothing was blocking it, and read the resulting gap as a real signal.
    //
    // Doing it now rather than later matters more than usual, because the point
    // of this integration is to accumulate history. History gathered through a
    // hole is not repairable after the fact.
    //
    // us-assets serves the SDK's own lazily-loaded chunks (session replay,
    // surveys, the toolbar). It is a separate host from the ingest API, so it
    // needs its own rule, and that rule has to come first: /ingest/:path*
    // matches /ingest/static/... too, and the first match wins.
    const POSTHOG_ASSETS = "https://us-assets.i.posthog.com";
    const POSTHOG_API = "https://us.i.posthog.com";
    // Mixpanel gets the same treatment at /mp. It had posted straight to
    // api.mixpanel.com since the start, so a year of its history has the hole
    // described above. Two hosts again: the API for events, people and replay
    // batches, and the CDN for the session-replay recorder the SDK fetches
    // lazily. The /libs/ rule comes first for the same reason as /static/.
    const MIXPANEL_CDN = "https://cdn.mxpnl.com";
    const MIXPANEL_API = "https://api.mixpanel.com";
    return [
      { source: "/ingest/static/:path*", destination: `${POSTHOG_ASSETS}/static/:path*` },
      { source: "/ingest/:path*", destination: `${POSTHOG_API}/:path*` },
      { source: "/mp/libs/:path*", destination: `${MIXPANEL_CDN}/libs/:path*` },
      { source: "/mp/:path*", destination: `${MIXPANEL_API}/:path*` },
    ];
  },
  async redirects() {
    // /plans replaced /pricing as the sales page. Two indexable pages selling
    // the same thing split the SEO signal, so /pricing is retired with a 308
    // that passes its link equity to /plans.
    //
    // The ?plan=monthly deep link is still out in the wild — /pricing used to
    // own the only monthly purchase path and it's linked from billing emails
    // that have already been sent. Monthly isn't sold any more, so the param is
    // dropped, but the link still has to land somewhere you can buy: checkout,
    // which now has exactly one plan on it.
    return [
      {
        source: "/pricing",
        has: [{ type: "query", key: "plan", value: "monthly" }],
        destination: "/plans/checkout",
        permanent: true,
      },
      {
        source: "/pricing",
        destination: "/plans",
        permanent: true,
      },
      // The support portal shipped briefly at /theport before moving to the
      // plainer /support. "The Port" is still its name in the UI — only the
      // URL changed. Permanent, because ticket acknowledgement emails already
      // went out carrying /theport links and those must keep working.
      { source: "/theport", destination: "/support", permanent: true },
      { source: "/theport/:path*", destination: "/support/:path*", permanent: true },
      // /lp/seattle/1 is retired in favour of /lp/seattle/5: the same shell,
      // copy and ask, with the where/what/when screenshot rendered live and
      // the day chart kept as a fourth band. The Seattle ads still point at
      // /1 and re-pointing them in Meta restarts their learning, so the edge
      // sends the click on instead. Temporary (307) on purpose: nobody should
      // cache the hop, and removing this row puts /1 back the moment it is
      // wanted. The query string rides along, so utm_* and ?a= survive, and
      // the request that follows the hop is the one middleware counts and
      // stamps, so the visit is recorded under lpseattle5 with first touch
      // intact. Bots are redirected too, so an ad network's link preview
      // shows the page people actually see.
      //
      // Not a row in src/lib/lp-splits.ts because this is not a test: there
      // is no control arm to hold anyone in, and a cookie would be pure cost.
      { source: "/lp/seattle/1", destination: "/lp/seattle/5", permanent: false },
      // The licence guide canonicalises on the Canadian "licence", matching DFO
      // and gov.bc.ca — the sources it quotes. Plenty of people type the
      // American "license", including British Columbians, so that spelling is
      // routed in rather than 404ing. One indexable copy, one canonical.
      //
      // The two bare-segment rules MUST precede the wildcard: `:path*` matches
      // zero segments too, so an earlier wildcard would swallow
      // /fishing-license and send it on a pointless second hop through
      // /fishing-licence. Most specific first.
      //
      // Truncating to the bare segment is a natural thing to try, and BC is the
      // only jurisdiction on it today — hence temporary. When Washington lands
      // this becomes a real index page and both rules go.
      // The three retired notification surfaces. These were page-level
      // `permanentRedirect()` stubs, which does NOT produce a 308 when the
      // route is `dynamic = 'force-static'`: Next bakes the redirect into the
      // prerendered RSC payload, so a browser follows it on hydration while
      // curl and any crawler get a 200 and a 40KB app shell. The old e2e test
      // asserted "308" in its name but only ever checked `page.waitForURL`,
      // which a client-side redirect satisfies, so nothing caught it.
      //
      // Here they are real edge redirects that render nothing at all.
      // /settings/preferences held a default-location card nothing read and a
      // digest that never sent; the hub is the honest landing because what
      // someone wanted there could have been Account, Units, or Alerts.
      { source: "/settings/preferences", destination: "/profile", permanent: true },
      { source: "/profile/forecast-emails", destination: "/alerts", permanent: true },
      { source: "/profile/notification-settings", destination: "/alerts", permanent: true },
      { source: "/fishing-licence", destination: "/fishing-licence/bc", permanent: false },
      { source: "/fishing-license", destination: "/fishing-licence/bc", permanent: false },
      {
        source: "/fishing-license/:path*",
        destination: "/fishing-licence/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Long-cache the static map assets the Explore relief style fetches (glyph
    // fonts + the place-label GeoJSON). The relief/contour/land tiles set their
    // own immutable cache in the /api/map/tiles proxy.
    const ASSET_CACHE = [
      { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
    ];
    return [
      { source: "/fonts/:path*", headers: ASSET_CACHE },
      { source: "/:file.geojson", headers: ASSET_CACHE },
    ];
  },
};

// Opt-in bundle report: `ANALYZE=true npx next build` writes
// .next/analyze/client.html. Off by default, so a normal build is unaffected.
// Kept in the repo because "which package is in the chunks /explore has to
// parse before it can hydrate" is not a question you can answer by reading
// minified output, and it is the question worth re-asking before adding a
// dependency to a client route.
export default bundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(
  nextConfig,
);
