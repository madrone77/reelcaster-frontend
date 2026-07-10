import type { Metadata } from 'next';
import Link from 'next/link';
import {
  fetchSpeciesList,
  type BlueCasterSpeciesSummary,
} from '@/lib/bluecaster';
import {
  ArrowRight,
  Compass,
  Bell,
  Anchor,
  Map as MapIcon,
  Sparkles,
} from 'lucide-react';

const SITE_URL = 'https://reelcaster.com';

export const metadata: Metadata = {
  title: 'ReelCaster — BC Fishing Forecasts, Tides & Local Intel',
  description:
    'Live fishing intelligence for British Columbia. 14-day forecasts, tide data, regulations, species guides, and the spots local anglers actually fish.',
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: 'ReelCaster — BC Fishing Forecasts',
    description: 'Live fishing intelligence for British Columbia.',
    url: SITE_URL,
    siteName: 'ReelCaster',
    type: 'website',
    locale: 'en_CA',
  },
  robots: { index: true, follow: true },
};

const HOW_IT_WORKS = [
  {
    icon: Compass,
    title: 'See conditions',
    body:
      'Live tide, wind, swell, and a daily fishing score for every covered city — no spreadsheet required.',
  },
  {
    icon: Bell,
    title: 'Set an alert',
    body:
      'Get an email when conditions hit your bar — wind under 15kt, tide swing over 1.5m, score above 70.',
  },
  {
    icon: Anchor,
    title: 'Log your catch',
    body:
      'Tap one button on the boat. Offline-first, GPS-tagged. Build a real record across seasons.',
  },
];

const HOMEPAGE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ReelCaster',
  url: SITE_URL,
  description:
    'Live fishing forecasts, regulations, and local intel for British Columbia and the Pacific Northwest.',
};

export default async function MarketingHomePage() {
  const species = await fetchSpeciesList({ limit: 6 });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_JSONLD) }}
      />

      <Hero />
      <HowItWorks />
      <SpeciesPreview species={species} />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section
      data-testid="homepage-hero"
      className="relative overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-12 md:pt-24 md:pb-20">
        <p className="text-rc-text-muted text-xs tracking-[0.25em] uppercase font-medium mb-4">
          ReelCaster · British Columbia
        </p>
        <h1
          data-testid="marketing-hero-headline"
          className="text-4xl md:text-6xl font-black uppercase tracking-tight text-rc-text max-w-3xl mb-6 leading-[1.05]"
        >
          The fishing forecast actually built for the boat.
        </h1>
        <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-text-light mb-8">
          Tides, wind, swell, scoring, and seasonal calendars for every published
          BC city — pulled together so you can decide whether to launch in 30
          seconds, not 30 minutes of tab juggling.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup"
            data-testid="marketing-primary-cta"
            className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors"
          >
            Sign up free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-5 py-3 bg-rc-bg-dark border border-rc-bg-light hover:border-blue-500/40 rounded-lg text-sm font-semibold text-rc-text transition-colors"
          >
            Explore the map
          </Link>
        </div>

        <div className="mt-10 flex items-center gap-6 text-xs text-rc-text-muted">
          <span className="inline-flex items-center gap-1">
            <MapIcon className="w-3.5 h-3.5" /> Victoria · Sidney · Tofino · Sooke
          </span>
          <span className="hidden sm:inline-flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> 14-day Pro forecasts
          </span>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      data-testid="homepage-how-it-works"
      className="border-t border-rc-bg-light bg-rc-bg-dark"
    >
      <div className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-rc-text mb-8">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="bg-rc-bg-darkest border border-rc-bg-light rounded-lg p-6"
            >
              <div className="w-10 h-10 rounded-md bg-blue-600 text-white flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-rc-text mb-2">{title}</h3>
              <p className="text-sm text-rc-text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SpeciesPreview({ species }: { species: BlueCasterSpeciesSummary[] }) {
  if (species.length === 0) {
    return null;
  }
  return (
    <section
      data-testid="homepage-species-preview"
      className="border-t border-rc-bg-light bg-rc-bg-dark"
    >
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-rc-text-muted text-xs tracking-[0.25em] uppercase font-medium mb-2">
              Species library
            </p>
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-rc-text">
              What anglers chase
            </h2>
          </div>
          <Link
            href="/species"
            className="inline-flex items-center gap-1 text-sm font-medium text-rc-text-light hover:text-rc-text"
          >
            All species <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {species.map((s) => (
            <Link
              key={s.id}
              href={`/species/${s.slug}`}
              data-testid="species-card"
              className="block bg-rc-bg-darkest border border-rc-bg-light rounded-lg p-4 hover:border-blue-500/40 transition-colors"
            >
              <h3 className="font-semibold text-rc-text">{s.name}</h3>
              {s.scientific_name && (
                <p className="text-xs italic text-rc-text-muted mt-0.5">
                  {s.scientific_name}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section
      data-testid="homepage-final-cta"
      className="border-t border-rc-bg-light"
    >
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-rc-text mb-4">
          Ready to fish smarter?
        </h2>
        <p className="text-base text-rc-text-light mb-6">
          Free tier gives you a 1-day forecast, 1 alert, unlimited catch
          logging. Pro unlocks the full 14-day window, multi-species scoring,
          and bathymetry.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition-colors"
          >
            Sign up free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-5 py-3 bg-rc-bg-dark border border-rc-bg-light hover:border-blue-500/40 rounded-lg text-sm font-semibold text-rc-text transition-colors"
          >
            See Pro pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
