/**
 * Send the "almost done signing up" email to people who abandoned a signed-out
 * checkout BEFORE the cron existed.
 *
 * The cron (GET /api/cron/checkout-reminders) only owns sessions that expired
 * after REMINDERS_START in src/lib/checkout-reminder.ts. Everything before that
 * goes through here, so a person reviews the list before anybody is emailed.
 * Same selection, same claim, same template as the cron: an address this sends
 * to can never get a second one from either.
 *
 * Dry run by default. Nothing is sent without --apply.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...
 *   STRIPE_SECRET_KEY=...  RESEND_API_KEY=...        (RESEND only for --apply)
 *
 *   npx tsx scripts/checkout-reminder-backfill.ts                    # list
 *   npx tsx scripts/checkout-reminder-backfill.ts --days=30          # how far back
 *   npx tsx scripts/checkout-reminder-backfill.ts --exclude=a@x.com,b@y.com --apply
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  REMINDERS_START,
  findReminderCandidates,
  sendCheckoutReminder,
} from '../src/lib/checkout-reminder';

const APPLY = process.argv.includes('--apply');
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const DAYS = Number(arg('days') ?? 30);
const EXCLUDE = new Set(
  (arg('exclude') ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!supabaseUrl || !supabaseKey || !stripeKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and STRIPE_SECRET_KEY.');
  process.exit(1);
}
if (APPLY && !process.env.RESEND_API_KEY) {
  // email-service logs instead of sending when the key is missing, which would
  // stamp every claim as sent while nobody received anything.
  console.error('--apply needs RESEND_API_KEY.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(stripeKey);

const pt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

async function main() {
  const expiredTo = REMINDERS_START;
  const expiredFrom = new Date(expiredTo.getTime() - DAYS * 86_400_000);
  const scan = await findReminderCandidates(stripe, admin, { expiredFrom, expiredTo });
  const candidates = scan.candidates.filter((c) => !EXCLUDE.has(c.email));

  console.log(`Expired ${pt(expiredFrom.toISOString())} to ${pt(expiredTo.toISOString())} PT\n`);
  console.log('| # | Email | Started (PT) | Tries | Reached card | From |');
  console.log('|---|---|---|---|---|---|');
  candidates.forEach((c, i) =>
    console.log(
      `| ${i + 1} | ${c.email} | ${pt(c.startedAt)} | ${c.attempts} | ${c.reachedPayment ? 'yes' : ''} | ${c.from ?? ''} |`,
    ),
  );

  const skipped: Record<string, string[]> = {};
  for (const s of scan.skipped) (skipped[s.reason] ??= []).push(s.email);
  console.log(`\n${candidates.length} to send, ${EXCLUDE.size} excluded by hand`);
  for (const [reason, emails] of Object.entries(skipped)) {
    console.log(`skipped ${reason}: ${emails.length} (${emails.join(', ')})`);
  }

  if (!APPLY) {
    console.log('\nDry run. Nothing sent. Re-run with --apply to send.');
    return;
  }

  const tally: Record<string, number> = {};
  for (const c of candidates) {
    const outcome = await sendCheckoutReminder(admin, c, { trigger: 'expiry' });
    tally[outcome] = (tally[outcome] ?? 0) + 1;
    console.log(`${outcome}  ${c.email}`);
    // Resend's default limit is 2 requests a second.
    await new Promise((r) => setTimeout(r, 600));
  }
  console.log(tally);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
