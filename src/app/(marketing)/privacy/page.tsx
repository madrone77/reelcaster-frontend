import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = 'https://reelcaster.com';
const LAST_UPDATED = 'May 1, 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy | ReelCaster',
  description:
    'How ReelCaster collects, uses, and protects your data — accounts, fishing logs, location signals, billing, and analytics.',
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: 'Privacy Policy | ReelCaster',
    description: 'How ReelCaster handles your data.',
    url: `${SITE_URL}/privacy`,
    siteName: 'ReelCaster',
    type: 'website',
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
            How ReelCaster collects, uses, and protects your data. Plain
            language first; legal details where they matter.
          </p>
          <p className="mt-4 text-xs text-rc-ink-mute">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <section className="max-w-3xl mx-auto px-6 pb-16 space-y-8 text-rc-ink-soft leading-relaxed">
          <Block title="1. Information we collect">
            <p>
              <strong className="text-rc-ink">Account info.</strong> Email
              address, encrypted password (via Supabase Auth), display name,
              and any optional profile preferences you set.
            </p>
            <p>
              <strong className="text-rc-ink">Fishing data.</strong> Catch
              logs, favorite spots, custom alerts, and notification
              preferences you create inside ReelCaster.
            </p>
            <p>
              <strong className="text-rc-ink">Location signals.</strong>{' '}
              Coordinates you save (favorite spots, alert locations) and, when
              you tap “Fish On,” the GPS reading from your device. We never
              continuously track you in the background.
            </p>
            <p>
              <strong className="text-rc-ink">Billing.</strong> Subscription
              status, plan tier, and Stripe customer/subscription identifiers.
              Payment card details are handled by Stripe — we never see or
              store them.
            </p>
            <p>
              <strong className="text-rc-ink">Usage analytics.</strong>{' '}
              Aggregate page views, feature usage, and error reports used to
              prioritise improvements. No third-party advertising trackers.
            </p>
          </Block>

          <Block title="2. How we use it">
            <p>
              To run the product (forecasts, alerts, catch logs), bill the
              right tier, send the notifications you opted into, respond when
              you contact support, and improve the app. That&rsquo;s it.
            </p>
          </Block>

          <Block title="3. Cookies & local storage">
            <p>
              We use cookies and browser local storage to keep you signed in,
              remember preferences (units, map type, recent locations), and
              cache data offline (catch logs queue for sync). We do not use
              third-party advertising cookies.
            </p>
          </Block>

          <Block title="4. Data sharing">
            <p>
              We share data only with the service providers required to run
              ReelCaster: Supabase (database, auth), Stripe (billing), Resend
              (transactional email), Mapbox (maps), Open-Meteo &amp; DFO
              (public weather/regulation data). We do not sell your data.
            </p>
            <p>
              We may disclose data if compelled by Canadian law, or to
              investigate fraud or abuse.
            </p>
          </Block>

          <Block title="5. Retention">
            <p>
              Account data is retained while your account is active. If you
              delete your account, personal data is removed within 30 days,
              except for billing records we&rsquo;re required to keep for tax
              and accounting (typically 7 years).
            </p>
          </Block>

          <Block title="6. Your rights">
            <p>
              You can access, correct, export, or delete your data at any
              time. Email{' '}
              <a
                href="mailto:support@reelcaster.com"
                className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                support@reelcaster.com
              </a>{' '}
              and we&rsquo;ll respond within 30 days. Canadian residents may
              also contact the Office of the Privacy Commissioner if you
              believe we&rsquo;ve mishandled your data.
            </p>
          </Block>

          <Block title="7. Children">
            <p>
              ReelCaster is not directed at children under 13. If you believe
              a child has created an account, contact us and we&rsquo;ll
              remove it.
            </p>
          </Block>

          <Block title="8. Changes">
            <p>
              We&rsquo;ll post material changes here and update the
              &ldquo;Last updated&rdquo; date. Continued use after a change
              means you accept the revised policy.
            </p>
          </Block>

          <Block title="9. Contact">
            <p>
              Questions about this policy?{' '}
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
