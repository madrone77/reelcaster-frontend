import type { Metadata } from 'next';
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import Link from 'next/link';

const LAST_UPDATED = 'May 1, 2026';

export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  title: 'Terms of Service',
  description:
    'The terms governing use of ReelCaster: accounts, subscriptions, acceptable use, disclaimers around forecasts and DFO regulations.',
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
            The agreement between you and ReelCaster. Please read it before
            you sign up or subscribe.
          </p>
          <p className="mt-4 text-xs text-rc-ink-mute">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <section className="max-w-3xl mx-auto px-6 pb-16 space-y-8 text-rc-ink-soft leading-relaxed">
          <Block title="1. Acceptance">
            <p>
              By creating an account or using ReelCaster, you agree to these
              Terms and our{' '}
              <Link
                href="/privacy"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              . If you don&rsquo;t agree, don&rsquo;t use the service.
            </p>
          </Block>

          <Block title="2. Your account">
            <p>
              You&rsquo;re responsible for keeping your credentials secure and
              for activity under your account. Notify us immediately at{' '}
              <a
                href="mailto:support@reelcaster.com"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                support@reelcaster.com
              </a>{' '}
              if you suspect unauthorised use.
            </p>
            <p>
              You must be at least 13 years old (or the legal minimum in your
              jurisdiction) to create an account.
            </p>
          </Block>

          <Block title="3. Subscriptions & billing">
            <p>
              Free tier is, well, free. Pro tier is billed monthly or
              annually via Stripe at the rates shown on{' '}
              <Link
                href="/pricing"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                /pricing
              </Link>
              . Subscriptions auto-renew until cancelled.
            </p>
            <p>
              You can cancel anytime from the customer portal. Access keeps
              running until the end of the paid period; we don&rsquo;t prorate
              partial months. Refunds are handled case-by-case; reach out via{' '}
              <Link
                href="/contact"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                /contact
              </Link>
              .
            </p>
          </Block>

          <Block title="4. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Scrape, mirror, or resell ReelCaster data without permission.</li>
              <li>Reverse-engineer the service or attempt to bypass tier gates.</li>
              <li>Use the service to harass, defraud, or impersonate others.</li>
              <li>Submit false catch reports or spot data designed to mislead.</li>
              <li>Interfere with the service&rsquo;s normal operation.</li>
            </ul>
          </Block>

          <Block title="5. Forecasts are advisory">
            <p>
              ReelCaster forecasts, fishing scores, solunar tables, and tide
              predictions are derived from public data sources (Open-Meteo,
              CHS, DFO) and statistical models. They are <strong className="text-rc-ink">not</strong> a
              guarantee of fish, weather, or safe sea conditions. Always
              verify weather and marine forecasts with Environment and
              Climate Change Canada before heading out.
            </p>
          </Block>

          <Block title="6. DFO regulations are your responsibility">
            <p>
              We aggregate DFO Pacific Region notices, closures, and
              regulations as a reference. They may be incomplete, delayed, or
              superseded by newer notices. <strong className="text-rc-ink">You</strong> are
              responsible for following the current{' '}
              <a
                href="https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/index-eng.html"
                target="_blank"
                rel="noopener"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                DFO Recreational Fishing Regulations
              </a>
              . ReelCaster is not a substitute.
            </p>
          </Block>

          <Block title="7. Your content">
            <p>
              Catch logs, photos, notes, and spot data you submit remain
              yours. By submitting them you grant ReelCaster a non-exclusive
              licence to host, display, and process that content to operate
              the service. You can delete content at any time.
            </p>
          </Block>

          <Block title="8. Disclaimer of warranties">
            <p>
              The service is provided &ldquo;as is&rdquo; without warranties
              of any kind, express or implied, including merchantability,
              fitness for a particular purpose, and non-infringement.
            </p>
          </Block>

          <Block title="9. Limitation of liability">
            <p>
              To the fullest extent permitted by law, ReelCaster is not
              liable for any indirect, incidental, special, consequential, or
              punitive damages, or lost profits/data, arising out of your use
              of the service. Total liability for any claim is capped at the
              amount you paid us in the 12 months prior.
            </p>
          </Block>

          <Block title="10. Termination">
            <p>
              We may suspend or terminate accounts that violate these Terms.
              You can close your account at any time via{' '}
              <Link
                href="/profile"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                /profile
              </Link>{' '}
              or by contacting support.
            </p>
          </Block>

          <Block title="11. Governing law">
            <p>
              These Terms are governed by the laws of British Columbia,
              Canada, without regard to conflict-of-laws principles. Disputes
              will be resolved in the courts of Victoria, BC.
            </p>
          </Block>

          <Block title="12. Changes">
            <p>
              We may update these Terms; we&rsquo;ll post the new version
              here and refresh the &ldquo;Last updated&rdquo; date. Material
              changes get an in-app or email notice.
            </p>
          </Block>

          <Block title="13. Contact">
            <p>
              Questions?{' '}
              <Link
                href="/contact"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                Get in touch
              </Link>
              .
            </p>
          </Block>
        </section>
      </article>
    </>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-rc-ink">{title}</h2>
      <div className="space-y-3 text-sm md:text-base">{children}</div>
    </section>
  );
}
