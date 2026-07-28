import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import PricingCard from "@/app/components/pricing/pricing-card";
import PricingFeatureCallout from "@/app/components/pricing/pricing-feature-callout";
import {
  ANNUAL_PRICE_CENTS,
  MONTHLY_PRICE_CENTS,
  annualDiscount,
} from "@/lib/pricing";
import { breadcrumbJsonLd, DEFAULT_OG, SITE_NAME, SITE_URL, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pro Pricing",
  description:
    "ReelCaster Pro is $5/month or $33/year (45% off). Unlock 14-day forecasts, custom alerts, and custom spot profiles.",
  alternates: { canonical: siteUrl("/pricing") },
  openGraph: {
    title: "Pricing | ReelCaster",
    description:
      "$5/month or $33/year (45% off) — 14-day forecasts, custom alerts, and spot profiles.",
    url: siteUrl("/pricing"),
    type: "website",
    ...DEFAULT_OG,
  },
  robots: { index: true, follow: true },
};

function dollars(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

// Product + Offer. The page states two real prices, so this is the markup that
// lets a result carry them. Billing is dual-currency — BC pays CAD, WA/OR pay
// USD (same numbers) — so each plan carries one offer per currency, and each
// offer's `eligibleRegion` names only the regions that currency is sold in.
// The markup can't promise a price/region pairing the checkout would refuse.
//
// Prices come from the same `@/lib/pricing` constants the visible cards render
// — the markup and the page can never disagree.
const CAD_REGIONS = [
  { "@type": "AdministrativeArea", name: "British Columbia" },
];
const USD_REGIONS = [
  { "@type": "AdministrativeArea", name: "Washington" },
  { "@type": "AdministrativeArea", name: "Oregon" },
];

function proOffer(plan: "Monthly" | "Annual", currency: "CAD" | "USD") {
  const cents = plan === "Monthly" ? MONTHLY_PRICE_CENTS : ANNUAL_PRICE_CENTS;
  return {
    "@type": "Offer",
    name: `ReelCaster Pro — ${plan} (${currency})`,
    price: (cents / 100).toFixed(2),
    priceCurrency: currency,
    availability: "https://schema.org/InStock",
    url: siteUrl("/pricing"),
    seller: { "@id": `${SITE_URL}/#organization` },
    eligibleRegion: currency === "CAD" ? CAD_REGIONS : USD_REGIONS,
  };
}

const PRICING_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "ReelCaster Pro",
  description:
    "Full 14-day fishing forecasts, custom score alerts, and custom spot profiles for the BC, Washington, and Oregon coasts.",
  brand: { "@type": "Brand", name: SITE_NAME },
  url: siteUrl("/pricing"),
  category: "Fishing forecast subscription",
  offers: [
    proOffer("Monthly", "CAD"),
    proOffer("Monthly", "USD"),
    proOffer("Annual", "CAD"),
    proOffer("Annual", "USD"),
  ],
};

const PRICING_BREADCRUMBS = breadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "Pricing", path: "/pricing" },
]);

// Vercel sets x-vercel-ip-country-region (e.g. "BC", "WA", "OR"). Best-effort —
// the user can always override in the checkout modal.
async function detectRegion(): Promise<string | null> {
  const h = await headers();
  const region = h.get("x-vercel-ip-country-region");
  if (region) {
    const r = region.toUpperCase();
    if (r === "BC" || r === "WA" || r === "OR") return r;
  }
  return null;
}

export default async function PricingPage() {
  const defaultRegion = await detectRegion();
  const { pct } = annualDiscount();

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PRICING_JSONLD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(PRICING_BREADCRUMBS),
        }}
      />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10 md:pt-20 md:pb-14">
        <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
          ReelCaster Pro
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-[-0.02em] text-rc-ink mb-5">
          One plan. {dollars(MONTHLY_PRICE_CENTS)} a month.
        </h1>
        <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-ink-soft">
          Everything in Pro — the full 14-day forecast, custom alerts, and
          custom spot profiles — for {dollars(MONTHLY_PRICE_CENTS)} a month,
          or {dollars(ANNUAL_PRICE_CENTS)} a year and save {pct}%.
        </p>

        <PricingCard defaultRegion={defaultRegion} />
      </section>

      <PricingFeatureCallout />

      {/* Coverage note */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-rc-surface border border-rc-rule rounded-lg p-5 text-sm text-rc-ink-soft">
          Pro is sold only in covered regions:{" "}
          <strong className="text-rc-ink">British Columbia</strong>,{" "}
          <strong className="text-rc-ink">Washington</strong>, and{" "}
          <strong className="text-rc-ink">Oregon</strong>. Prices are in CAD
          for Canada and USD for the US. If you fish elsewhere,{" "}
          <Link
            href="/explore"
            className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
          >
            drop a waitlist pin
          </Link>{" "}
          to vote for your region.
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-rc-rule text-center">
        <p className="text-xs text-rc-ink-mute">
          Data provided by ReelCaster. Regulations are reference only &mdash;
          always verify with DFO. Billing handled by Stripe.
        </p>
      </footer>
    </article>
  );
}

// Disable static generation so headers() can read the request-time IP geo.
export const dynamic = "force-dynamic";
