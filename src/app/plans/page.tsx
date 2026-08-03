import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ANNUAL_PRICE_ID,
  ANNUAL_PRICE_CENTS,
  MONTHLY_PRICE_CENTS,
  annualDiscount,
} from '@/lib/pricing';
import { TRIAL_DAYS } from '@/lib/trial';
import { PLAN_FEATURES } from '@/lib/plan-features';
import PlansFeatureCallout from '@/app/components/plans/plans-feature-callout';
import {
  breadcrumbJsonLd,
  DEFAULT_OG,
  SITE_NAME,
  SITE_URL,
  siteUrl,
} from '@/lib/site';

/**
 * Product + Offer markup, ported from the retired /pricing page (#c4d8706).
 *
 * Four offers, not two: one product with multi-currency Prices means the same
 * plan is sold in CAD and USD, and Google wants the eligible region stated per
 * currency. Amounts come from the same constants the visible table renders, so
 * the markup can't advertise a price the page doesn't show.
 */
/**
 * No annual Price in Stripe means the annual plan — and the trial that rides on
 * it — cannot be bought. The page body already falls back to monthly, but the
 * metadata and the Offer markup are module-scope constants and used to advertise
 * annual regardless, so search results and link previews promised a $33/yr trial
 * that the page itself didn't offer. Everything customer-facing gates on this.
 */
const ANNUAL_SELLABLE = Boolean(ANNUAL_PRICE_ID);

const CAD_REGIONS = [
  { '@type': 'AdministrativeArea', name: 'British Columbia' },
];
const USD_REGIONS = [
  { '@type': 'AdministrativeArea', name: 'Washington' },
  { '@type': 'AdministrativeArea', name: 'Oregon' },
];

function proOffer(plan: 'Monthly' | 'Annual', currency: 'CAD' | 'USD') {
  const cents = plan === 'Monthly' ? MONTHLY_PRICE_CENTS : ANNUAL_PRICE_CENTS;
  return {
    '@type': 'Offer',
    name: `ReelCaster Pro ${plan} (${currency})`,
    price: (cents / 100).toFixed(2),
    priceCurrency: currency,
    availability: 'https://schema.org/InStock',
    url: siteUrl('/plans'),
    seller: { '@id': `${SITE_URL}/#organization` },
    eligibleRegion: currency === 'CAD' ? CAD_REGIONS : USD_REGIONS,
  };
}

const PLANS_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'ReelCaster Pro',
  description:
    'Full 14-day fishing forecasts, custom score alerts, and custom spot profiles for the BC, Washington, and Oregon coasts.',
  brand: { '@type': 'Brand', name: SITE_NAME },
  url: siteUrl('/plans'),
  category: 'Fishing forecast subscription',
  offers: [
    proOffer('Monthly', 'CAD'),
    proOffer('Monthly', 'USD'),
    ...(ANNUAL_SELLABLE
      ? [proOffer('Annual', 'CAD'), proOffer('Annual', 'USD')]
      : []),
  ],
};

const PLANS_BREADCRUMBS = breadcrumbJsonLd([
  { name: 'Home', path: '/' },
  { name: 'Plans', path: '/plans' },
]);

// Prices come from the same constants the visible table renders, for the same
// reason the Offer markup does: the description can't promise a number the page
// doesn't show.
const PRICE_SENTENCE = ANNUAL_SELLABLE
  ? `${dollars(ANNUAL_PRICE_CENTS)} a year after a ${TRIAL_DAYS}-day free trial.`
  : `${dollars(MONTHLY_PRICE_CENTS)} a month, cancel anytime.`;

export const metadata: Metadata = {
  title: 'ReelCaster Pro: Plans',
  description: `ReelCaster Pro: 14-day forecasts, your own private spots, and alerts when conditions line up. ${PRICE_SENTENCE}`,
  alternates: { canonical: siteUrl('/plans') },
  openGraph: {
    title: 'ReelCaster Pro: Plans',
    description: `14-day forecasts, private spots, and condition alerts. ${PRICE_SENTENCE}`,
    url: siteUrl('/plans'),
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_CA',
    // Every other indexable page spreads DEFAULT_OG; /plans was the one that
    // didn't, so the sales page — the most-shared link on the site — rendered
    // as a bare text card everywhere it was posted.
    ...DEFAULT_OG,
  },
  robots: { index: true, follow: true },
};

