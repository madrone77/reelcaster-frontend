// Display-name resolution — NEVER derived from the email address.
//
// Order (see the dashboard build brief):
//   1. profile first name (stored in Supabase auth user_metadata)
//   2. Stripe customer name, first token — resolved server-side via
//      /api/profile/display-name for existing paid users (not handled here)
//   3. literal fallback "Angler"
//
// This module owns steps 1 and 3 (client-side, synchronous). The Stripe
// fallback is a server round-trip the caller does only when this returns the
// fallback and the user is paid.

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
 * it via the Stripe-name server route.
 */
export function resolveFirstName(user: User | null | undefined): string {
  return storedFirstName(user) ?? NAME_FALLBACK;
}
