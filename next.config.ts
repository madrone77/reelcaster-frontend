import type { NextConfig } from "next";

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

export default nextConfig;
