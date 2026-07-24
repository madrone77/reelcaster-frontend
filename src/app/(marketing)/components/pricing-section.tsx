import Link from 'next/link';
import {
  ANNUAL_PRICE_CENTS,
  MONTHLY_PRICE_CENTS,
  annualDiscount,
} from '@/lib/pricing';

// Free vs Pro. Pro is one flat plan — $5/mo or $33/yr (45% off) — wired to the
// real prices in src/lib/pricing.ts (no fake price points).
export default function PricingSection() {
  const monthlyDollars = MONTHLY_PRICE_CENTS / 100;
  const annualDollars = ANNUAL_PRICE_CENTS / 100;
  const { pct } = annualDiscount();

  return (
    <section id="pricing" data-testid="homepage-pricing" className="bg-rc-navy scroll-mt-16">
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-20">
        <h2 className="text-center text-3xl md:text-4xl font-black tracking-[-0.02em] text-white">
          Two plans. One goal. Better days on the water.
        </h2>
        <p className="mt-3 text-center text-sm md:text-base text-white/60">
          Start free and get today&apos;s score. Upgrade when you&apos;re ready
          for the full forecast, alerts, and advanced planning tools.
        </p>

        <div className="mt-14 grid gap-10 md:gap-6 md:grid-cols-2 md:items-stretch">
          {/* Free plan */}
          <div className="flex flex-col rounded bg-rc-panel p-8 text-center">
            <p className="text-base font-bold tracking-wide text-rc-ink">FREE</p>
            <p className="mt-2 text-5xl font-black tracking-[-0.03em] text-rc-ink">
              $0
            </p>
            <p className="mt-5 text-sm leading-relaxed text-rc-ink-soft">
              See today&apos;s Reelcaster Score for one location and experience
              how the platform works.
            </p>
            <div className="mt-auto pt-8">
              <Link
                href="/signup"
                className="block w-full rounded bg-rc-brand px-6 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-rc-brand-hover"
              >
                START FREE
              </Link>
            </div>
          </div>

          {/* Reelcaster Pro */}
          <div className="relative flex flex-col rounded bg-rc-panel p-8 text-center">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-rc-good-bg px-3 py-1.5 font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-good-ink">
              MOST POPULAR
            </span>
            <p className="text-base font-bold tracking-wide text-rc-brand">
              REELCASTER PRO
            </p>
            <p className="mt-2 text-5xl font-black tracking-[-0.03em] text-rc-ink">
              ${monthlyDollars}
              <span className="ml-1 align-baseline font-rc-mono text-xs font-medium tracking-wide text-rc-ink-mute">
                /mo
              </span>
            </p>
            <p className="mt-1.5 font-rc-mono text-[11px] text-rc-ink-mute">
              or ${annualDollars}/yr — save {pct}%
            </p>
            <p className="mt-4 text-sm leading-relaxed text-rc-ink-soft">
              Plan ahead with 14-day hourly forecasts, custom spot profiles, and
              custom alerts by email + SMS.
            </p>
            <div className="mt-auto pt-8">
              <Link
                href="/pricing"
                className="block w-full rounded bg-rc-brand px-6 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-rc-brand-hover"
              >
                START REELCASTER PRO
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
