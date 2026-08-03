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
        // Only paths that must never be FETCHED belong here.
        //
        // This list used to also carry the signed-in surfaces — /profile/,
        // /alerts, /notifications, /support, /dashboard, /favorites,
        // /log-catch, /catches, /coming-soon. That combination is
        // self-defeating: Disallow stops crawling, not indexing, so a
        // disallowed URL that something links to can still be listed (as a
        // bare URL with no snippet), and because Google is blocked from
        // fetching it, it can never read the `noindex` that would say
        // otherwise. The homepage links to /dashboard, /catches, /log-catch,
        // /notifications and /favorites, so those links were live all along.
        //
        // Every one of those routes now carries `robots: { index: false }` on
        // the page or its layout, which is the directive that actually
        // removes a URL. Letting the crawler fetch them is what makes it work.
        disallow: [
          // API responses are not documents; there is no page-level directive
          // to serve, so blocking the fetch is the only lever.
          "/api/",
          // Auth and billing callbacks carry one-time tokens and codes in the
          // URL. Keep crawlers off them entirely.
          "/auth/",
          "/billing/",
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
