export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/plans",
          "/login",
          "/signup",
          "/explore",
          "/fishing",
          "/privacy",
          "/terms",
          "/contact",
          "/about",
          "/faq",
        ],
        disallow: [
          "/api/",
          "/profile/",
          "/alerts",
          "/billing/",
          "/notifications",
        ],
      },
    ],
    sitemap: "https://reelcaster.com/sitemap.xml",
  };
}
