import type { Metadata } from 'next';
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import Link from 'next/link';
import { Mail, MessageCircle, AlertCircle, Newspaper } from 'lucide-react';

const SUPPORT_EMAIL = 'support@reelcaster.com';

export const metadata: Metadata = {
  title: 'Contact ReelCaster | Support, Billing, Press',
  description:
    'Get in touch with ReelCaster for support, billing questions, spot data corrections, or press inquiries. We respond within two business days.',
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: 'Contact ReelCaster',
    description: 'How to reach ReelCaster support.',
    url: `${SITE_URL}/contact`,
    siteName: 'ReelCaster',
    type: 'website',
    ...DEFAULT_OG,
    locale: 'en_CA',
  },
  robots: { index: true, follow: true },
};

const JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact ReelCaster',
  url: `${SITE_URL}/contact`,
  inLanguage: 'en-CA',
  publisher: {
    '@type': 'Organization',
    name: 'ReelCaster',
    url: SITE_URL,
    email: SUPPORT_EMAIL,
  },
};

const TOPICS = [
  {
    icon: AlertCircle,
    label: 'Refund or billing issue',
    subject: 'Billing question',
  },
  {
    icon: MessageCircle,
    label: 'Spot data correction',
    subject: 'Spot data correction',
  },
  {
    icon: Newspaper,
    label: 'Press / partnerships',
    subject: 'Press inquiry',
  },
];

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />

      <article data-testid="section-contact">
        <header className="max-w-5xl mx-auto px-6 pt-14 pb-8 md:pt-20 md:pb-10">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
            Help · Contact
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink mb-4">
            Get in touch
          </h1>
          <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-ink-soft">
            Email is the fastest way to reach us. Most messages get a reply
            within two business days (BC time, weekdays).
          </p>
        </header>

        <section className="max-w-3xl mx-auto px-6 pb-16 space-y-8">
          <div className="bg-rc-panel border border-rc-rule rounded-xl p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-rc-brand-soft flex-shrink-0">
                <Mail className="w-6 h-6 text-rc-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-rc-ink-mute mb-1">
                  Email
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-xl md:text-2xl font-semibold text-rc-ink hover:text-rc-brand-hover underline-offset-4 hover:underline break-all"
                >
                  {SUPPORT_EMAIL}
                </a>
                <p className="text-sm text-rc-ink-mute mt-2">
                  Include your account email and any relevant screenshots or
                  spot URLs — it speeds things up.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-rc-ink mb-4">
              Common topics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TOPICS.map((t) => (
                <a
                  key={t.label}
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                    t.subject,
                  )}`}
                  className="bg-rc-panel border border-rc-rule rounded-xl p-4 hover:border-rc-brand/40 transition-colors flex flex-col gap-3"
                >
                  <t.icon className="w-5 h-5 text-rc-ink-mute" />
                  <span className="text-sm font-medium text-rc-ink">
                    {t.label}
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="bg-rc-panel border border-rc-rule rounded-xl p-6 text-sm text-rc-ink-soft leading-relaxed">
            <p>
              Looking for self-serve answers first? The{' '}
              <Link
                href="/faq"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                FAQ
              </Link>{' '}
              covers tiers, region coverage, billing, and how forecasts are
              built. For DFO regulation questions, the official source is{' '}
              <a
                href="https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/index-eng.html"
                target="_blank"
                rel="noopener"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                DFO Pacific Region
              </a>
              .
            </p>
          </div>

          <p className="text-xs text-rc-ink-mute">
            ReelCaster is based in Victoria, BC, Canada.
          </p>
        </section>
      </article>
    </>
  );
}
