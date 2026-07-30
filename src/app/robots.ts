import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// The previous `allow` list enumerated the public routes, which reads as
// coverage but does nothing — `Allow: /` already permits them, and a path
// missing from the list was never actually blocked. Only `disallow` does work,
// so that is all this declares.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Endpoints and account surfaces — nothing indexable, and crawling
          // them burns budget that belongs to spot and city pages.
          "/api/",
          "/auth/",
          "/profile/",
          "/alerts",
          "/billing/",
          "/notifications",
          "/support",
          "/dashboard",
          "/favorites",
          "/log-catch",
          "/catches",
          "/coming-soon",
        ],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    // No `host:` directive — it is a Yandex-only extension that Google ignores,
    // and Next renders it from a full URL, which emits a trailing slash a bare
    // hostname should not have. The canonical host is asserted where it counts:
    // the per-page <link rel="canonical"> and every sitemap <loc>.
  };
}
