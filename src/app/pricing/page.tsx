import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import PricingActions from "@/app/components/pricing/pricing-actions";
import PricingFeatureCallout from "@/app/components/pricing/pricing-feature-callout";
import { ANNUAL_PRICE_CENTS, MONTHLY_PRICE_CENTS } from "@/lib/pricing";

const SITE_URL = "https://reelcaster.com";

export const metadata: Metadata = {
  title: "Pro Intel Pricing | ReelCaster",
  description:
    "Unlock 14-day forecasts, unlimited alerts, and custom spot profiles. $5/month or $33/year.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pro Intel Pricing | ReelCaster",
    description:
      "Unlock 14-day forecasts, unlimited alerts, and custom spot profiles.",
    url: `${SITE_URL}/pricing`,
    siteName: "ReelCaster",
    type: "website",
    locale: "en_CA",
  },
  robots: { index: true, follow: true },
};

const PLAN_FEATURES = [
  "14-day hourly forecasts",
  "Unlimited custom alerts (email + SMS)",
  "Custom spot profiles with full enrichment",
  "Priority during emerging hot bites",
  "Cancel anytime",
];

// Vercel sets x-vercel-ip-country-region (e.g. "BC", "WA", "OR") and x-vercel-ip-country
// (e.g. "CA", "US"). Mapping is best-effort — the user can always override in the modal.
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
  const monthlyDollars = MONTHLY_PRICE_CENTS / 100;
  const annualDollars = ANNUAL_PRICE_CENTS / 100;
  const annualSavings = 12 * monthlyDollars - annualDollars;

  return (
    <article>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10 md:pt-20 md:pb-14">
        <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
          ReelCaster Pro Intel
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-[-0.02em] text-rc-ink mb-5">
          Pricing
        </h1>
        <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-ink-soft">
          Pro Intel unlocks the full 14-day forecast, unlimited alerts, and
          custom spot profiles. ${monthlyDollars} a month, or ${annualDollars} a
          year — save ${annualSavings} with the Season Pass.
        </p>

        <PricingActions defaultRegion={defaultRegion} />
      </section>

      <PricingFeatureCallout />

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Annual */}
          <div className="bg-rc-panel border-2 border-rc-brand rounded-md shadow-rc-panel p-6 md:p-8 relative">
            <span className="absolute -top-3 left-6 px-2 py-0.5 text-[10px] font-rc-mono tracking-[0.14em] uppercase rounded-full bg-rc-good-bg text-rc-good-ink border border-rc-good-border">
              Best value
            </span>
            <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute mb-2">
              Season Pass
            </p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-black text-rc-ink">
                ${annualDollars}
              </span>
              <span className="text-sm text-rc-ink-mute">/ year</span>
            </div>
            <p className="text-sm text-rc-ink-soft mb-5">
              365 days from purchase. Costs less than seven monthly payments —
              save ${annualSavings} over the year.
            </p>
            <ul className="space-y-2 text-sm text-rc-ink-soft">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-rc-good mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Monthly */}
          <div className="bg-rc-panel border border-rc-rule rounded-md p-6 md:p-8">
            <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute mb-2">
              Monthly
            </p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-black text-rc-ink">
                ${monthlyDollars}
              </span>
              <span className="text-sm text-rc-ink-mute">/ month</span>
            </div>
            <p className="text-sm text-rc-ink-soft mb-5">
              One flat rate, all year round. Cancel any time.
            </p>
            <ul className="space-y-2 text-sm text-rc-ink-soft">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-rc-good mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Coverage note */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-rc-surface border border-rc-rule rounded-lg p-5 text-sm text-rc-ink-soft">
          Pro Intel is sold only in covered regions: <strong className="text-rc-ink">British
          Columbia</strong>, <strong className="text-rc-ink">Washington</strong>, and{" "}
          <strong className="text-rc-ink">Oregon</strong>. If you fish elsewhere,{" "}
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
