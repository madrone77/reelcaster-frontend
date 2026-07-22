import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import PricingActions from "@/app/components/pricing/pricing-actions";
import PricingFeatureCallout from "@/app/components/pricing/pricing-feature-callout";
import { SeasonPricingGraph } from "@/app/components/pricing/season-pricing-graph";
import { MONTHLY_PRICE_TABLE, resolveMonthlyPriceCents } from "@/lib/pricing";

const SITE_URL = "https://reelcaster.com";

export const metadata: Metadata = {
  title: "Pro Pricing | ReelCaster",
  description:
    "Unlock 14-day forecasts, up to 10 custom alerts, and custom spot profiles. Monthly seasonal pricing from $5/mo or annual Season Pass.",
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: "Pro Pricing | ReelCaster",
    description:
      "Unlock 14-day forecasts, up to 10 custom alerts, and custom spot profiles.",
    url: `${SITE_URL}/pricing`,
    siteName: "ReelCaster",
    type: "website",
    locale: "en_CA",
  },
  robots: { index: true, follow: true },
};

const PLAN_FEATURES = [
  "14-day hourly forecasts",
  "Up to 10 custom alerts (email + SMS)",
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
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const monthlyDollarsNow = Math.round(resolveMonthlyPriceCents(now) / 100);
  const annualSavingsVsPeak = Math.max(0, 12 * 15 - 79); // simple narrative number

  return (
    <article>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10 md:pt-20 md:pb-14">
        <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
          ReelCaster Pro
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-[-0.02em] text-rc-ink mb-5">
          Pricing
        </h1>
        <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-ink-soft">
          Pro unlocks the full 14-day forecast, up to 10 custom alerts, and
          custom spot profiles. Monthly pricing is utility-based — peak fishing
          months cost more, off-season is steeply discounted. The Season Pass
          beats peak monthly by ${annualSavingsVsPeak}+.
        </p>

        <PricingActions
          defaultRegion={defaultRegion}
          monthlyDollarsNow={monthlyDollarsNow}
        />
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
              <span className="text-4xl font-black text-rc-ink">$79</span>
              <span className="text-sm text-rc-ink-mute">/ year</span>
            </div>
            <p className="text-sm text-rc-ink-soft mb-5">
              365 days from purchase. Pays for itself in roughly six peak-season
              months.
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

          {/* Monthly Seasonal */}
          <div className="bg-rc-panel border border-rc-rule rounded-md p-6 md:p-8">
            <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute mb-2">
              Monthly · Seasonal
            </p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-black text-rc-ink">
                ${monthlyDollarsNow}
              </span>
              <span className="text-sm text-rc-ink-mute">/ month, this month</span>
            </div>
            <p className="text-sm text-rc-ink-soft mb-5">
              You&apos;re billed at the rate active when you subscribe; rate
              auto-rolls each month with the season. Cancel any time.
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

      {/* Seasonal price curve */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-2xl md:text-3xl font-black tracking-[-0.02em] text-rc-ink mb-2">
          The Seasonal Curve
        </h2>
        <p className="text-sm text-rc-ink-soft mb-6 max-w-2xl">
          We charge what the forecast is worth. Monthly rates ramp up with peak
          fishing season and fall back in the off-season — so the people fishing
          most pay the most, and casual users barely pay at all.
        </p>
        <div className="bg-rc-panel border border-rc-rule rounded-lg p-4 md:p-6">
          <SeasonPricingGraph currentMonth={currentMonth} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-rc-ink-mute">
            <div>Peak (Apr–Sep): <strong className="text-rc-ink">$15/mo</strong></div>
            <div>Shoulder (Mar, Oct): <strong className="text-rc-ink">$10/mo</strong></div>
            <div>Off-season (Nov–Feb): <strong className="text-rc-ink">$5/mo</strong></div>
          </div>
        </div>
      </section>

      {/* Coverage note */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-rc-surface border border-rc-rule rounded-lg p-5 text-sm text-rc-ink-soft">
          Pro is sold only in covered regions: <strong className="text-rc-ink">British
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

// Suppress TS unused warning while we keep the array reference handy for future legend.
void MONTHLY_PRICE_TABLE;
