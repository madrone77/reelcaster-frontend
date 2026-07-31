'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'

const FEATURE_COPY: Record<string, { title: string; body: string }> = {
  'alerts': {
    title: 'More alerts, including SMS',
    body:
      'Pro lets you run up to 10 alert profiles and get notified by SMS in addition to email — so you don’t miss the peak when you’re not at your desk.',
  },
  'favorites': {
    title: 'Save unlimited spots',
    body:
      'Pro lifts the 5-spot cap, adds drag-to-reorder, and shows a 7-day score sparkline next to each favorite.',
  },
  '14-day-forecast': {
    title: '14-day forecast',
    body:
      'See the full hourly outlook two weeks out — plan trips, time tides, and chase the right species across the season.',
  },
  'spot-horizon': {
    title: 'Unlock the full forecast on this spot',
    body:
      'Pro shows the full 14-day window with hourly detail and 5-species comparison on every spot page.',
  },
  'bathymetry': {
    title: 'Bathymetry layer (NOAA + CHS)',
    body:
      'Read the bottom — drop-offs, ledges, and channel structure overlaid on the live forecast map.',
  },
  'custom-spots': {
    title: 'Your own spots on the map',
    body:
      'Pro lets you drop a pin anywhere in covered waters, name it, and pick the species we score there — your private spots, scored like ours.',
  },
  'support': {
    title: 'The Port — priority support',
    body:
      'Pro opens the support portal: guides, the knowledge base, billing self-serve, and a ticket queue with a one-business-day reply target.',
  },
  'multi-species': {
    title: 'Multi-species scoring',
    body:
      'Compare the bite score for up to 5 species at once on a spot — find the best target without flipping tabs.',
  },
}

function CalloutInner() {
  const searchParams = useSearchParams()
  const feature = searchParams.get('feature') ?? ''
  if (!feature) return null
  const copy = FEATURE_COPY[feature]
  if (!copy) return null

  return (
    <div
      className="max-w-6xl mx-auto px-6 mt-4"
      data-testid="pricing-feature-callout"
      data-feature={feature}
    >
      <div className="flex items-start gap-3 rounded-lg border border-rc-good-border bg-rc-good-soft p-4">
        <Sparkles className="w-5 h-5 text-rc-good mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-rc-ink">
            What you came for: {copy.title}
          </p>
          <p className="text-sm text-rc-ink-soft mt-0.5">{copy.body}</p>
        </div>
      </div>
    </div>
  )
}

export default function PricingFeatureCallout() {
  return (
    <Suspense fallback={null}>
      <CalloutInner />
    </Suspense>
  )
}
