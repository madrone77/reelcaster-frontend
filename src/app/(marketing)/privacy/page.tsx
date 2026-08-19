import type { Metadata } from 'next';
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import { LEGAL_CONTACT } from '@/lib/legal-contact';
import {
  LegalDocument,
  readLegalDocument,
} from '../components/legal-document';

// The document body lives in src/content/legal/privacy-policy.md. See the
// note on the terms page: the markdown is canonical, this is just the frame.
const markdown = readLegalDocument('privacy-policy');

export const metadata: Metadata = {
  // Bare title, the root layout's "%s | ReelCaster" template adds the brand.
  title: 'Privacy Policy',
  description:
    'How ReelCaster collects, uses, and protects your data: accounts, catch logs, photo location metadata, billing, analytics, and advertising.',
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: 'Privacy Policy | ReelCaster',
    description: 'How ReelCaster handles your data.',
    url: `${SITE_URL}/privacy`,
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
  name: 'Privacy Policy',
  url: `${SITE_URL}/privacy`,
  inLanguage: 'en-CA',
  publisher: {
    '@type': 'Organization',
    name: 'ReelCaster',
    url: SITE_URL,
  },
};

export default function PrivacyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />

      <article data-testid="section-privacy">
        <header className="max-w-5xl mx-auto px-6 pt-14 pb-8 md:pt-20 md:pb-10">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
            Legal · Privacy
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink mb-4">
            Privacy Policy
          </h1>
          <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-ink-soft">
            What we collect, why we collect it, who we share it with, and how to
            get it back or have it deleted.
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
