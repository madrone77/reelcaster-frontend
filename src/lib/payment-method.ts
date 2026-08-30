import type Stripe from 'stripe';

/**
 * How a subscription was actually paid for, recorded at the moment of
 * purchase.
 *
 * Stripe knows how someone is paying RIGHT NOW: the admin revenue page reads
 * `subscription.default_payment_method` live to draw its payment-method mix.
 * What Stripe does not keep is how they paid ORIGINALLY. Swap the card on file
 * and an Apple Pay purchase silently becomes a card purchase, retroactively,
 * in every report. So the answer is written into subscription metadata once,
 * when it is still true, and never rewritten.
 *
 * The vocabulary matches the keys BlueCaster's revenue rollup already uses, so
 * a stamped value and a live-read value name the same cohort.
 */

/** Subscription metadata key holding the original payment method. */
export const PAY_METHOD_KEY = 'pay_method';

/**
 * Stripe's name for how this payment method pays.
 *
 * A tokenized wallet is still a card to Stripe: `type` reads "card" whether it
 * was typed in or tapped through Apple Pay, and the only thing separating them
 * is `card.wallet.type`. Reading the type alone records every wallet purchase
 * as a plain card, which is the entire distinction this stamp exists to keep.
 *
 * Returns null for a payment method that names nothing useful, so callers can
 * leave the stamp off rather than write "card" over a real answer they simply
 * failed to read.
 */
export function paymentMethodKey(
  method: Stripe.PaymentMethod | null | undefined,
): string | null {
  if (!method) return null;

  if (method.type === 'card') {
    return method.card?.wallet?.type ?? 'card';
  }

  return method.type ?? null;
}

/** The id out of an expandable field, whichever form it arrived in. */
export function paymentMethodIdOf(
  method: string | Stripe.PaymentMethod | null | undefined,
): string | null {
  if (!method) return null;
  return typeof method === 'string' ? method : (method.id ?? null);
}

/**
 * The payment method a subscription bills against, as a key.
 *
 * Webhook payloads are never expanded, so `default_payment_method` arrives as
 * a bare id and has to be fetched. A subscription with none of its own bills
 * off the customer's default instead, which is the shape a hosted Checkout can
 * leave behind, so that is the second place to look.
 *
 * Best-effort throughout: every failure returns null and the caller leaves the
 * subscription unstamped, to be picked up by the next event that carries one.
 * A missing stamp is recoverable; a wrong one is forever.
 */
export async function resolvePaymentMethodKey(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const direct = subscription.default_payment_method;
  if (direct && typeof direct !== 'string') return paymentMethodKey(direct);

  try {
    if (typeof direct === 'string') {
      return paymentMethodKey(await stripe.paymentMethods.retrieve(direct));
    }

    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : (subscription.customer?.id ?? null);
    if (!customerId) return null;

    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    if (customer.deleted) return null;

    const fallback = customer.invoice_settings?.default_payment_method;
    return fallback && typeof fallback !== 'string'
      ? paymentMethodKey(fallback)
      : null;
  } catch (err) {
    console.warn('[pay-method] could not resolve payment method', err);
    return null;
  }
}
