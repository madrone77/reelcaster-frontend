import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Activity, ShieldCheck } from 'lucide-react';

const SITE_URL = 'https://reelcaster.com';

export const metadata: Metadata = {
  title: 'About ReelCaster | BC Fishing Forecasts Built by Anglers',
  description:
    'ReelCaster is a fishing intelligence platform for British Columbia anglers. Forecasts, regulations, and species data in one place.',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'About ReelCaster',
    description: 'BC fishing intelligence built by anglers.',
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
  about: {
    '@type': 'Organization',
    name: 'ReelCaster',
    url: SITE_URL,
    description:
      'Fishing intelligence platform for British Columbia: forecasts, DFO regulations, and species data.',
    areaServed: {
      '@type': 'Place',
      name: 'British Columbia, Canada',
    },
  },
};

const PILLARS = [
  {
    icon: Activity,
    title: 'Fishing-grade forecasts',
    body: 'Wind, swell, tide, pressure, and solunar data combined into a per-species score for every spot we publish — with a 14-day outlook.',
  },
  {
    icon: ShieldCheck,
    title: 'Regulations you can trust',
    body: 'Every DFO Pacific Region notice, parsed and tagged. Closures, openings, and biotoxin alerts surface automatically against your favorite spots.',
  },
  {
    icon: MapPin,
    title: 'Built for BC waters',
    body: 'Salish Sea, west coast Vancouver Island, north coast inlets. We start where local knowledge matters most and grow from there.',
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
        <header className="max-w-5xl mx-auto px-6 pt-14 pb-8 md:pt-20 md:pb-10">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
            About · ReelCaster
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink mb-4">
            Fishing intelligence for BC waters
          </h1>
          <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-ink-soft">
            ReelCaster pulls forecasts, tides, DFO regulations, and species
            behaviour into one place so you can plan a trip in minutes
            instead of stitching together six tabs.
          </p>
        </header>

        <section className="max-w-5xl mx-auto px-6 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="bg-rc-panel border border-rc-rule rounded-xl p-5"
              >
                <div className="p-2.5 rounded-lg bg-rc-brand-soft inline-flex mb-4">
                  <p.icon className="w-5 h-5 text-rc-brand" />
                </div>
                <h3 className="text-rc-ink font-semibold mb-2">{p.title}</h3>
                <p className="text-sm text-rc-ink-soft leading-relaxed">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-6 pb-16 space-y-6 text-rc-ink-soft leading-relaxed">
          <h2 className="text-2xl font-bold text-rc-ink">Who it&rsquo;s for</h2>
          <p>
            BC recreational anglers — chinook and coho chasers, halibut
            crews, prawners, lingcod hunters, and shore-based jiggers. If you
            care about a +5 knot wind shift or a slack-tide window, we built
            this for you.
          </p>

          <h2 className="text-2xl font-bold text-rc-ink pt-2">
            How we make decisions
          </h2>
          <p>
            We treat forecasts as advisory and tag the things we&rsquo;re
            uncertain about. We default to the conservative reading on
            regulations — when DFO is unclear, we link to the source instead
            of guessing. We don&rsquo;t sell ad space, and we don&rsquo;t
            sell user data.
          </p>

          <h2 className="text-2xl font-bold text-rc-ink pt-2">What&rsquo;s next</h2>
          <p>
            More provinces, deeper species behaviour models, more languages,
            and better offline support for boat days with no signal. Got an
            ask?{' '}
            <Link
              href="/contact"
              className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
            >
              Tell us
            </Link>
            .
          </p>

          <div className="pt-6 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-md bg-rc-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover"
            >
              See plans
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center rounded-md border border-rc-brand bg-rc-panel px-5 py-2.5 text-sm font-bold text-rc-brand transition-colors hover:bg-rc-brand-soft"
            >
              Explore the map
            </Link>
          </div>
        </section>
      </article>
    </>
  );
}
