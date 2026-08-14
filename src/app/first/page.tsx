import type { Metadata } from 'next';
import { PLAN_FEATURES } from '@/lib/plan-features';
import FirstYearClaim from './first-year-claim';

/**
 * /first — the hand-out link for a free first year of Pro.
 *
 * Unlisted on purpose: no sitemap entry, nothing on the site links here, and
 * the robots tag below keeps it out of search. The page grants nothing by
 * itself. It records a claim (src/lib/offers.ts) and an admin approves it in
 * bluecaster, which is what stops a forwarded URL from becoming a free tier.
 *
 * The claim is written when the visitor first becomes authenticated, by
 * /api/attribution/signup, so this page's only job on the way in is to set the
 * cookie and get them to /signup.
 */

export const metadata: Metadata = {
  title: 'Your first year free',
  description: 'A free first year of ReelCaster Pro.',
  // No canonical and no OG block: both exist to make a page shareable, and
  // this one is handed out deliberately rather than shared.
  robots: { index: false, follow: false },
};

/** The Pro side of the same table /plans renders, so the two can't drift. */
const PRO_ONLY = PLAN_FEATURES.filter((row) => row.pro && !row.free);

export default function FirstYearPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-16 pt-10 md:pb-24 md:pt-16">
      <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute">
        Invitation
      </p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.02em] text-rc-ink md:text-5xl">
        Your first year is on us.
      </h1>
      <p className="mt-5 text-base leading-relaxed text-rc-ink-soft md:text-lg">
        A full year of ReelCaster Pro, free. No card, no trial that turns into a
        charge, nothing to cancel. When the year is up your account drops back
        to free and stays there unless you decide otherwise.
      </p>

      <FirstYearClaim />

      <h2 className="mt-14 text-sm font-bold uppercase tracking-[0.08em] text-rc-ink-mute">
        What Pro adds
      </h2>
      <ul className="mt-4 space-y-2.5">
        {PRO_ONLY.map((row) => (
          <li key={row.id} className="flex items-start gap-3 text-sm text-rc-ink-soft">
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-rc-brand"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 8.5l3.5 3.5 7.5-8" />
            </svg>
            {row.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
