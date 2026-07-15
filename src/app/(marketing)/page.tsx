import type { Metadata } from 'next';
import Hero from './components/hero';
import ScoreTicker from './components/score-ticker';
import PricingSection from './components/pricing-section';
import DataSources from './components/data-sources';
import SignalsSection from './components/signals-section';
import MapSection from './components/map-section';
import FeaturesSection from './components/features-section';
import CtaBand from './components/cta-band';

const SITE_URL = 'https://reelcaster.com';

// Hourly revalidation keeps the seasonal Pro price current across month
// boundaries (see src/lib/pricing.ts).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Reelcaster — Know the bite. Before you go.',
  description:
    'Reelcaster combines tides, weather, water conditions, and regulations into one simple fishing score, so you know exactly when and where to fish on the BC coast.',
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: 'Reelcaster — Know the bite. Before you go.',
    description:
      'Tides, weather, water conditions, and regulations in one simple fishing score for the BC coast.',
    url: SITE_URL,
    siteName: 'Reelcaster',
    type: 'website',
    locale: 'en_CA',
  },
  robots: { index: true, follow: true },
};

const HOMEPAGE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Reelcaster',
  url: SITE_URL,
  description:
    'Fishing forecasts for the BC coast — tides, weather, water conditions, and regulations combined into one simple score.',
};

export default function MarketingHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_JSONLD) }}
      />

      <Hero />
      <ScoreTicker />
      <PricingSection />
      <DataSources />
      <SignalsSection />
      <MapSection />
      <FeaturesSection />
      <CtaBand />
    </>
  );
}
