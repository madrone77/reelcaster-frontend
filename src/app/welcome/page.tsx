import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import ExploreTopBar from '@/app/explore/components/explore-top-bar';
import { PAGE_MEASURE, READING_MEASURE } from '@/app/components/layout/page-measure';
import { SUPPORT_EMAIL } from '@/lib/site';
import { TRIAL_DAYS } from '@/lib/pricing';

import { STEPS } from './content';

export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  title: 'Welcome',
  description:
    'The first ten minutes with ReelCaster: set a home spot, save the water you fish, set an alert, and log a catch.',
  // Written to somebody who just made an account, and it opens by telling them
  // their account is open. That reads wrong as a search result, and the pages
  // built to be found (/faq, /plans, the city guides) already cover this ground
  // for a stranger. Followed, not indexed, so the links still carry weight.
  robots: { index: false, follow: true },
};

/**
 * /welcome — where the getting-started email lands.
 *
 * PUBLIC on purpose, and listed in AuthGate's PUBLIC_PREFIXES. The email goes
 * to free accounts as well as trials, it gets opened on the phone that is not
 * signed in as often as the laptop that is, and a getting-started page that
 * demands a login before it will explain anything is the wrong first
 * impression. Nothing here is account-specific, so there is nothing to protect.
 *
 * Server-rendered with no client state. The Pro tag is static rather than
 * resolved from the viewer's tier: reading the session would make this a client
 * component that flashes the wrong answer on first paint, to save a free reader
 * from seeing one honest label.
 */
export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className={`${PAGE_MEASURE} py-10`}>
          <div className={READING_MEASURE}>
            <header>
              <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
                Getting started
              </p>
              <h1 className="mt-3 text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink">
                Welcome aboard
              </h1>
              <p className="mt-4 text-base leading-relaxed text-rc-ink-soft">
                ReelCaster scores fishing conditions hour by hour, 0 to 100, for
                the species you are after. It reads the tide and the current, the
                pressure trend, the season, the wind and the light, then tells
                you which hours on which day are worth the fuel.
              </p>
              <p className="mt-3 text-base leading-relaxed text-rc-ink-soft">
                The score is per hour, not per day, and that is the part worth
                knowing early. A spot averaging 60 with a two hour spike to 85 is
                usually a better trip than a flat 70. Read the peak, not the
                average.
              </p>
              <p className="mt-6">
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 rounded-lg bg-rc-brand px-5 py-3 text-white font-semibold hover:bg-rc-brand-hover transition-colors"
                >
                  Open the map
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
              </p>
            </header>

            <section className="mt-12">
              <h2 className="text-2xl font-bold tracking-[-0.01em] text-rc-ink">
                What to do now
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
                Ten minutes of setup, and the app knows which water is yours.
                Work down the list; each one makes the next worth more.
              </p>

              <ol className="mt-8 space-y-10">
                {STEPS.map((step, i) => (
                  <li key={step.id} id={step.id} className="scroll-mt-24">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="shrink-0 w-7 h-7 rounded-full bg-rc-brand-soft text-rc-brand font-rc-mono text-[12px] font-bold flex items-center justify-center"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <h3 className="text-lg font-semibold text-rc-ink">
                        {step.title}
                      </h3>
                      {step.tier === 'pro' && (
                        <span className="font-rc-mono text-[10px] tracking-[0.1em] uppercase text-rc-brand bg-rc-brand-soft rounded px-1.5 py-0.5">
                          Pro
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pl-10 space-y-3">
                      {step.detail.map((para) => (
                        <p
                          key={para.slice(0, 32)}
                          className="text-sm leading-relaxed text-rc-ink-soft"
                        >
                          {para}
                        </p>
                      ))}
                      <p>
                        <Link
                          href={step.href}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-rc-brand hover:text-rc-brand-hover"
                        >
                          {step.hrefLabel}
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                        </Link>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-14 border-t border-rc-rule pt-8">
              <h2 className="text-2xl font-bold tracking-[-0.01em] text-rc-ink">
                If you get stuck, ask us
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-rc-ink-soft">
                Email{' '}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
                >
                  {SUPPORT_EMAIL}
                </a>{' '}
                and a person reads it. Not a form, not a bot. We are a small team
                in Victoria, BC, so if something here is confusing or plain
                broken, telling us is genuinely useful.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-rc-ink-soft">
                The{' '}
                <Link
                  href="/faq"
                  className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
                >
                  FAQ
                </Link>{' '}
                covers the questions we get most, and Pro members get a priority
                queue and the full guide library in{' '}
                <Link
                  href="/support"
                  className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
                >
                  The Port
                </Link>
                .
              </p>
            </section>

            {/* Last, small, and after the help. Somebody four minutes into an
                account is being shown around, not sold to. */}
            <section className="mt-10">
              <p className="text-xs leading-relaxed text-rc-ink-mute">
                On a Member account, the second week of forecast, unlimited saved
                spots, your own pins and up to ten alerts are what Pro adds. It
                starts with a {TRIAL_DAYS}-day free trial.{' '}
                <Link href="/plans" className="text-rc-brand hover:text-rc-brand-hover">
                  See what it adds
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
