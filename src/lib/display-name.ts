// Display-name resolution — NEVER derived from the email address.
//
// Order (see the dashboard build brief):
//   1. profile first name (stored in Supabase auth user_metadata)
//   2. Stripe cardholder name, first token
//   3. literal fallback "Angler"
//
// Step 2 used to be a server round-trip that retrieved the Stripe customer.
// The cardholder name is now mirrored onto user_settings.bill_name by the
// Stripe webhook (src/lib/billing-profile.ts), so a caller that already holds
// the row can finish the whole order here, synchronously, with no Stripe call.
//
// The two names are NOT treated alike. A first name typed into our signup form
// is what somebody wants to be called, and it is used exactly as given. A
// cardholder name is evidence we are borrowing: the person never offered it as
// a display name, so it is checked before it is used. See
// cardholderFirstName.

import type { User } from "@supabase/supabase-js";

export const NAME_FALLBACK = "Angler";

/** First token of a name string ("Casey Bolton" → "Casey"), or null. */
function firstToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim().split(/\s+/)[0];
  return token ? token : null;
}

/**
 * The angler's stored first name from auth metadata, or null if never set.
 * Checks `first_name` first, then the OAuth-provided `given_name` / `name` /
 * `full_name` (first token) so social sign-ups get a name without extra setup.
 */
export function storedFirstName(user: User | null | undefined): string | null {
  const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return (
    firstToken(m.first_name) ??
    firstToken(m.given_name) ??
    firstToken(m.name) ??
    firstToken(m.full_name)
  );
}

/**
 * Display first name with the literal fallback. Use for immediate render;
 * when this returns the fallback and the user is paid, the caller may upgrade
 * it by passing the mirrored cardholder name to greetingFirstName.
 */
export function resolveFirstName(user: User | null | undefined): string {
  return storedFirstName(user) ?? NAME_FALLBACK;
}

/**
 * How long a first name can plausibly be. Past this it is a paste, a company
 * name, or somebody filling the field in.
 */
const MAX_NAME_LENGTH = 24;

/**
 * A cardholder name, reduced to something we can greet a person by, or null.
 *
 * Held to a standard the stored first name is not, because nobody chose it as
 * a display name. It was typed into a payment form, where the field is
 * routinely filled with an email address, a company, or the whole name in
 * capitals as it is printed on the card. Greeting somebody as "Hi NICK," or
 * "Hi nick@gmail.com," is worse than not greeting them at all, which is what a
 * null here produces.
 *
 * Deliberately does NOT try to fix a name, only to refuse one it cannot read.
 * The single exception is capitals, because a card is printed that way and the
 * person is not shouting.
 */
export function cardholderFirstName(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;

  // Judged on the WHOLE field, before the first token is taken. An email
  // address or an order reference means the field does not hold a name at all,
  // and "Order 44821" would otherwise pass its first token through as "Order".
  if (/[@\d]/.test(raw)) return null;

  const token = firstToken(raw);
  if (!token || token.length > MAX_NAME_LENGTH) return null;

  // "NICK" is how the card is printed, not how they talk.
  const shouted = token.length > 1 && token === token.toUpperCase();
  return shouted ? token.charAt(0) + token.slice(1).toLowerCase() : token;
}

/**
 * The name to greet this person by, or null when we hold none.
 *
 * No "Angler" fallback on purpose: a greeting is optional and an email that
 * opens "Hi Angler," reads worse than one that opens with its heading. Callers
 * that need a name for a UI slot add the fallback themselves.
 */
export function greetingFirstName(
  user: User | null | undefined,
  cardholderName?: string | null,
): string | null {
  return storedFirstName(user) ?? cardholderFirstName(cardholderName);
}
