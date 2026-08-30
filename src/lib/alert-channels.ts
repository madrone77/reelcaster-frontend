/**
 * Which channel carries a score-alert digest.
 *
 * Pulled out of the send loop because this is a rule about whether a paying
 * angler hears anything at all, and it is worth being able to test it without
 * standing up Twilio, Supabase and a forecast.
 */

import type { AlertBeat } from '@/lib/custom-alert-engine';

/**
 * Does SMS carry a digest whose items are these beats?
 *
 * A text is for a day you can still act on. A heads-up can be six days out,
 * planning that far ahead happens at a desk, and a text about next Saturday is
 * how an alert gets muted. So SMS carries a digest that contains at least one
 * confirm, and stays quiet for a digest that is heads-ups only.
 *
 * The exception is someone who asked for texts and nothing else. That rule
 * assumed an email address was always in the mix; without one it had no
 * fallback, so the heads-up was dropped on the floor, recorded as "No channel
 * delivered", and the angler heard about a good day only on the morning before
 * it. Being told late is the thing lead time exists to prevent, so when SMS is
 * all they picked, SMS carries everything.
 *
 * Takes the digest's beats rather than one beat, because the unit of sending is
 * now a person's whole day, not a single alert.
 */
export function smsCarriesDigest(beats: AlertBeat[], channels: string[]): boolean {
  if (!channels.includes('sms')) return false;
  if (!channels.includes('email')) return true;
  return beats.includes('confirm');
}
