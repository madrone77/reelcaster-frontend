import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  trailingSlash: false,
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
