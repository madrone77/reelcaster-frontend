export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/pricing",
          "/login",
          "/signup",
          "/explore",
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
