export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/fishing/"],
        disallow: ["/admin/", "/api/", "/profile/"],
      },
    ],
    sitemap: "https://reelcaster.com/sitemap.xml",
  };
}
