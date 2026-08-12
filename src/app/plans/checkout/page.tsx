import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import CheckoutPanel from '@/app/components/plans/checkout-panel';
import { siteUrl } from '@/lib/site';
import { isCovered } from '@/lib/regions';

export const metadata: Metadata = {
  title: 'Checkout | ReelCaster Pro',
  description:
    'Start your 7-day free trial of ReelCaster Pro: 14-day forecasts, private spots, and condition alerts. $33 a year after the trial.',
  alternates: { canonical: siteUrl('/plans/checkout') },
  // A checkout page has nothing to offer search. /plans is the indexable one.
  robots: { index: false, follow: true },
};

// Vercel sets x-vercel-ip-country-region (e.g. "BC", "WA"). Best-effort prefill
// only — the customer can change it in the summary.
//
// Gated on COVERED_PROVINCES rather than a hand-written list: this used to
// accept "OR" too, and once Oregon left the region dropdown that would have
// preselected a <select> value with no matching <option>, leaving the field
// showing British Columbia while the state said Oregon. Anything uncovered
// returns null and the summary falls back to its own default.
async function detectRegion(): Promise<string | null> {
  const h = await headers();
  const region = h.get('x-vercel-ip-country-region');
  if (!region) return null;
  const r = region.toUpperCase();
  return isCovered(r) ? r : null;
}

export default async function PlansCheckoutPage() {
  const defaultRegion = await detectRegion();

  return (
    <article className="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute">
        ReelCaster Pro
      </p>

      <div className="mt-6">
        {/* useSearchParams in the panel needs a Suspense boundary. */}
        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-xl bg-rc-surface" />
          }
        >
          <CheckoutPanel defaultRegion={defaultRegion} />
        </Suspense>
      </div>

      <footer className="mt-14 border-t border-rc-rule pt-8 text-center">
        <p className="text-xs leading-relaxed text-rc-ink-mute">
          Billing handled by Stripe. Regulations shown in ReelCaster are
          reference only; always verify with DFO before you fish.
        </p>
      </footer>
    </article>
  );
}

// headers() reads request-time geo, so this can't be statically generated.
export const dynamic = 'force-dynamic';
