import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Compass, Bell, Anchor } from 'lucide-react';
import ScoreHero from '@/app/components/marketing/score-hero';
import SpotMiniMap from '@/app/explore/spot/components/spot-mini-map';
import type { LiveSpot } from '@/lib/bluecaster/live-spot-types';

// Real BC coordinates so the live bathymetry basemap renders actual coastal
// relief — the marketing map is the same component the product uses, not a
// mockup graphic.
const DEMO_MAP_SPOT: LiveSpot = {
  id: 'demo-constance-bank',
  name: 'Constance Bank',
  slug: 'constance-bank',
  lat: 48.386,
  lng: -123.283,
  bottomType: 'mixed',
  spotType: 'bank',
  depthMinM: 15,
  depthMaxM: 60,
  depthMeanM: 35,
  exposure: 'moderate',
  notes: null,
  dfoSubarea: '19-4',
  city: 'Victoria',
  region: 'South Vancouver Island',
  country: 'Canada',
  seoIntro: null,
  seoIntroGeneratedAt: null,
};

const SITE_URL = 'https://reelcaster.com';

export const metadata: Metadata = {
  title: 'ReelCaster — Know the bite. Before you go.',
  description:
    'ReelCaster combines tides, weather, water conditions, and regulations into one simple score, so you know exactly when and where to fish.',
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: 'ReelCaster — Know the bite. Before you go.',
    description: 'One number. Hundreds of signals.',
    url: SITE_URL,
    siteName: 'ReelCaster',
    type: 'website',
    locale: 'en_CA',
  },
  robots: { index: true, follow: true },
};

const HOMEPAGE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ReelCaster',
  url: SITE_URL,
  description:
    'Fishing intelligence for British Columbia and the Pacific Northwest — one daily score built from tide, weather, and regulatory data.',
};

// Demo ticker spots — tier color mirrors the app's own tierFor() cutoffs
// (good ≥75 / fair 55–74 / poor <55).
const TICKER_SPOTS = [
  { name: 'Race Rocks', score: 85 },
  { name: 'Sooke', score: 76 },
  { name: 'Pedder Bay', score: 82 },
  { name: 'Oak Bay', score: 71 },
  { name: 'Sidney', score: 68 },
  { name: 'Trial Is.', score: 74 },
  { name: 'Becher Bay', score: 79 },
];
function tickerDot(score: number) {
  return score >= 75 ? 'bg-rc-good' : score >= 55 ? 'bg-rc-fair' : 'bg-rc-poor';
}

const DATA_SOURCES = [
  { label: 'DFO / MPO', body: 'tides · regulations', logo: '/data-source-dfo.png' },
  { label: 'NOAA', body: 'buoys · water temp', logo: '/data-source-noaa.png' },
  { label: 'ECMWF', body: 'wind · pressure', logo: '/data-source-ecmwf.png' },
  { label: 'NCEP GFS', body: 'global forecast', logo: '/data-source-ncep.png' },
];

const FEATURES = [
  {
    icon: Compass,
    title: '14-day forecast',
    body: 'See the fishing outlook two weeks ahead and plan trips around the best opportunities.',
  },
  {
    icon: Bell,
    title: 'Smart alerts',
    body: 'Get notified when conditions cross your personal thresholds so you never miss a prime window.',
  },
  {
    icon: Anchor,
    title: 'Catch log',
    body: 'Record catches, locations, species, and conditions to learn what works best over time.',
  },
];

