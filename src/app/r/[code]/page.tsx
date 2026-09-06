import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { PLAN_FEATURES } from '@/lib/plan-features';
import { REFERRAL_DAYS, parseReferralCode } from '@/lib/referrals';
import { referrerFirstName, referrerForCode } from '@/lib/referrals-server';
import ReferralClaim from './referral-claim';

/**
 * /r/<code>: the receiving end of "give a month, get a month".
 *
 * A friend lands here from a text or a post. The page names who sent them,
 * says what they get, and sends them to /signup. The month itself is granted
 * when the new account first authenticates, by /api/attribution/signup, off
 * the cookie this page's client half sets. See src/lib/referrals-server.ts
 * for why no admin approves it.
 *
 * A code nobody owns is a 404, not a generic pitch: a broken link should
 * look broken, so the friend asks for a fresh one rather than signing up and
 * waiting for a month that never comes.
 */

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ code: string }> };

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export const metadata: Metadata = {
  title: 'A month of ReelCaster Pro, from a friend',
  description: `A friend gave you ${REFERRAL_DAYS} days of ReelCaster Pro. No card.`,
  // Personal links, not pages to rank. Unfurlers still read the tags above.
  robots: { index: false, follow: false },
};

/** The Pro side of the same table /plans renders, so the two can't drift. */
const PRO_ONLY = PLAN_FEATURES.filter((row) => row.pro && !row.free);

export default async function ReferralPage({ params }: PageProps) {
  const { code: raw } = await params;
  const code = parseReferralCode(raw);
  if (!code) notFound();

  const sb = admin();
  const referrer = await referrerForCode(sb, code);
  if (!referrer) notFound();

  const firstName = await referrerFirstName(sb, referrer.userId);
  const who = firstName ?? 'A friend';

  return (
    <section className="mx-auto max-w-3xl px-6 pb-16 pt-10 md:pb-24 md:pt-16">
      <p className="font-rc-mono text-[10px] uppercase tracking-[0.14em] text-rc-ink-mute">
        From {who}
      </p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.02em] text-rc-ink md:text-5xl">
        {who} gave you a month of Pro.
      </h1>
      <p className="mt-5 text-base leading-relaxed text-rc-ink-soft md:text-lg">
        {REFERRAL_DAYS} days of ReelCaster Pro, free. No card, no trial that turns
        into a charge, nothing to cancel. Make an account and it is switched on
        the moment you sign in. When the month is up you drop back to a free
        account and keep your spots and your catch log.
      </p>

      <ReferralClaim code={code} who={who} />

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
