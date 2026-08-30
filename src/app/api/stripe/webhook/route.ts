import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import {
  ANNUAL_PRICE_ID,
  amountLabelForStored,
  amountLabelForSubscription,
} from '@/lib/pricing';
import { recordTrialGrant, recordTrialCardFingerprint } from '@/lib/trial';
import { recordConversion } from '@/lib/conversions';
import { uploadPendingConversions } from '@/lib/conversion-upload';
import { findOrCreateUserForCheckout } from '@/lib/checkout-account';
import { sendEmail } from '@/lib/email-service';
import {
  paymentFailedEmail,
  trialUnavailableEmail,
} from '@/lib/email-templates/billing';
import { sendTrialReminder } from '@/lib/trial-reminder';
import {
  PAY_METHOD_KEY,
  resolvePaymentMethodKey,
} from '@/lib/payment-method';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/** Days of Pro kept alive after a failed payment while Stripe retries. */
const GRACE_DAYS = 7;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * `pro_monthly` is now only ever reached by subscriptions that predate the
 * switch to a single yearly plan. Nothing sells monthly, but people are still
 * on it and still being billed $5 — so their renewal and payment-failure
 * emails have to keep quoting the amount they actually pay.
 */
function tierFromPriceId(priceId: string | null | undefined): 'pro_annual' | 'pro_monthly' {
  return priceId === ANNUAL_PRICE_ID ? 'pro_annual' : 'pro_monthly';
}

/**
 * Statuses where the customer has a payment problem rather than a
 * cancellation. We hold the paid tier in place for these and let
 * `grace_until` (checked in src/lib/entitlement.ts) decide entitlement.
 */
const PAYMENT_PROBLEM_STATUSES = new Set(['past_due', 'unpaid']);

function customerIdOf(subscription: Stripe.Subscription): string {
  const c = subscription.customer;
  return typeof c === 'string' ? c : c.id;
}

async function resolveUserId(subscription: Stripe.Subscription): Promise<string | null> {
  const customer = subscription.customer;
  const customerMetaUserId =
    typeof customer === 'string' || customer.deleted
      ? null
      : customer.metadata?.supabase_user_id ?? null;

  const fromMeta = subscription.metadata?.supabase_user_id ?? customerMetaUserId;
  if (fromMeta) return fromMeta;

  const { data } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('stripe_customer_id', customerIdOf(subscription))
    .maybeSingle();

  if (data?.user_id) return data.user_id;

  // Pay-first checkout: the buyer had no account when they paid, so this is
  // where the account comes from. Without this the subscription is charged and
  // never linked to anything — the customer pays and gets nothing.
  return provisionUserForSubscription(subscription);
}

/** The billing email Stripe holds for this subscription's customer. */
async function customerEmailOf(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMeta =
    subscription.metadata?.checkout_email ??
    (typeof subscription.customer === 'string' || subscription.customer.deleted
      ? null
      : subscription.customer.email);
  if (fromMeta) return fromMeta;

  try {
    const stripe = await getStripe();
    const customer = await stripe.customers.retrieve(customerIdOf(subscription));
    return customer.deleted ? null : (customer.email ?? null);
  } catch (err) {
    console.error('[stripe webhook] could not read customer email', err);
    return null;
  }
}

/**
 * Create (or attach to) the account behind a subscription bought without one.
 *
 * Also stamps `supabase_user_id` onto the Stripe customer, so every later
 * event for this customer resolves through metadata and never re-enters this
 * path. `user_settings.created_via_checkout` records whether the account was
 * created BY this purchase — the claim route needs that to decide between
 * signing the buyer in and emailing a link (see src/lib/checkout-account.ts).
 */
async function provisionUserForSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const email = await customerEmailOf(subscription);
  if (!email) {
    console.error(
      '[stripe webhook] no email to provision from for subscription',
      subscription.id,
    );
    return null;
  }

  const account = await findOrCreateUserForCheckout(admin, email);
  if (!account) return null;

  const customerId = customerIdOf(subscription);

  // created_via_checkout is what lets the claim route sign this buyer in from
  // the success URL. Only ever set true — an existing account that happens to
  // buy again must not become claimable.
  await admin.from('user_settings').upsert(
    {
      user_id: account.userId,
      stripe_customer_id: customerId,
      ...(account.created ? { created_via_checkout: true } : {}),
    },
    { onConflict: 'user_id' },
  );

  try {
    const stripe = await getStripe();
    await stripe.customers.update(customerId, {
      metadata: { supabase_user_id: account.userId },
    });
  } catch (err) {
    // Not fatal: user_settings.stripe_customer_id below is the other lookup
    // path, so resolution still works without the stamp.
    console.warn('[stripe webhook] could not stamp customer metadata', err);
  }

  console.info(
    `[stripe webhook] provisioned ${account.created ? 'new' : 'existing'} account for anon checkout`,
    customerId,
  );
  return account.userId;
}

