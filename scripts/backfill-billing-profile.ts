/**
 * Fill user_settings.bill_* for members who bought before the mirror existed.
 *
 * The webhook keeps this block current from now on (src/lib/billing-profile.ts),
 * but it only fires on a subscription event, and a member who bought a year ago
 * and has not renewed since will not produce one for months. This walks every
 * Stripe customer once and mirrors what is already there.
 *
 * Driven from STRIPE, not from user_settings, on purpose: a customer whose row
 * never got its stripe_customer_id stamped is exactly the account most likely to
 * be missing everything else too, and driving from Stripe finds it through the
 * customer's own supabase_user_id metadata.
 *
 * ONE CUSTOMER PER MEMBER. Several accounts here own more than one Stripe
 * customer -- a test purchase, a cancelled first attempt, a buy-first checkout
 * that later linked to an existing login. Writing each in turn would leave
 * whichever Stripe listed last in charge, which is the OLDEST one, and would
 * quietly report a member's first abandoned attempt as their billing address.
 * So the customers are grouped by account first and one is chosen: the customer
 * the row actually bills against, or failing that the most recent. Lifetime
 * value is that customer's, not a sum across them -- two customers can be
 * locked to different currencies, and adding those together silently invents a
 * number.
 *
 * Idempotent and safe to re-run: it writes the same mirror the webhook writes,
 * and never blanks a column Stripe cannot answer for.
 *
 * Dry run by default. Nothing is written without --apply.
 *
 *   REELCASTER_SUPABASE_URL=...            (or NEXT_PUBLIC_SUPABASE_URL)
 *   REELCASTER_SUPABASE_SERVICE_KEY=...    (or SUPABASE_SERVICE_ROLE_KEY)
 *   STRIPE_RESTRICTED_KEY=...              (or STRIPE_SECRET_KEY; read scopes
 *                                           on Customers, Subscriptions,
 *                                           Invoices and PaymentMethods)
 *
 *   npx tsx scripts/backfill-billing-profile.ts            # report only
 *   npx tsx scripts/backfill-billing-profile.ts --apply    # write
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  billingProfileFrom,
  type BillingProfileInput,
} from '../src/lib/billing-profile';
import { resolvePaymentMethod } from '../src/lib/payment-method';

const APPLY = process.argv.includes('--apply');

const supabaseUrl =
  process.env.REELCASTER_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.REELCASTER_SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeKey =
  process.env.STRIPE_RESTRICTED_KEY ?? process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey || !stripeKey) {
  console.error(
    'Need a ReelCaster Supabase URL + service key and a Stripe key. See the header.',
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(stripeKey, { maxNetworkRetries: 2 });

/** Every Stripe customer, oldest page last. */
async function allCustomers(): Promise<Stripe.Customer[]> {
  const out: Stripe.Customer[] = [];
  for await (const customer of stripe.customers.list({ limit: 100 })) {
    out.push(customer);
  }
  return out;
}

/**
 * The subscription whose cancellation details describe this customer.
 *
 * The most recently created one, whatever state it is in. A customer who
 * cancelled and came back has two, and the live one carries an empty
 * cancellation block, which the mapper drops rather than writes -- so the
 * earlier reason survives from whichever run recorded it.
 */
async function latestSubscription(
  customerId: string,
): Promise<Stripe.Subscription | null> {
  try {
    const page = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
    return (
      page.data.sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0] ?? null
    );
  } catch (err) {
    console.warn(`  subscriptions unreadable for ${customerId}`, err);
    return null;
  }
}

async function paidInvoices(customerId: string): Promise<Stripe.Invoice[] | null> {
  try {
    const page = await stripe.invoices.list({
      customer: customerId,
      status: 'paid',
      limit: 100,
    });
    return page.data;
  } catch (err) {
    console.warn(`  invoices unreadable for ${customerId}`, err);
    return null;
  }
}

async function main() {
  const customers = await allCustomers();
  console.log(
    `${customers.length} Stripe customers, ${APPLY ? 'WRITING' : 'dry run'}\n`,
  );

  // One read of the mapping table, rather than a query per customer.
  const { data: settings, error } = await admin
    .from('user_settings')
    .select('user_id, stripe_customer_id')
    .not('stripe_customer_id', 'is', null);

  if (error) {
    console.error('could not read user_settings', error);
    process.exit(1);
  }

  // Both directions of the same link: one to recognise a customer whose
  // metadata lost its supabase_user_id, one to pick the billing customer out of
  // an account that owns several.
  const userByCustomer = new Map<string, string>();
  const customerByUser = new Map<string, string>();
  for (const row of settings ?? []) {
    if (!row.stripe_customer_id) continue;
    userByCustomer.set(row.stripe_customer_id, row.user_id);
    customerByUser.set(row.user_id, row.stripe_customer_id);
  }

  // Group first, write second. Several accounts own more than one customer and
  // the winner has to be chosen deliberately rather than by list order.
  const byUser = new Map<string, Stripe.Customer[]>();
  let unlinked = 0;

  for (const customer of customers) {
    const userId =
      customer.metadata?.supabase_user_id || userByCustomer.get(customer.id);

    if (!userId) {
      unlinked++;
      console.log(
        `- ${customer.id} ${customer.email ?? '(no email)'}: no account linked`,
      );
      continue;
    }

    const list = byUser.get(userId);
    if (list) list.push(customer);
    else byUser.set(userId, [customer]);
  }

  let patched = 0;
  let failed = 0;
  const fieldCounts = new Map<string, number>();

  for (const [userId, owned] of byUser) {
    // The customer the entitlement itself bills against wins. It is the one the
    // webhook will keep updating, so choosing anything else here would be
    // overwritten by the next renewal anyway.
    const linkedId = customerByUser.get(userId);
    const chosen =
      owned.find((c) => c.id === linkedId) ??
      [...owned].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0];

    if (owned.length > 1) {
      console.log(
        `! ${chosen.email ?? userId}: ${owned.length} Stripe customers, using ${chosen.id}${
          chosen.id === linkedId ? ' (the linked one)' : ' (the newest)'
        }`,
      );
    }

    const subscription = await latestSubscription(chosen.id);
    const input: BillingProfileInput = {
      customer: chosen,
      card: subscription
        ? await resolvePaymentMethod(stripe, subscription)
        : null,
      subscription,
      paidInvoices: await paidInvoices(chosen.id),
    };

    const patch = billingProfileFrom(input, new Date().toISOString());
    const fields = Object.keys(patch).filter((k) => k !== 'bill_synced_at');

    if (fields.length === 0) {
      console.log(`- ${chosen.id}: nothing readable`);
      continue;
    }

    for (const f of fields) fieldCounts.set(f, (fieldCounts.get(f) ?? 0) + 1);

    console.log(
      `${APPLY ? '+' : '?'} ${chosen.email ?? chosen.id} -> ${fields
        .map((f) => f.replace('bill_', ''))
        .join(', ')}`,
    );

    if (!APPLY) {
      patched++;
      continue;
    }

    const { error: writeError } = await admin
      .from('user_settings')
      .update(patch)
      .eq('user_id', userId);

    if (writeError) {
      failed++;
      console.error(`  write failed for ${userId}`, writeError);
    } else {
      patched++;
    }
  }

  console.log(
    `\n${patched} ${APPLY ? 'written' : 'would be written'}, ${unlinked} with no account, ${failed} failed`,
  );
  console.log('\nfield coverage:');
  for (const [field, count] of [...fieldCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field.replace('bill_', '').padEnd(20)} ${count}`);
  }
  if (!APPLY) console.log('\nRe-run with --apply to write.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
