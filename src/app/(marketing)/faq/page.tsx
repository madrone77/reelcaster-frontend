import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

const SITE_URL = 'https://reelcaster.com';

export const metadata: Metadata = {
  title: 'FAQ & Support | ReelCaster',
  description:
    'Common questions about ReelCaster: tiers, region coverage, forecast accuracy, billing, catch logs, and data privacy.',
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: 'ReelCaster FAQ',
    description: 'Common questions, answered.',
    url: `${SITE_URL}/faq`,
    siteName: 'ReelCaster',
    type: 'website',
    locale: 'en_CA',
  },
  robots: { index: true, follow: true },
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What does Pro give me that Free doesn’t?',
    a: 'Pro unlocks the 14-day forecast map, multi-spot custom alerts, full per-spot breakdown panel (wind, swell, tide, pressure, solunar) for every published spot, and unlimited catch-log history. Free is great for browsing the public city/spot pages and a starter dashboard.',
  },
  {
    q: 'Which regions are covered?',
    a: 'British Columbia is the launch region — Salish Sea, west coast Vancouver Island, and parts of the north coast and inlets. Other provinces and Pacific Northwest US waters are on the roadmap; sign up for updates and you’ll hear when your area lights up.',
  },
  {
    q: 'How accurate are the forecasts?',
    a: 'Weather and marine inputs come from Open-Meteo and the Canadian Hydrographic Service, the same sources marine professionals use. Our fishing scores combine those signals with species behaviour models. Treat them as advisory: a high-score window is a strong starting point, not a guarantee, and always cross-check with Environment and Climate Change Canada before launching.',
  },
  {
    q: 'How does upgrading work?',
    a: 'Hit Pricing, pick monthly or annual, and Stripe handles the checkout. Your tier flips immediately on success. You can manage or cancel anytime from the customer portal — your access continues until the end of the paid period.',
  },
  {
    q: 'Can I export my catch log?',
    a: 'Yes. From your profile, request an export and we’ll email you a CSV of every catch you’ve logged. We’re working on direct integrations with common log formats — file a request via Contact if there’s a specific one you need.',
  },
  {
    q: 'A spot is wrong or missing — can I report it?',
    a: 'Please do. Email support@reelcaster.com with the spot URL or coordinates and what should change. We review reports manually before publishing edits so the public surface stays trustworthy.',
  },
  {
    q: 'Do you store my exact GPS location?',
    a: 'Only the points you explicitly save (favorite spots, alert locations, catch logs). We don’t track your device in the background. See the Privacy Policy for the full breakdown.',
  },
  {
    q: 'Are DFO regulations on the site authoritative?',
    a: 'No — they’re a reference. We aggregate DFO Pacific Region notices to surface them faster, but you’re always responsible for following the live DFO regulations. We link to the official source on every notice.',
  },
];

const JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.a,
    },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />

      <article data-testid="section-faq">
        <header className="max-w-5xl mx-auto px-6 pt-14 pb-8 md:pt-20 md:pb-10">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
            Help · FAQ
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink mb-4">
            Frequently asked
          </h1>
          <p className="max-w-2xl text-base md:text-lg leading-relaxed text-rc-ink-soft">
            Quick answers about tiers, regions, accuracy, billing, and data.
            Can&rsquo;t find what you&rsquo;re after?{' '}
            <Link
              href="/contact"
              className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
            >
              Drop us a line
            </Link>
            .
          </p>
        </header>

        <section className="max-w-3xl mx-auto px-6 pb-16">
          <ul className="bg-rc-panel border border-rc-rule rounded-xl overflow-hidden">
            {FAQS.map((f, i) => (
              <li
                key={f.q}
                className="border-b border-rc-rule-soft last:border-b-0"
              >
                <details className="group">
                  <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-rc-surface transition-colors">
                    <span className="text-rc-ink font-medium text-sm md:text-base">
                      {f.q}
                    </span>
                    <ChevronDown
                      className="w-4 h-4 text-rc-ink-mute flex-shrink-0 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="px-5 pb-5 -mt-1 text-sm md:text-base text-rc-ink-soft leading-relaxed">
                    {f.a}
                  </div>
                </details>
                <span className="sr-only">Question {i + 1}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 text-sm text-rc-ink-mute">
            Still stuck? Reach us at{' '}
            <a
              href="mailto:support@reelcaster.com"
              className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
            >
              support@reelcaster.com
            </a>
            .
          </div>
        </section>
      </article>
    </>
  );
}
