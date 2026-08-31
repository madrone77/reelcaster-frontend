/**
 * The getting-started email: one send per account, whoever asks for it.
 *
 * Two independent triggers want to send it, for the same reason the day-4
 * reminder has two: they fail in different ways.
 *
 *   1. The Stripe webhook, when a subscription first reports `trialing`.
 *   2. /api/attribution/signup, when a brand new free account first becomes
 *      authenticated in a browser.
 *
 * Neither covers the other. The webhook never fires for a free signup, and the
 * attribution call only fires when somebody actually opens the app, which a
 * buy-first purchaser may not do for hours. Both fire repeatedly in normal
 * operation, so exactly one email comes out of them the same way it does for
 * the reminder: a conditional UPDATE that the first caller wins.
 *
 * The one wrinkle is that the claim is not simply "sent or not". Somebody can
 * sign up free, read the free note, and start a trial a week later, and the
 * trial version carries a different feature set and a charge date. So a free
 * send can still be upgraded to a trial send, and a trial send is final. See
 * the migration for the column pair that encodes that.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { welcomeEmail, type WelcomeVariant } from '@/lib/email-templates/welcome';
import { SUPPORT_EMAIL } from '@/lib/site';

export type WelcomeEmailOutcome =
  | 'sent'
  | 'already_sent'
  | 'no_email'
  | 'send_failed';

/**
 * Take the send, or find out somebody else already has.
 *
 * One statement, so two concurrent callers cannot both come away thinking they
 * won. A trial claim also matches a row already stamped with the free variant,
 * which is what lets a free signup who later starts a trial get the trial
 * note; the write then sets the variant to 'trial' and closes both doors.
 */
async function claimWelcome(
  admin: SupabaseClient,
  userId: string,
  variant: WelcomeVariant,
): Promise<boolean> {
  // user_settings rows are created lazily (the Stripe webhook, the attribution
  // write, the first alert), so an account minutes old often has none, and this
  // is exactly the account being welcomed. An UPDATE against a missing row
  // matches nothing and the email is never sent. ignoreDuplicates so this can
  // never blank a column another writer already filled in.
  const { error: ensureError } = await admin
    .from('user_settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });

  if (ensureError) {
    console.error('[welcome email] could not ensure user_settings row', userId, ensureError);
    return false;
  }

  const query = admin
    .from('user_settings')
    .update({
      welcome_email_sent_at: new Date().toISOString(),
      welcome_email_variant: variant,
    })
    .eq('user_id', userId);

  const claimed =
    variant === 'trial'
      ? query.or('welcome_email_sent_at.is.null,welcome_email_variant.eq.free')
      : query.is('welcome_email_sent_at', null);

  const { data, error } = await claimed.select('user_id');

  if (error) {
    console.error('[welcome email] claim failed', userId, error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/** Put the send back on the table after a failure, so a later trigger retries. */
async function releaseWelcome(admin: SupabaseClient, userId: string) {
  const { error } = await admin
    .from('user_settings')
    .update({ welcome_email_sent_at: null, welcome_email_variant: null })
    .eq('user_id', userId);

  if (error) {
    // Worth shouting about: a stuck claim means this account is never welcomed
    // and nothing will ever notice.
    console.error('[welcome email] could not release claim', userId, error);
  }
}

async function emailForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    console.error('[welcome email] could not read user', userId, error);
    return null;
  }
  return data.user?.email ?? null;
}

/**
 * Welcome one account. Safe to call from anywhere, any number of times.
 *
 * Never throws. Both callers are doing something more important than this when
 * they reach it: the webhook is granting entitlement and owes Stripe a 200, and
 * the attribution route is recording a conversion. Losing either of those over
 * a marketing email would be a bad trade, so every failure here is a log line
 * and a return value.
 */
export async function sendWelcomeEmail(
  admin: SupabaseClient,
  params: {
    userId: string;
    variant: WelcomeVariant;
    /** Trial variant only. Omitted and the charge block is left out. */
    trialEndsAt?: string | null;
    /** Trial variant only, e.g. "$33". */
    amountLabel?: string | null;
  },
): Promise<WelcomeEmailOutcome> {
  try {
    if (!(await claimWelcome(admin, params.userId, params.variant))) {
      return 'already_sent';
    }

    const email = await emailForUser(admin, params.userId);
    if (!email) {
      // Nothing to retry against, and holding the claim stops every later
      // trigger re-doing this lookup for an account with no address.
      return 'no_email';
    }

    const { subject, html } = welcomeEmail({
      variant: params.variant,
      trialEndsAt: params.trialEndsAt,
      amountLabel: params.amountLabel,
    });

    // The copy says "reply to this email and a person reads it", and the From
    // is noreply@. Without this that sentence is untrue.
    const result = await sendEmail({ to: email, subject, html, replyTo: SUPPORT_EMAIL });

    if (!result.success) {
      console.error('[welcome email] send failed', params.userId, result.error);
      await releaseWelcome(admin, params.userId);
      return 'send_failed';
    }

    return 'sent';
  } catch (err) {
    console.error('[welcome email] unexpected failure', params.userId, err);
    return 'send_failed';
  }
}
