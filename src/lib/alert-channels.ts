/**
 * Which channel carries a score-alert digest.
 *
 * Pulled out of the send loop because this is a rule about whether a paying
 * angler hears anything at all, and it is worth being able to test it without
 * standing up Twilio, Supabase and a forecast.
 */

import type { AlertBeat } from '@/lib/custom-alert-engine';

/** The part of a digest item this decision reads. */
export interface DigestItemChannels {
  beat: AlertBeat;
  /** The delivery channels this item's own alert asked for. */
  channels: string[];
}

/**
 * Does a text go out for this digest, and if so about which items?
 *
 * A text is for a day you can still act on. A heads-up can be six days out,
 * planning that far ahead happens at a desk, and a text about next Saturday is
 * how an alert gets muted. So SMS carries a digest holding at least one
 * confirm, and stays quiet for one that is heads-ups only.
 *
 * The exception is an alert that asked for texts and nothing else. The rule
 * used to assume an email address was always in the mix; without one it had no
 * fallback, so the heads-up was dropped on the floor, recorded as "No channel
 * delivered", and the angler heard about a good day only on the morning before
 * it. Being told late is the thing lead time exists to prevent.
 *
 * ⚠️ Judged per item, not on the union of the user's channels. A digest pools
 * several alerts, and a user with one email alert and one SMS-only alert has
 * "email" in that union: reading the exception off the union would decide they
 * can be reached by email, while the email is built only from the alerts that
 * asked for email and would never mention the SMS-only spot. That item falls
 * through both channels and is lost, which is exactly the failure this
 * exception was added to prevent.
 */
export function smsCarriesDigest(items: DigestItemChannels[]): boolean {
  const smsItems = items.filter((i) => i.channels.includes('sms'));
  if (smsItems.length === 0) return false;
  if (smsItems.some((i) => i.beat === 'confirm')) return true;
  // Nothing else can carry these, so the text does.
  return smsItems.some((i) => !i.channels.includes('email'));
}