export default function MarketingHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_JSONLD) }}
      />

      <Hero />
      <TickerStrip />
      <PricingBand />
      <TrustStrip />
      <ScoreExplainer />
      <MapSection />
      <FeatureGrid />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section data-testid="homepage-hero" className="bg-rc-page">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 lg:gap-16 items-center">
        <div className="max-w-xl">
          <h1
            data-testid="marketing-hero-headline"
            className="text-5xl md:text-[68px] font-bold tracking-[-0.02em] text-rc-ink leading-[1.02] mb-5"
          >
            Know the bite.
            <br />
            <span className="text-rc-brand font-extrabold">Before you go.</span>
          </h1>
          <p className="text-lg md:text-[25px] font-light leading-snug mb-8 max-w-md" style={{ color: '#5A6675' }}>
            Reelcaster combines tides, weather, water conditions, and
            regulations into one simple score, so you know exactly when and
            where to fish.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              data-testid="marketing-primary-cta"
              className="inline-flex items-center gap-2 px-6 py-3 rounded bg-rc-brand hover:bg-rc-brand-hover text-sm font-bold uppercase tracking-[0.03em] text-white transition-colors"
            >
              Start free
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-6 py-3 rounded border-2 border-rc-brand text-sm font-bold uppercase tracking-[0.03em] text-rc-brand hover:bg-rc-brand-soft transition-colors"
            >
              How it works
            </Link>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <ScoreHero />
        </div>
      </div>
    </section>
  );
}

function TickerGroup() {
  return (
    <div className="flex items-center gap-8 shrink-0 pr-8">
      {TICKER_SPOTS.map((s) => (
        <span key={s.name} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={`w-1.5 h-1.5 rounded-full ${tickerDot(s.score)}`} />
          {s.name.toUpperCase()} {s.score}
        </span>
      ))}
    </div>
  );
}

function TickerStrip() {
  return (
    <section data-testid="homepage-ticker" className="bg-rc-ink py-3 overflow-hidden">
      {/* Two identical copies back to back — the track animates from 0 to
          -50% (exactly one copy's width) so the loop is seamless. Hover
          pauses it long enough to actually read a name. */}
      <div className="flex w-max animate-marquee font-rc-mono text-[11px] font-bold text-[#F2F2F5]">
        <TickerGroup />
        <TickerGroup />
      </div>
    </section>
  );
}

