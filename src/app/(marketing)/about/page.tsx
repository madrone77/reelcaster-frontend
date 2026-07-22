import type { Metadata } from 'next';
import Link from 'next/link';
import { Anchor, CloudSun, Fish, MapPin, ScrollText, Waves } from 'lucide-react';
import DataSources from '../components/data-sources';

const SITE_URL = 'https://reelcaster.com';

export const metadata: Metadata = {
  title: 'About ReelCaster | BC Fishing Forecasts',
  description:
    'ReelCaster turns tides, weather, water conditions, and DFO regulations into one simple fishing score for the BC coast. Built by anglers in Victoria, BC.',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'About ReelCaster',
    description:
      'Tides, weather, water conditions, and regulations in one simple fishing score — built by anglers in Victoria, BC.',
    url: `${SITE_URL}/about`,
    siteName: 'ReelCaster',
    type: 'website',
    locale: 'en_CA',
  },
  robots: { index: true, follow: true },
};

const JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About ReelCaster',
  url: `${SITE_URL}/about`,
  inLanguage: 'en-CA',
  publisher: {
    '@type': 'Organization',
    name: 'ReelCaster',
    url: SITE_URL,
    email: 'support@reelcaster.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Victoria',
      addressRegion: 'BC',
      addressCountry: 'CA',
    },
  },
};

const SIGNALS = [
  {
    icon: Waves,
    title: 'Tides & currents',
    body: 'Tide stage, current speed, and slack windows for every spot — the backbone of any saltwater bite.',
  },
  {
    icon: CloudSun,
    title: 'Weather & pressure',
    body: 'Wind, cloud, precipitation, and barometric trend from global forecast models, scored for fishability.',
  },
  {
    icon: Anchor,
    title: 'Water conditions',
    body: 'Sea state and water temperature from buoys and ocean models across the Salish Sea.',
  },
  {
    icon: ScrollText,
    title: 'Regulations',
    body: 'DFO openings, closures, and in-season notices resolved per spot, so the score never points you somewhere you can’t fish.',
  },
];

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />

      <article data-testid="section-about">
        {/* Header */}
        <header className="max-w-5xl mx-auto px-6 pt-14 pb-8 md:pt-20 md:pb-10">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
            Company · About
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink mb-4">
            Know the bite. Before you go.
          </h1>
          <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-ink-soft">
            ReelCaster is a fishing forecast platform for the BC coast. We
            combine tides, weather, water conditions, and regulations into one
            simple score — per spot, per species, per hour — so you spend your
            time on the water when it counts.
          </p>
        </header>

        {/* Trusted sources band */}
        <DataSources />

        {/* What goes into the score */}
        <section className="max-w-5xl mx-auto px-6 py-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.02em] text-rc-ink mb-2">
            One score, four signals
          </h2>
          <p className="max-w-2xl text-rc-ink-soft leading-relaxed mb-8">
            Every hour, every published spot gets a 0–100 ReelCaster Score for
            each target species. The score isn’t a guess — it’s a species
            profile reading real conditions.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SIGNALS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-rc-panel border border-rc-rule rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rc-brand-soft">
                    <Icon className="h-4 w-4 text-rc-brand" />
                  </span>
                  <h3 className="text-base font-semibold text-rc-ink">{title}</h3>
                </div>
                <p className="text-sm text-rc-ink-soft leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Grounded in real catches */}
        <section className="border-y border-rc-rule bg-rc-band">
          <div className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div>
              <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
                Why it’s different
              </p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.02em] text-rc-ink mb-4">
                Grounded in real catches
              </h2>
              <p className="text-rc-ink-soft leading-relaxed">
                Generic solunar apps score every beach the same. ReelCaster
                builds a profile for each spot and species — what tide stage,
                light, and conditions actually produce there — and sharpens it
                with logged catches and local reports. Spots that keep proving
                out score higher. That’s the whole point.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-rc-panel border border-rc-rule rounded-xl p-4">
                <Fish className="w-5 h-5 text-rc-brand mt-0.5 shrink-0" />
                <p className="text-sm text-rc-ink-soft leading-relaxed">
                  <span className="font-semibold text-rc-ink">Per-species profiles.</span>{' '}
                  Chinook off a kelp edge and coho on a beach don’t bite on the
                  same conditions — they aren’t scored on the same ones either.
                </p>
              </div>
              <div className="flex items-start gap-3 bg-rc-panel border border-rc-rule rounded-xl p-4">
                <MapPin className="w-5 h-5 text-rc-brand mt-0.5 shrink-0" />
                <p className="text-sm text-rc-ink-soft leading-relaxed">
                  <span className="font-semibold text-rc-ink">Spot-level, not region-level.</span>{' '}
                  Forecasts are computed for the actual bank, point, or channel
                  you fish — on nautical-chart bathymetry, not a weather grid.
                </p>
              </div>
              <div className="flex items-start gap-3 bg-rc-panel border border-rc-rule rounded-xl p-4">
                <ScrollText className="w-5 h-5 text-rc-brand mt-0.5 shrink-0" />
                <p className="text-sm text-rc-ink-soft leading-relaxed">
                  <span className="font-semibold text-rc-ink">Regulation-aware.</span>{' '}
                  Closures and in-season notices are part of the forecast, not a
                  separate PDF you find out about at the boat launch.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Coverage + team */}
        <section className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h2 className="text-xl font-bold text-rc-ink mb-3">Where we cover</h2>
            <p className="text-sm text-rc-ink-soft leading-relaxed">
              ReelCaster starts where we fish: Victoria and the south coast of
              Vancouver Island, growing city by city across the Salish Sea and
              the Pacific Northwest. Every new area is seeded with local spots
              and reviewed before it goes live — coverage grows carefully, not
              all at once. See what’s published on the{' '}
              <Link
                href="/fishing/bc"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                British Columbia directory
              </Link>
              .
            </p>
          </div>
          <div>
            <h2 className="text-xl font-bold text-rc-ink mb-3">Who we are</h2>
            <p className="text-sm text-rc-ink-soft leading-relaxed">
              We’re a small team of anglers and engineers based in Victoria,
              BC. We built ReelCaster because we were tired of cross-referencing
              tide tables, wind apps, and regulation PDFs before every trip —
              and still guessing. Questions, corrections, or a spot we should
              know about? We read everything at{' '}
              <a
                href="mailto:support@reelcaster.com"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                support@reelcaster.com
              </a>
              .
            </p>
          </div>
        </section>

        {/* CTA band */}
        <section className="border-t border-rc-rule bg-rc-navy">
          <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.02em] text-white">
                See today’s scores
              </h2>
              <p className="text-sm text-white/70 mt-1">
                The live map is free to explore — no account needed.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/explore"
                className="inline-flex items-center px-5 py-2.5 rounded bg-white text-rc-navy text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                Explore the map
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center px-5 py-2.5 rounded bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
