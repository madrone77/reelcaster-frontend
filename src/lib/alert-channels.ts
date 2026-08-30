/**
 * Which channel carries which beat of a score alert.
 *
 * Pulled out of the send loop because this is a rule about whether a paying
 * angler hears anything at all, and it is worth being able to test it without
 * standing up Twilio, Supabase and a forecast.
 */

import type { AlertBeat } from '@/lib/custom-alert-engine';

/**
 * Does SMS carry this beat, for someone who picked these channels?
 *
 * Normally no for a heads-up: it is a planning message up to six days out,
 * planning happens at a desk, and three texts about one fishing day is how an
 * alert gets muted. The heads-up goes by email and the phone stays quiet until
 * the day is real.
 *
 * That rule assumed an email address was always in the mix. For someone who
 * asked for texts and nothing else it had no fallback, so the heads-up was
 * dropped on the floor: recorded as "No channel delivered", never retried, and
 * the angler heard about a good day only on the morning before it, never early
 * enough to book the day off. Being told late is the thing the lead time exists
 * to prevent, so when SMS is all they picked, SMS carries everything.
 */
export function smsCarriesBeat(beat: AlertBeat, channels: string[]): boolean {
  if (!channels.includes('sms')) return false;
  if (beat === 'confirm' || beat === 'stand_down') return true;
  return !channels.includes('email');
}
