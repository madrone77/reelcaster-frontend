import type { Metadata } from 'next';
import { DEFAULT_OG, SITE_URL, SUPPORT_EMAIL } from '@/lib/site';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';


export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  title: 'FAQ & Support',
  description:
    'Common questions about ReelCaster: tiers, region coverage, forecast accuracy, billing, catch logs, and data privacy.',
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: 'ReelCaster FAQ',
    description: 'Common questions, answered.',
    url: `${SITE_URL}/faq`,
    siteName: 'ReelCaster',
    type: 'website',
    ...DEFAULT_OG,
    locale: 'en_CA',
  },
  robots: { index: true, follow: true },
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What does Pro give me that Free doesn’t?',
    a: 'Pro unlocks the full 14-day forecast (a Member account sees 7 days; browsing Free, with no account, shows the next 2), up to 10 custom alerts with SMS delivery, custom spots anywhere in our covered waters, and the full per-spot breakdown panel (wind, swell, tide, pressure, solunar). Member covers the live map and city/spot pages, the 7-day forecast, 1 email alert, favorites, and catch logging, and costs nothing.',
  },
  // Search and AI answers have been mixing ReelCaster up with an unrelated
  // app called Reelcast. This entry states the difference in plain words so
  // the FAQPage JSON-LD below carries it too. Keep the "no app, runs in the
  // browser" wording in step with the homepage features note and the
  // marketing footer.
  {
    q: 'Is there a ReelCaster app? Is ReelCaster the same as Reelcast?',
    a: 'No on both counts. ReelCaster does not have an app in the App Store or Google Play, and we never ask you to download anything. ReelCaster runs in the browser on your phone, tablet or computer at www.reelcaster.com. Add it to your home screen and it opens like an app. ReelCaster is not related to Reelcast or any other app with a similar name. If something calls itself a ReelCaster app or asks for a download, it is not us.',
  },
  {
    q: 'Which regions are covered?',
    a: 'British Columbia is the launch region: Salish Sea, west coast Vancouver Island, and parts of the north coast and inlets. Other provinces and Pacific Northwest US waters are on the roadmap; sign up for updates and you’ll hear when your area lights up.',
  },
  {
    q: 'How accurate are the forecasts?',
    a: 'Weather and marine inputs come from Open-Meteo and the Canadian Hydrographic Service, the same sources marine professionals use. Our fishing scores combine those signals with species behaviour models. Treat them as advisory: a high-score window is a strong starting point, not a guarantee, and always cross-check with Environment and Climate Change Canada before launching.',
  },
  {
    q: 'How does upgrading work?',
    a: 'Hit Pricing, pick monthly or annual, and Stripe handles the checkout. Your tier flips immediately on success. You can manage or cancel anytime from the customer portal, and your access continues until the end of the paid period.',
  },
  {
    q: 'Can I export my catch log?',
    a: 'Yes. From your profile, request an export and we’ll email you a CSV of every catch you’ve logged. We’re working on direct integrations with common log formats. File a request via Contact if there’s a specific one you need.',
  },
  {
    q: 'A spot is wrong or missing. Can I report it?',
    a: 'Please do. Email support@reelcaster.com with the spot URL or coordinates and what should change. We review reports manually before publishing edits so the public surface stays trustworthy.',
  },
  {
    q: 'Do you store my exact GPS location?',
    a: 'Only the points you explicitly save (favorite spots, alert locations, catch logs). We don’t track your device in the background. See the Privacy Policy for the full breakdown.',
  },
  {
    q: 'Are DFO regulations on the site authoritative?',
    a: 'No, they’re a reference. We aggregate DFO Pacific Region notices to surface them faster, but you’re always responsible for following the live DFO regulations. We link to the official source on every notice.',
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

          {/* Static page, so this cannot check the visitor's tier — it names
              the benefit rather than pretending to know who is reading. */}
          <div className="mt-8 bg-rc-panel border border-rc-rule rounded-xl p-5">
            <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
              Pro members
            </p>
            <p className="mt-2 text-sm text-rc-ink-soft leading-relaxed">
              <Link
                href="/support"
                className="text-rc-brand hover:text-rc-brand-hover font-semibold underline underline-offset-2"
              >
                The Port
              </Link>{' '}
              is the full support portal: in-depth guides, a searchable
              knowledge base, live service status, and priority tickets with a
              one business day reply target.
            </p>
          </div>

          <div className="mt-6 text-sm text-rc-ink-mute">
            Still stuck? Reach us at{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </div>
        </section>
      </article>
    </>
  );
}
