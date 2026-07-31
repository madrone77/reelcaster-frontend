'use client';

/**
 * "What you came for" banner on /plans.
 *
 * Paywall CTAs deep-link with `?feature=<slug>` so the sales page opens on the
 * thing the customer just got blocked from, instead of a generic pitch. Ported
 * from the retired /pricing page.
 *
 * Two fixes came with the port:
 *
 *   - The paywall sends `favorite-spots`, but the old map only had `favorites`,
 *     so that callout silently rendered nothing. Both slugs map now.
 *   - Dropped the `bathymetry` and `multi-species` entries. Nothing links to
 *     them, and they described features that aren't gated — the same standard
 *     the comparison table is held to. Re-add them when they're really sold.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';

const FEATURE_COPY: Record<string, { title: string; body: string }> = {
  alerts: {
    title: 'More alerts, including text messages',
    body: 'Pro runs up to 10 alert profiles and can text you as well as email — so you don’t miss the window while you’re away from your desk.',
  },
  // Both slugs: the paywall sends `favorite-spots`, older links send `favorites`.
  favorites: {
    title: 'Save every spot you fish',
    body: 'Pro lifts the 5-spot cap, adds drag-to-reorder, and puts a 7-day score sparkline next to each one.',
  },
  'favorite-spots': {
    title: 'Save every spot you fish',
    body: 'Pro lifts the 5-spot cap, adds drag-to-reorder, and puts a 7-day score sparkline next to each one.',
  },
  '14-day-forecast': {
    title: 'The full two weeks',
    body: 'See the whole hourly outlook fourteen days out — plan trips, time the tide, and follow the season instead of guessing at it.',
  },
  'custom-spots': {
    title: 'Your pin, our full model',
    body: 'Pro scores a spot we don’t publish — drop it anywhere inside a city we cover and it gets the same model run as everything else on the map.',
  },
  'spot-horizon': {
    title: 'The full forecast on this spot',
    body: 'Pro opens the complete 14-day window with hourly detail and 5-species comparison on every spot page.',
  },
};

function CalloutInner() {
  const searchParams = useSearchParams();
  const feature = searchParams.get('feature') ?? '';
  if (!feature) return null;

  const copy = FEATURE_COPY[feature];
  if (!copy) return null;

  return (
    <div
      className="mx-auto max-w-6xl px-6"
      data-testid="plans-feature-callout"
      data-feature={feature}
    >
      <div className="flex items-start gap-3 rounded-lg border border-rc-good-border bg-rc-good-bg p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-rc-good-ink" />
        <div>
          <p className="text-sm font-semibold text-rc-ink">
            What you came for: {copy.title}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-rc-ink-soft">
            {copy.body}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PlansFeatureCallout() {
  return (
    <Suspense fallback={null}>
      <CalloutInner />
    </Suspense>
  );
}