function PricingBand() {
  return (
    <section
      data-testid="homepage-pricing"
      className="bg-[#0B1A3A]"
      style={{
        backgroundImage: "url(/pricing-gradient.svg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-20 text-center">
        <h2 className="text-3xl md:text-[38px] font-bold tracking-[-0.02em] text-white mb-3">
          Two plans. One goal. Better days on the water.
        </h2>
        <p className="text-base text-white/70 mb-12 max-w-xl mx-auto">
          Start free and get today&rsquo;s score. Upgrade when you&rsquo;re ready
          for the full forecast, alerts, and advanced planning tools.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
          <div className="p-7 rounded bg-white flex flex-col h-full">
            <p className="font-bold text-rc-brand text-center text-lg mb-1">Free</p>
            <p className="text-4xl font-bold text-rc-ink text-center mb-4">$0</p>
            <p className="text-sm text-rc-ink-soft text-center mb-6">
              See today&rsquo;s Reelcaster Score for one location and experience
              how the platform works.
            </p>
            <Link
              href="/signup"
              className="block text-center px-4 py-3 rounded bg-rc-brand hover:bg-rc-brand-hover text-sm font-bold uppercase tracking-[0.03em] text-white transition-colors mt-auto"
            >
              Start free
            </Link>
          </div>

          <div className="p-7 rounded bg-white relative flex flex-col h-full">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-rc-good-bg font-rc-mono text-[10px] font-bold text-rc-good-ink uppercase tracking-[0.06em] whitespace-nowrap">
              Most popular
            </span>
            <p className="font-bold text-rc-brand text-center text-lg mb-1">Reelcaster Pro</p>
            <p className="text-4xl font-bold text-rc-ink text-center mb-1">
              $79<span className="text-sm font-medium text-rc-ink-mute"> /yr CAD</span>
            </p>
            <p className="font-rc-mono text-xs text-rc-ink-mute text-center mb-4">or from $5/mo, seasonal</p>
            <p className="text-sm text-rc-ink-soft text-center mb-6">
              Plan ahead with 14-day forecasts, custom spots, smart alerts, and
              full species coverage.
            </p>
            <Link
              href="/pricing"
              className="block text-center px-4 py-3 rounded bg-rc-brand hover:bg-rc-brand-hover text-sm font-bold uppercase tracking-[0.03em] text-white transition-colors mt-auto"
            >
              Start Reelcaster Pro
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section data-testid="homepage-trust" className="bg-rc-panel border-b border-rc-rule">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        <span className="rc-label text-[10px] shrink-0">Trusted data sources</span>
        {DATA_SOURCES.map((d, i) => (
          <span key={d.label} className={`flex items-center gap-2 ${i > 0 ? 'pl-10 border-l border-rc-rule' : ''}`}>
            <Image src={d.logo} alt="" width={26} height={26} className="w-6 h-6 shrink-0" aria-hidden />
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-rc-ink">{d.label}</span>
              <span className="block font-rc-mono text-[10px] text-rc-ink-mute">{d.body}</span>
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

function ScoreExplainer() {
  return (
    <section data-testid="homepage-score-explainer" className="bg-rc-surface border-b border-rc-rule">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] text-rc-ink leading-tight mb-4">
            One number. <span className="text-rc-brand font-extrabold">Hundreds of signals.</span>
          </h2>
          <p className="text-base leading-relaxed text-rc-ink-soft mb-2 max-w-md">
            Reelcaster analyzes tides, current, weather, pressure, water
            conditions, and seasonal regulations to generate a daily score
            from 0 to 100.
          </p>
          <p className="text-base leading-relaxed text-rc-ink-soft mb-6 max-w-md">
            The higher the score, the better your opportunity.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-6 py-3 rounded bg-rc-brand hover:bg-rc-brand-hover text-sm font-bold uppercase tracking-[0.03em] text-white transition-colors"
          >
            Start free
          </Link>
        </div>
        <div className="flex justify-center">
          <Image
            src="/marketing-layers.svg"
            alt="Layers of environmental data — tide, wind, pressure, regulations — combining into one Fishing Score"
            width={280}
            height={372}
            className="w-full max-w-[280px] h-auto"
          />
        </div>
      </div>
    </section>
  );
}

function MapSection() {
  return (
    <section data-testid="homepage-map" className="bg-rc-surface border-b border-rc-rule">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
        <SpotMiniMap spot={DEMO_MAP_SPOT} score={82} speciesName="Chinook" />
        <div>
          <h2 className="text-3xl md:text-[34px] font-bold tracking-[-0.02em] text-rc-ink leading-tight mb-4">
            Every reef, bank and ledge.
            <br />
            <span className="text-rc-brand font-extrabold">Mapped.</span>
          </h2>
          <p className="text-base leading-relaxed text-rc-ink-soft mb-2 max-w-md">
            Discover productive fishing structure, save your favorite spots,
            and explore waters with confidence.
          </p>
          <p className="text-base leading-relaxed text-rc-ink-soft mb-6 max-w-md">
            Whether you&rsquo;re chasing salmon, halibut, or lingcod,
            you&rsquo;ll always know where to start.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center px-6 py-3 rounded bg-rc-brand hover:bg-rc-brand-hover text-sm font-semibold text-white transition-colors"
          >
            Explore the map
          </Link>
        </div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section data-testid="homepage-features" className="bg-rc-panel border-b border-rc-rule">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.02em] text-rc-ink mb-10">
          Everything you need in one place.
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="p-6 rounded border border-rc-rule bg-rc-surface">
              <span className="w-9 h-9 rounded bg-rc-brand-soft text-rc-brand flex items-center justify-center mb-4">
                <Icon className="w-4.5 h-4.5" />
              </span>
              <h3 className="text-base font-bold text-rc-ink mb-1.5">{title}</h3>
              <p className="text-sm text-rc-ink-soft leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section data-testid="homepage-final-cta" className="bg-rc-brand">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        <h2 className="text-3xl md:text-[38px] font-bold tracking-[-0.02em] text-white mb-3">
          The next great fishing window is coming.
        </h2>
        <p className="text-base text-white/90">Know when it happens before everyone else.</p>
      </div>
    </section>
  );
}
