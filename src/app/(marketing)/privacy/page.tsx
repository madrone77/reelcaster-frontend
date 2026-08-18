import type { Metadata } from 'next';
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import Link from 'next/link';

const LAST_UPDATED = 'May 1, 2026';

export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  title: 'Privacy Policy',
  description:
    'How ReelCaster collects, uses, and protects your data: accounts, fishing logs, location signals, billing, and analytics.',
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
              Payment card details are handled by Stripe. We never see or
              store them.
            </p>
            <p>
              <strong className="text-rc-ink">Usage analytics.</strong>{' '}
              Page views, feature usage, and error reports used to prioritise
              improvements. These are processed by Mixpanel on our behalf.
            </p>
            <p>
              <strong className="text-rc-ink">Advertising &amp; attribution.</strong>{' '}
              When you arrive from one of our ads, the ad network adds a click
              identifier to the link (Google uses <code>gclid</code>,{' '}
              <code>gbraid</code> or <code>wbraid</code>; Meta uses{' '}
              <code>fbclid</code>). We store that identifier, the campaign tags
              on the link, and the page you landed on, so we can tell which ads
              bring people to ReelCaster and stop paying for the ones that
              don&rsquo;t. If you later start a trial or subscribe, we send the
              click identifier back to the network that served the ad, together
              with the fact that a conversion happened and its value, so the ad
              can be credited. We do not send your name, email address, or any
              of your fishing data with it.
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
              cache data offline (catch logs queue for sync).
            </p>
            <p>
              We also set a small number of first-party cookies that describe
              how you arrived, so a signup can be credited to the right link:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <code>rc_entry</code> — the first page you landed on, the site
                that referred you, and any campaign tags or click identifier on
                that link. Written once and never overwritten. 90 days.
              </li>
              <li>
                <code>rc_paid</code> — the most recent ad of ours you clicked,
                and its click identifier. 90 days, which is how long the ad
                networks accept a conversion for a click.
              </li>
              <li>
                <code>rc_wall</code> — which upgrade prompt you were last
                looking at. 30 minutes.
              </li>
              <li>
                <code>rc_offer</code> — an offer code you followed a link for,
                so it can be honoured at signup. 30 days.
              </li>
            </ul>
            <p>
              These are set by us, not by an ad network, and none of them
              follows you to other websites. Clearing your browser cookies
              removes them. You can also limit ad personalisation in your
              Google and Meta account settings, which is separate from us and
              applies everywhere those networks advertise.
            </p>
          </Block>

          <Block title="4. Data sharing">
            <p>
              We share data only with the service providers required to run
              ReelCaster: Supabase (database, auth), Stripe (billing), Resend
              (transactional email), Twilio (SMS alerts, if you turn them on),
              Mixpanel (product analytics), and Open-Meteo, SalishSeaCast
              &amp; DFO (public weather, water and regulation data). We do not
              sell your data.
            </p>
            <p>
              We also send Google and Meta confirmation that an ad of theirs
              led to a trial or a subscription, identified only by the click
              identifier they themselves issued and the value of the
              conversion. This is how ad measurement works and it is the only
              purpose we use it for.
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
            <p>
              Attribution cookies expire on their own schedule (listed in
              section 3) whether or not you ever make an account. Once an
              account exists, the campaign and click identifier that brought it
              in are stored alongside it and are deleted with it.
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
