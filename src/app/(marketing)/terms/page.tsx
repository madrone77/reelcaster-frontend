import type { Metadata } from 'next';
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import { LEGAL_CONTACT } from '@/lib/legal-contact';
import {
  LegalDocument,
  readLegalDocument,
} from '../components/legal-document';

// The document body lives in src/content/legal/terms-of-service.md. That file
// is the canonical text and the one that goes to counsel; this page is only
// the frame around it.
export const metadata: Metadata = {
  // Bare title, the root layout's "%s | ReelCaster" template adds the brand.
  title: 'Terms of Service',
  description:
    'The terms governing use of ReelCaster: accounts, subscriptions, acceptable use, and the disclaimers around navigation, forecasts, and fishing regulations.',
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title: 'Terms of Service | ReelCaster',
    description: 'The rules for using ReelCaster.',
    url: `${SITE_URL}/terms`,
    siteName: 'ReelCaster',
    type: 'website',
    ...DEFAULT_OG,
    locale: 'en_CA',
  },
  robots: { index: true, follow: true },
};

const JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Terms of Service',
  url: `${SITE_URL}/terms`,
  inLanguage: 'en-CA',
  publisher: {
    '@type': 'Organization',
    name: 'ReelCaster',
    url: SITE_URL,
  },
};

export default function TermsPage() {
  // Read per render, not at module scope: these pages are statically rendered
  // so in production this runs once at build, but in dev it means editing the
  // markdown does not need a server restart.
  const markdown = readLegalDocument('terms-of-service');

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />

      <article data-testid="section-terms">
        <header className="max-w-5xl mx-auto px-6 pt-14 pb-8 md:pt-20 md:pb-10">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
            Legal · Terms
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink mb-4">
            Terms of Service
          </h1>
          <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-ink-soft">
            The agreement between you and ReelCaster. Please read it before you
            sign up or subscribe.
          </p>
          <p className="mt-4 text-xs text-rc-ink-mute">
            Last updated: {LEGAL_CONTACT.EFFECTIVE_DATE}
          </p>
        </header>

        <section className="max-w-3xl mx-auto px-6 pb-16">
          <LegalDocument markdown={markdown} />
        </section>
      </article>
    </>
  );
}
