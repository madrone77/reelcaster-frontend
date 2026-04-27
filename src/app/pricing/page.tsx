import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import PricingActions from "@/app/components/pricing/pricing-actions";
import { SeasonPricingGraph } from "@/app/components/pricing/season-pricing-graph";
import { MONTHLY_PRICE_TABLE, resolveMonthlyPriceCents } from "@/lib/pricing";

const SITE_URL = "https://reelcaster.com";

export const metadata: Metadata = {
  title: "Pro Intel Pricing | ReelCaster",
  description:
    "Unlock 14-day forecasts, unlimited alerts, and custom spot profiles. Monthly seasonal pricing from $5/mo or annual Season Pass.",
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
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const monthlyDollarsNow = Math.round(resolveMonthlyPriceCents(now) / 100);
  const annualSavingsVsPeak = Math.max(0, 12 * 15 - 79); // simple narrative number

  return (
    <article>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10 md:pt-20 md:pb-14">
        <p className="font-mono text-xs tracking-[0.25em] uppercase text-stone-500 mb-3">
          ReelCaster Pro Intel
        </p>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-slate-900 mb-5">
          Pricing
        </h1>
        <p className="max-w-2xl text-base md:text-lg leading-relaxed text-slate-700">
          Pro Intel unlocks the full 14-day forecast, unlimited alerts, and
          custom spot profiles. Monthly pricing is utility-based — peak fishing
          months cost more, off-season is steeply discounted. The Season Pass
          beats peak monthly by ${annualSavingsVsPeak}+.
        </p>

        <PricingActions
          defaultRegion={defaultRegion}
          monthlyDollarsNow={monthlyDollarsNow}
        />
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Annual */}
          <div className="bg-white border-2 border-slate-900 rounded-lg p-6 md:p-8 relative">
            <span className="absolute -top-3 left-6 px-2 py-0.5 text-[10px] tracking-widest uppercase rounded-full bg-slate-900 text-white">
              Best value
            </span>
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500 mb-2">
              Season Pass
            </p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-black text-slate-900">$79</span>
              <span className="text-sm text-slate-500">/ year</span>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              365 days from purchase. Pays for itself in roughly six peak-season
              months.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Monthly Seasonal */}
          <div className="bg-white border border-stone-200 rounded-lg p-6 md:p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-slate-500 mb-2">
              Monthly · Seasonal
            </p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-black text-slate-900">
                ${monthlyDollarsNow}
              </span>
              <span className="text-sm text-slate-500">/ month, this month</span>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              You&apos;re billed at the rate active when you subscribe; rate
              auto-rolls each month with the season. Cancel any time.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Seasonal price curve */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">
          The Seasonal Curve
        </h2>
        <p className="text-sm text-slate-600 mb-6 max-w-2xl">
          We charge what the forecast is worth. Monthly rates ramp up with peak
          fishing season and fall back in the off-season — so the people fishing
          most pay the most, and casual users barely pay at all.
        </p>
        <div className="bg-white border border-stone-200 rounded-lg p-4 md:p-6">
          <SeasonPricingGraph currentMonth={currentMonth} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500">
            <div>Peak (Apr–Sep): <strong className="text-slate-900">$15/mo</strong></div>
            <div>Shoulder (Mar, Oct): <strong className="text-slate-900">$10/mo</strong></div>
            <div>Off-season (Nov–Feb): <strong className="text-slate-900">$5/mo</strong></div>
          </div>
        </div>
      </section>

      {/* Coverage note */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-stone-100 border border-stone-200 rounded-lg p-5 text-sm text-slate-700">
          Pro Intel is sold only in covered regions: <strong>British
          Columbia</strong>, <strong>Washington</strong>, and{" "}
          <strong>Oregon</strong>. If you fish elsewhere,{" "}
          <Link
            href="/explore"
            className="underline underline-offset-2 hover:text-slate-900"
          >
            drop a waitlist pin
          </Link>{" "}
          to vote for your region.
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-stone-200 text-center">
        <p className="text-xs text-slate-400">
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
