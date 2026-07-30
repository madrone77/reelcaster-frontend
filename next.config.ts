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
  async redirects() {
    return [
      // The support portal shipped briefly at /theport before moving to the
      // plainer /support. "The Port" is still its name in the UI — only the
      // URL changed. Permanent, because ticket acknowledgement emails already
      // went out carrying /theport links and those must keep working.
      { source: "/theport", destination: "/support", permanent: true },
      { source: "/theport/:path*", destination: "/support/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
