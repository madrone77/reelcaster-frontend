import type { Metadata } from 'next';
import { DEFAULT_OG, SITE_NAME, SITE_URL, siteUrl } from '@/lib/site';
import Hero from './components/hero';
import NearbySpots from './components/nearby-spots';
import ScoreTicker from './components/score-ticker';
import DataSources from './components/data-sources';
import SignalsSection from './components/signals-section';
import MapSection from './components/map-section';
import PricingSection from './components/pricing-section';
import FeaturesSection from './components/features-section';
import CtaBand from './components/cta-band';
import SignedInRedirect from './components/signed-in-redirect';

// Hourly revalidation keeps the seasonal Pro price current across month
// boundaries (see src/lib/pricing.ts).
export const revalidate = 3600;

// The tagline is the H1's job. The <title> has to carry the query people
// actually type ("bc fishing forecast"), so it leads with that and keeps the
// tagline out of the 60 characters search results will show.
//
// `title.absolute` opts out of the root layout's "%s | ReelCaster" template —
// the brand is already in the string.
export const metadata: Metadata = {
  title: {
    absolute: 'BC Fishing Forecast & Tide Conditions | ReelCaster',
  },
  description:
    'ReelCaster combines tides, weather, water conditions, and regulations into one simple fishing score, so you know exactly when and where to fish on the BC coast.',
  alternates: { canonical: siteUrl('/') },
  openGraph: {
    title: 'ReelCaster: Know the bite. Before you go.',
    description:
      'Tides, weather, water conditions, and regulations in one simple fishing score for the BC coast.',
    url: siteUrl('/'),
    type: 'website',
    ...DEFAULT_OG,
  },
  robots: { index: true, follow: true },
};

const HOMEPAGE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
  description:
    'Fishing forecasts for the BC coast: tides, weather, water conditions, and regulations combined into one simple score.',
};

export default function MarketingHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_JSONLD) }}
      />

      {/* Signed-in visitors never land here — straight to /dashboard. Renders
          nothing for signed-out visitors and crawlers, so the static HTML below
          is untouched. */}
      <SignedInRedirect />

      <Hero />
      <ScoreTicker />
      <DataSources />
      <SignalsSection />
      {/* Client-only, and silent unless the caller's IP snaps to a covered
          city, so the static HTML around it is identical for every visitor and
          every crawler. It sits below the signals rather than under the hero:
          the slot here is past the fold, which is what lets it appear without
          shifting anything on screen. See components/nearby-spots.tsx. */}
      <NearbySpots />
      {/* Pricing follows the map section: the two plans read as the answer to
          "Mapped." instead of interrupting the signal story. */}
      <MapSection />
      <PricingSection />
      <FeaturesSection />
      <CtaBand />
    </>
  );
}
