const SITE = "https://reelcaster.com";

export default function sitemap() {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly" as const, priority: 1.0 },
    { url: `${SITE}/pricing`, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${SITE}/faq`, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${SITE}/contact`, changeFrequency: "monthly" as const, priority: 0.4 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly" as const, priority: 0.3 },
    { url: `${SITE}/terms`, changeFrequency: "yearly" as const, priority: 0.3 },
  ];
}
