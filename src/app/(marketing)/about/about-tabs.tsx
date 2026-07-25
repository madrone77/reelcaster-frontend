'use client'

import { useState } from 'react'
import Link from 'next/link'

type Tab = { label: string; body: React.ReactNode }

const TABS: Tab[] = [
  {
    label: 'Our Mission',
    body: (
      <>
        Reelcaster exists to take the guesswork out of fishing. We fold tides,
        weather, water, and regulations into one honest score — per spot, per
        species, per hour — so you spend your time on the water when it actually
        counts, not cross-referencing five apps before you leave the dock.
      </>
    ),
  },
  {
    label: 'Our Values',
    body: (
      <ul className="space-y-3">
        <li>
          <span className="font-bold text-rc-ink">Accuracy over hype.</span>{' '}
          A score you can trust, or it isn’t worth showing.
        </li>
        <li>
          <span className="font-bold text-rc-ink">Spot-level truth.</span>{' '}
          The actual bank, point, or channel you fish — never a regional
          average.
        </li>
        <li>
          <span className="font-bold text-rc-ink">Regulation-honest.</span>{' '}
          The score never points you somewhere you aren’t allowed to fish.
        </li>
      </ul>
    ),
  },
  {
    label: 'What We Do',
    body: (
      <>
        We build a profile for every spot and species — what tide stage, light,
        and conditions actually produce there — computed on nautical-chart
        bathymetry and sharpened by logged catches and local reports. Spots that
        keep proving out score higher. That’s the whole point.
      </>
    ),
  },
]

export default function AboutTabs() {
  const [active, setActive] = useState(0)

  return (
    <div>
      <p className="mb-5 font-rc-mono text-[11px] uppercase tracking-[0.16em] text-rc-ink-mute">
        About
      </p>

      <div className="flex flex-wrap gap-6 border-b border-rc-rule">
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            className={`-mb-px border-b-2 pb-3 text-sm font-bold transition-colors ${
              active === i
                ? 'border-rc-brand text-rc-brand'
                : 'border-transparent text-rc-ink-mute hover:text-rc-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 min-h-[8.5rem] max-w-md text-pretty leading-relaxed text-rc-ink-soft">
        {TABS[active].body}
      </div>

      <Link
        href="/explore"
        className="mt-8 inline-flex items-center justify-center rounded border border-rc-brand bg-rc-panel px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-rc-brand transition-colors hover:bg-rc-brand-soft"
      >
        Explore the map
      </Link>
    </div>
  )
}
