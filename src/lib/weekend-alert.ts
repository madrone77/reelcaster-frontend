// Weekend Bite Alert — the shared shape between the capture route, the
// confirmation route and the Thursday digest.
//
// These subscribers are NOT users. Somebody who lands on a city page from an
// ad and hands over an address has no auth.users row and may never get one,
// so nothing here can lean on a session, an entitlement, or RLS. Every access
// path is the service role inside a route that does its own validation.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

export const WEEKEND_ALERT_TABLE = "weekend_alert_subscribers";

/** Days a confirmed subscriber is left alone after a send. Guards against a
 *  cron that fires more than once inside its own hour. */
export const RESEND_COOLDOWN_DAYS = 3;

export function alertAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** 32 hex characters. Long enough that a confirmation link is not guessable,
 *  which matters because following one is what makes the opt-in binding. */
export function token(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Deliberately loose. This is a marketing capture field, and a regex strict
 * enough to be interesting rejects real addresses; the confirmation email is
 * the real validator, because an address that cannot receive one never
 * becomes a subscriber.
 */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Digits, optionally with a leading +, 10 to 15 of them. */
export function normalizePhone(value: string): string | null {
  const trimmed = value.replace(/[\s()\-.]/g, "");
  if (/^\+[1-9]\d{9,14}$/.test(trimmed)) return trimmed;
  // A bare 10-digit number on a page serving BC and Washington is North
  // American. Assuming +1 anywhere else would be wrong, but no other country
  // is served by these pages today.
  if (/^\d{10}$/.test(trimmed)) return `+1${trimmed}`;
  if (/^1\d{10}$/.test(trimmed)) return `+${trimmed}`;
  return null;
}

export type Channel = "email" | "sms";

/** What the single field turned out to be. */
export function classify(
  raw: string,
): { channel: Channel; email?: string; phone?: string } | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes("@")) {
    return isEmail(value) ? { channel: "email", email: value.toLowerCase() } : null;
  }
  const phone = normalizePhone(value);
  return phone ? { channel: "sms", phone } : null;
}