function dollars(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

// The comparison table's rows, their order, and the free/pro split now live in
// `@/lib/plan-features` — the same list the in-app upgrade modal renders, so
// this page and every paywall prompt can't drift apart. The rationale for what
// belongs on it (live features only; free rows first; keep "Plan a week ahead"
// adjacent to "Plan the full two weeks") is documented there.

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'What happens when the trial ends?',
    a: (
      <>
        We charge {dollars(ANNUAL_PRICE_CENTS)} for the year and Pro keeps
        running. We email you three days beforehand so the date is never a
        surprise.
      </>
    ),
  },
  {
    q: 'What do I lose if I cancel?',
    a: (
      <>
        The Pro extras, and nothing else. Your account, your saved spots, your
        catch log, and your 7-day forecast stay free. We don’t take back what
        you’ve already put in.
      </>
    ),
  },
  {
    q: 'Do you cover where I fish?',
    a: (
      <>
        We’re live in British Columbia, Washington, and Oregon. If you fish
        somewhere else,{' '}
        <Link
          href="/explore"
          className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
        >
          drop a waitlist pin
        </Link>
        . That’s how we pick what to build next. We won’t sell you Pro for water
        we can’t forecast.
      </>
    ),
  },
  {
    q: 'Can I pay monthly instead?',
    a: (
      <>
        Yes, {dollars(MONTHLY_PRICE_CENTS)} a month, cancel whenever. Both
        plans start with the same free trial.{' '}
        <Link
          href="/plans/checkout?plan=monthly"
          className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
        >
          Go monthly
        </Link>
        .
      </>
    ),
  },
];

