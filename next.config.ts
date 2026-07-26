import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false,
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
    // The ?plan=monthly deep link has to keep working — /pricing used to own
    // the only monthly purchase path, and it's linked from the billing emails
    // and the yearly/monthly switch. It lands on the checkout page directly.
    return [
      {
        source: "/pricing",
        has: [{ type: "query", key: "plan", value: "monthly" }],
        destination: "/plans/checkout?plan=monthly",
        permanent: true,
      },
      {
        source: "/pricing",
        destination: "/plans",
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

export default nextConfig;