async function emailForUser(userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

async function applySubscriptionToUser(subscription: Stripe.Subscription) {
  const customerId = customerIdOf(subscription);
  const resolvedUserId = await resolveUserId(subscription);

  if (!resolvedUserId) {
    console.error('[stripe webhook] no user_id resolvable for subscription', subscription.id);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const tier = tierFromPriceId(priceId);
  const status = subscription.status; // active | trialing | past_due | canceled | ...
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;

  const isEntitledStatus = status === 'active' || status === 'trialing';
  const isPaymentProblem = PAYMENT_PROBLEM_STATUSES.has(status);

  // Hold the paid tier through a payment problem. Dropping it here — which is
  // what this used to do — locked people out the instant a card expired, with
  // Stripe still mid-retry. entitlement.ts gates on grace_until instead.
  const nextTier = isEntitledStatus || isPaymentProblem ? tier : 'free';

  const update: Record<string, unknown> = {
    user_id: resolvedUserId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    subscription_tier: nextTier,
    subscription_period_end: periodEnd,
    // What they actually pay, not what the tier implies. With a price test
    // running, 'pro_annual' covers more than one amount, and the trial-ending
    // notice has to name the right one. Taken from the subscription item so it
    // cannot disagree with the invoice.
    subscription_amount_cents: item?.price?.unit_amount ?? null,
    subscription_currency: subscription.currency ?? null,
  };

  // Payment is good again (or the subscription ended) — close the window.
  if (!isPaymentProblem) {
    update.grace_until = null;
  }

  await admin.from('user_settings').upsert(update, { onConflict: 'user_id' });

  if (isEntitledStatus) {
    await recordUpgradeAttribution(subscription, resolvedUserId);
    await stampPaymentMethod(subscription);
  }

  if (status === 'trialing') {
    await handleTrialingSubscription(subscription, resolvedUserId, tier);
    // Value 0: nothing has been charged yet. The week-later payment is a
    // separate conversion with the real amount on it.
    //
    // subscription.currency, NOT the price's. Pro is one multi-currency Price
    // (CAD base with a USD currency_option on the same id, see lib/pricing),
    // so price.currency reads 'cad' for an American buyer too and every US
    // trial was reporting as Canadian. The subscription carries what the
    // customer is actually billed in, which is also what the day-7 purchase
    // row gets from invoice.currency — read the price here and one customer
    // lands in two different currencies a week apart.
    await recordConversion(admin, {
      event: 'trial_start',
      subscription,
      userId: resolvedUserId,
      valueCents: 0,
      currency: subscription.currency ?? 'cad',
      occurredAt: subscription.start_date
        ? new Date(subscription.start_date * 1000).toISOString()
        : new Date().toISOString(),
    });
  }
}

/**
 * Record how this subscription was paid for, once, on the subscription itself.
 *
 * The wallet route stamps its own purchases at creation, where the answer is
 * free (see src/app/api/stripe/express-checkout/route.ts). This is for every
 * other way in, chiefly hosted Stripe Checkout, where the subscription is
 * created by Stripe and nobody here gets to set metadata until after the
 * customer has already chosen how to pay.
 *
 * Write-once, deliberately. The stamp answers "how did this person buy",
 * which does not change when they later replace the card on file; re-reading
 * the live method on every event would quietly rewrite history into "how are
 * they paying now", which is the question the admin page already answers for
 * itself. An existing stamp is never overwritten.
 *
 * Entirely best-effort. Failing to stamp costs a row in a report; a webhook
 * that throws costs Stripe a retry and the customer their entitlement, so
 * nothing in here is allowed to escape.
 */
async function stampPaymentMethod(subscription: Stripe.Subscription) {
  if (subscription.metadata?.[PAY_METHOD_KEY]) return;

  try {
    const stripe = await getStripe();
    const key = await resolvePaymentMethodKey(stripe, subscription);
    // No method resolvable yet. A trial created before the card is attached
    // is the normal case, and the subscription.updated that attaches it comes
    // through this same funnel moments later.
    if (!key) return;

    // A metadata update MERGES keys rather than replacing the object, so this
    // cannot clobber the attribution the checkout routes wrote.
    await stripe.subscriptions.update(subscription.id, {
      metadata: { [PAY_METHOD_KEY]: key },
    });
    console.info('[stripe webhook] stamped payment method', subscription.id, key);
  } catch (err) {
    console.warn('[stripe webhook] could not stamp payment method', err);
  }
}

/**
 * Stamp which paywall this upgrade came from, from the metadata the checkout
 * route put on the subscription.
 *
 * Only for entitled statuses: a subscription that arrives already canceled, or
 * one sitting in `incomplete` because the card was declined, has not converted
 * anybody and must not claim a wall.
 *
 * Write-once via `.is('attr_trial_at', null)`. Subscription events fire many
 * times over a member's life (renewals, card updates, tier changes) and every
 * one of them carries the same original metadata; without the guard, the
 * eventual paid conversion would keep re-stamping a trial attribution and the
 * timestamp would drift years away from the thing it describes.
 */
async function recordUpgradeAttribution(
  subscription: Stripe.Subscription,
  userId: string,
) {
  const feature = subscription.metadata?.attr_feature?.trim();
  const from = subscription.metadata?.attr_from?.trim();
  if (!feature) return;

  const { error } = await admin
    .from('user_settings')
    .update({
      attr_trial_feature: feature,
      attr_trial_from: from || null,
      attr_trial_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .is('attr_trial_at', null);

  if (error) {
    // Attribution is reporting, not billing. It never fails a webhook.
    console.warn('[stripe webhook] upgrade attribution write failed', error);
  }
}

/**
 * Trial bookkeeping + the card-fingerprint abuse check.
 *
 * The fingerprint check can only happen here: the card doesn't exist until
 * checkout completes, so the pre-checkout guards in src/lib/trial.ts can't see
 * it. A card that has already had a free week gets the subscription cancelled
 * with no charge — not an immediate bill, because this also fires on a
 * legitimately shared household card, and a surprise charge there costs more
 * in chargebacks than the sale is worth.
 */
async function handleTrialingSubscription(
  subscription: Stripe.Subscription,
  userId: string,
  tier: string,
) {
  const email = await emailForUser(userId);
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  await recordTrialGrant(admin, {
    userId,
    email,
    stripeCustomerId: customerIdOf(subscription),
    stripeSubscriptionId: subscription.id,
    trialEndsAt,
  });

  const fingerprint = await cardFingerprintFor(subscription);
  if (!fingerprint) return;

  const { duplicate } = await recordTrialCardFingerprint(admin, subscription.id, fingerprint);
  if (!duplicate) return;

  console.warn('[stripe webhook] duplicate trial card, cancelling', subscription.id);

  const stripe = await getStripe();
  await stripe.subscriptions.cancel(subscription.id, { prorate: false });

  if (email) {
    const { subject, html } = trialUnavailableEmail({
      amountLabel: amountLabelForSubscription(subscription, tier),
    });
    await sendEmail({ to: email, subject, html });
  }
}

/**
 * Stripe's card fingerprint is stable for the same physical card across
 * different customers, which is the only cross-account signal available
 * without asking people for ID.
 */
async function cardFingerprintFor(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const stripe = await getStripe();

  let pmId: string | null = null;
  const dpm = subscription.default_payment_method;
  if (dpm) {
    pmId = typeof dpm === 'string' ? dpm : dpm.id;
  } else {
    // Checkout attaches the card to the customer; the subscription may not
    // carry it directly.
    const customer = await stripe.customers.retrieve(customerIdOf(subscription));
    if (!customer.deleted) {
      const def = customer.invoice_settings?.default_payment_method;
      pmId = typeof def === 'string' ? def : def?.id ?? null;
    }
  }

  if (!pmId) return null;

  try {
    const pm = await stripe.paymentMethods.retrieve(pmId);
    return pm.card?.fingerprint ?? null;
  } catch (err) {
    console.error('[stripe webhook] could not read payment method', pmId, err);
    return null;
  }
}

/**
 * Open the 7-day grace window. Idempotent: Stripe retries a failing invoice
 * several times and each attempt fires this event, but the deadline is set
 * from the FIRST failure so retries can't extend it indefinitely.
 */
async function openGraceWindow(subscription: Stripe.Subscription) {
  const userId = await resolveUserId(subscription);
  if (!userId) return;

  const { data: settings } = await admin
    .from('user_settings')
    .select('grace_until, subscription_tier, subscription_amount_cents')
    .eq('user_id', userId)
    .maybeSingle();

  if (settings?.grace_until) return; // window already open

  const graceUntil = new Date(Date.now() + GRACE_DAYS * 86_400_000).toISOString();

  await admin
    .from('user_settings')
    .update({ grace_until: graceUntil })
    .eq('user_id', userId);

  const email = await emailForUser(userId);
  if (email) {
    const { subject, html } = paymentFailedEmail({
      graceUntil,
      amountLabel: amountLabelForStored(
        settings?.subscription_amount_cents,
        settings?.subscription_tier ?? 'pro_annual',
      ),
    });
    await sendEmail({ to: email, subject, html });
  }
}

/**
 * Fires 3 days before a trial converts. Required notice for a card-required
 * trial that auto-charges. See src/lib/email-templates/billing.ts.
 *
 * This is the backstop, not the owner: /api/cron/trial-reminders sweeps for the
 * same accounts every 6 hours, because this event only arrives if it is
 * subscribed on the live webhook endpoint and nothing in the code can make sure
 * of that. Both go through sendTrialReminder, which claims the send, so the
 * customer gets one email no matter how many times either path runs. That also
 * covers Stripe retrying an event it thinks failed.
 */
async function sendTrialEndingNotice(subscription: Stripe.Subscription) {
  const userId = await resolveUserId(subscription);
  if (!userId || !subscription.trial_end) return;

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  await sendTrialReminder(admin, {
    userId,
    trialEndsAt: new Date(subscription.trial_end * 1000).toISOString(),
    amountLabel: amountLabelForSubscription(subscription, tierFromPriceId(priceId)),
  });
}

/**
 * The subscription an invoice belongs to.
 *
 * Stripe MOVED this field. It used to be `invoice.subscription`; it now lives
 * at `invoice.parent.subscription_details.subscription`, and the top-level one
 * is gone from the payload at the API version this integration pins
 * (2026-04-22.dahlia — see src/lib/stripe.ts, and the webhook destination is
 * pinned to the same). `Stripe.Invoice` in the installed SDK has no
 * `subscription` property at all; the two call sites below were casting it back
 * on with an intersection type, which compiled fine and read `undefined` at
 * runtime, so both invoice handlers silently did nothing.
 *
 * Reads the new location first and falls back to the legacy one, so this is
 * correct whether or not the destination's API version is ever rolled back.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const current = invoice.parent?.subscription_details?.subscription;
  if (current) return typeof current === 'string' ? current : current.id;

  const legacy = (invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription;
  }).subscription;
  if (legacy) return typeof legacy === 'string' ? legacy : legacy.id;

  return null;
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'webhook_secret_not_configured' },
      { status: 500 },
    );
  }

  const sig = request.headers.get('stripe-signature') ?? '';
  const rawBody = await request.text();
  const stripe = await getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid signature';
    return NextResponse.json({ error: `webhook_signature: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscriptionToUser(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscriptionToUser(sub);
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        await sendTrialEndingNotice(sub);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = subscriptionIdFromInvoice(invoice);
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscriptionToUser(sub);
          await openGraceWindow(sub);
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = subscriptionIdFromInvoice(invoice);
        if (subId) {
          // applySubscriptionToUser clears grace_until once the status is no
          // longer a payment problem.
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscriptionToUser(sub);

          // The actualized paid conversion.
          //
          // Guarded on amount_paid: Stripe raises a $0 invoice when a trial
          // begins, and that invoice succeeds. Without this check every trial
          // would report a purchase on day zero, which is both wrong and
          // exactly the number an ad network would then optimise towards.
          //
          // Renewals reach here too and are supposed to. The unique constraint
          // in marketing_conversions makes the second one a no-op, because a
          // renewal is retention rather than a new customer, and uploading it
          // would tell Google the same ad bought the same person twice.
          if ((invoice.amount_paid ?? 0) > 0) {
            await recordConversion(admin, {
              event: 'purchase',
              subscription: sub,
              userId: await resolveUserId(sub),
              valueCents: invoice.amount_paid ?? 0,
              currency: invoice.currency ?? 'cad',
              occurredAt: new Date((invoice.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
              invoiceId: invoice.id ?? null,
            });
          }
        }
        break;
      }
      default:
        // Ignore other events.
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] handler error', event.type, err);
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 });
  }

  // Report the conversion onward while we are here, so the ad network learns
  // about it in seconds rather than at the top of the next hour.
  //
  // Awaited, not fired and forgotten: this runs in a serverless function that
  // stops executing the moment a response is returned, so a dangling promise
  // would be killed mid-flight and the upload silently lost. Small limit to
  // keep it well inside Stripe's timeout.
  //
  // Outside the try above and swallowed on its own, because reporting must
  // never fail a webhook: a 500 here would have Stripe retry a subscription
  // write that already succeeded.
  try {
    await uploadPendingConversions(admin, 5);
  } catch (err) {
    console.warn('[stripe webhook] conversion upload failed', err);
  }

  return NextResponse.json({ received: true });
}