function Check({ dim = false }: { dim?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      role="img"
      aria-label="Included"
      className={`mx-auto h-4 w-4 ${dim ? 'text-rc-ink-mute' : 'text-rc-brand'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

export default function PlansPage() {
  const { pct, perMonthCents, fullCents, saveCents } = annualDiscount();

  // No annual Price in Stripe means no trial to sell. Rather than advertise a
  // free week that 503s at checkout, the page falls back to the monthly plan.
  const trialSellable = ANNUAL_SELLABLE;

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PLANS_JSONLD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PLANS_BREADCRUMBS) }}
      />

      {/* Paywall deep links (?feature=alerts) open on what the customer just
          got blocked from, rather than a generic pitch. */}
      <div className="pt-8 md:pt-10">
        <PlansFeatureCallout />
      </div>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-10 md:pt-8 md:pb-14">
        <div className="grid gap-10 md:grid-cols-[1fr_minmax(320px,420px)] md:gap-14">
          <div>
            <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute">
              ReelCaster Pro
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.02em] text-rc-ink md:text-6xl">
              Know before you go.
            </h1>
            {/* Deliberately not a feature list — the table right beside it is
                the feature list, and this used to recite three of its rows
                back at the reader. The subhead's job is why any of it works:
                name the inputs (credibility) and the payoff (pick the day). */}
            <p className="mt-5 max-w-xl text-base leading-relaxed text-rc-ink-soft md:text-lg">
              We score every spot against what actually moves fish: tide,
              light, water temperature, and what’s running right now. So you
              pick the day instead of hoping for one.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/plans/checkout"
                className="inline-flex items-center justify-center rounded-md bg-rc-brand px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
              >
                {trialSellable
                  ? `Start ${TRIAL_DAYS}-day free trial`
                  : `Get Pro · ${dollars(MONTHLY_PRICE_CENTS)}/mo`}
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center justify-center rounded-md border border-rc-rule bg-rc-panel px-6 py-3.5 text-sm font-semibold text-rc-ink transition-colors hover:border-rc-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
              >
                Try the map free
              </Link>
            </div>

            <p className="mt-4 text-sm text-rc-ink-mute">
              {trialSellable ? (
                <>
                  Free for {TRIAL_DAYS} days, then{' '}
                  {dollars(ANNUAL_PRICE_CENTS)} a year. Cancel anytime, and you
                  keep your free account.
                </>
              ) : (
                <>
                  {dollars(MONTHLY_PRICE_CENTS)} a month, cancel anytime. Yearly
                  billing is coming back shortly.
                </>
              )}
            </p>
          </div>

          {/* ── What you get ───────────────────────────────────── */}
          <div className="md:pt-2">
            <div className="overflow-hidden rounded-xl border border-rc-rule bg-rc-panel shadow-rc-panel">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Features included in the free account compared with ReelCaster
                  Pro
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="px-5 pt-5 pb-3 text-sm font-bold text-rc-ink"
                    >
                      What you get
                    </th>
                    <th
                      scope="col"
                      className="w-16 px-2 pt-5 pb-3 text-center font-rc-mono text-[10px] uppercase tracking-[0.1em] text-rc-ink-mute"
                    >
                      Free
                    </th>
                    <th
                      scope="col"
                      className="w-16 px-2 pt-5 pb-3 text-center font-rc-mono text-[10px] uppercase tracking-[0.1em] font-bold text-rc-brand"
                    >
                      Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_FEATURES.map((f, i) => (
                    <tr
                      key={f.label}
                      className={i % 2 === 0 ? 'bg-rc-surface' : undefined}
                    >
                      <th
                        scope="row"
                        className="px-5 py-3 text-sm font-normal text-rc-ink-soft"
                      >
                        {f.label}
                      </th>
                      <td className="px-2 py-3 text-center">
                        {f.free ? <Check dim /> : <span className="sr-only">Not included</span>}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <Check />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 px-1 text-xs leading-relaxed text-rc-ink-mute">
              Free accounts can save one spot. Pro is unlimited, and alerts are
              capped at 10 per account. Private spots work anywhere inside a
              city we cover.
            </p>
          </div>
        </div>
      </section>

      {/* ── Price ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border border-rc-rule bg-rc-panel p-6 shadow-rc-panel md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute">
                One plan
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-5xl font-black tracking-[-0.03em] text-rc-ink">
                  {dollars(ANNUAL_PRICE_CENTS)}
                </span>
                <span className="text-base font-medium text-rc-ink-mute">
                  / year
                </span>
              </div>
              <p className="mt-1.5 text-sm text-rc-ink-soft">
                That’s {dollars(perMonthCents)} a month, billed yearly. Or{' '}
                {dollars(MONTHLY_PRICE_CENTS)} a month if you’d rather:{' '}
                twelve of those is {dollars(fullCents)}, so the year saves you{' '}
                {dollars(saveCents)}.
              </p>
            </div>

            <div className="flex flex-col items-start gap-2">
              <span className="rounded bg-rc-good-bg px-2 py-1 font-rc-mono text-[11px] font-bold tracking-tight text-rc-good-ink">
                SAVE {pct}% YEARLY
              </span>
              <Link
                href="/plans/checkout"
                className="inline-flex items-center justify-center rounded-md bg-rc-brand px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
              >
                {trialSellable ? `Start ${TRIAL_DAYS}-day free trial` : 'Get Pro'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── The cancellation promise ─────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border border-rc-rule bg-rc-surface p-6 md:p-8">
          <h2 className="text-xl font-bold text-rc-ink md:text-2xl">
            Cancel and nothing disappears.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-rc-ink-soft md:text-base">
            Your spots, your catch log, and your 7-day forecast stay free
            forever. Cancelling drops the Pro extras; it doesn’t lock you out
            of your own fishing history. We’re not going to hold your season
            hostage.
          </p>
        </div>
      </section>

      {/* ── Coverage ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-lg border border-rc-rule bg-rc-panel p-5 text-sm leading-relaxed text-rc-ink-soft">
          Pro is sold only where we forecast:{' '}
          <strong className="text-rc-ink">British Columbia</strong>,{' '}
          <strong className="text-rc-ink">Washington</strong>, and{' '}
          <strong className="text-rc-ink">Oregon</strong>. Prices are in CAD for
          Canada and USD for the US. Fish somewhere else?{' '}
          <Link
            href="/explore"
            className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
          >
            Drop a waitlist pin
          </Link>{' '}
          and vote for your water.
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-10 md:py-14">
        <h2 className="text-2xl font-black tracking-[-0.02em] text-rc-ink md:text-3xl">
          Before you decide
        </h2>
        <div className="mt-6 divide-y divide-rc-rule border-y border-rc-rule">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-rc-ink marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 md:text-base">
                {q}
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="h-4 w-4 flex-shrink-0 text-rc-ink-mute transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3.5 6l4.5 4.5L12.5 6" />
                </svg>
              </summary>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-rc-ink-soft">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-xl border border-rc-rule bg-rc-panel p-8 text-center shadow-rc-panel md:p-12">
          <h2 className="text-2xl font-black tracking-[-0.02em] text-rc-ink md:text-4xl">
            The water’s waiting.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-rc-ink-soft md:text-base">
            Pick the right day before you book the day off.
          </p>
          <Link
            href="/plans/checkout"
            className="mt-7 inline-flex items-center justify-center rounded-md bg-rc-brand px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
          >
            {trialSellable
              ? `Start ${TRIAL_DAYS}-day free trial`
              : `Get Pro · ${dollars(MONTHLY_PRICE_CENTS)}/mo`}
          </Link>
          {trialSellable && (
            <p className="mt-4 text-xs text-rc-ink-mute">
              {dollars(ANNUAL_PRICE_CENTS)} a year after the trial. Cancel
              anytime.
            </p>
          )}
        </div>
      </section>
    </article>
  );
}
