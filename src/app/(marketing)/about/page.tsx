import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ShieldCheck, MapPin, ArrowRight } from 'lucide-react';

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
    areaServed: { '@type': 'Place', name: 'British Columbia, Canada' },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />

      <article data-testid="section-about">
        <header className="border-b border-rc-rule">
          <div className="max-w-3xl mx-auto px-6 pt-16 pb-14 md:pt-20 md:pb-16">
            <p className="rc-label text-[10px] text-rc-brand mb-3">About ReelCaster</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.02em] text-rc-ink leading-[1.08] mb-5">
              We did the hard work so your trip planning takes a minute.
            </h1>
            <p className="text-base md:text-lg leading-relaxed text-rc-ink-soft max-w-xl">
              ReelCaster pulls tide, weather, water conditions, and DFO
              regulations into one daily score, so you can decide whether to
              go before you&rsquo;ve stitched together six browser tabs.
            </p>
          </div>
        </header>

        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PILLARS.map((p) => (
              <div key={p.title} className="p-6 rounded border border-rc-rule bg-rc-surface">
                <span className="w-9 h-9 rounded bg-rc-brand-soft text-rc-brand flex items-center justify-center mb-4">
                  <p.icon className="w-4.5 h-4.5" />
                </span>
                <h3 className="text-base font-semibold text-rc-ink mb-1.5">{p.title}</h3>
                <p className="text-sm text-rc-ink-soft leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-2xl mx-auto px-6 pb-20 space-y-8">
          <div>
            <h2 className="text-xl font-bold text-rc-ink mb-2">Who it&rsquo;s for</h2>
            <p className="text-rc-ink-soft leading-relaxed">
              BC recreational anglers — chinook and coho chasers, halibut
              crews, prawners, lingcod hunters, and shore-based jiggers. If
              you care about a +5 knot wind shift or a slack-tide window, we
              built this for you.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-rc-ink mb-2">How we make decisions</h2>
            <p className="text-rc-ink-soft leading-relaxed">
              We treat forecasts as advisory and flag what we&rsquo;re
              uncertain about. On regulations, we default to the conservative
              reading — when DFO is unclear, we link to the source instead of
              guessing. We don&rsquo;t sell ad space, and we don&rsquo;t sell
              user data.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-rc-ink mb-2">What&rsquo;s next</h2>
            <p className="text-rc-ink-soft leading-relaxed">
              More provinces, deeper species behaviour models, and better
              offline support for boat days with no signal. Got an ask?{' '}
              <Link href="/contact" className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2">
                Tell us
              </Link>
              .
            </p>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-3 rounded bg-rc-brand hover:bg-rc-brand-hover text-sm font-semibold text-white transition-colors"
            >
              See plans <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center px-5 py-3 rounded border border-rc-rule hover:bg-rc-surface text-sm font-semibold text-rc-ink transition-colors"
            >
              Explore the map
            </Link>
          </div>
        </section>
      </article>
    </>
  );
}
