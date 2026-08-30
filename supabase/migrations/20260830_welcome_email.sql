-- The getting-started email, and the claim that stops it going twice.
--
-- Two triggers can decide an account is owed a welcome: the Stripe webhook
-- when a trial opens, and /api/attribution/signup when a free account first
-- becomes authenticated. Both fire more than once in normal operation (Stripe
-- redelivers, and the attribution call runs on every first-auth in a browser),
-- so the send is claimed with a conditional UPDATE on welcome_email_sent_at
-- exactly the way the day-4 trial reminder claims trial_reminder_sent_at.
--
-- welcome_email_variant records WHICH email went out, and it is load-bearing
-- rather than decoration: someone who signed up free and later starts a trial
-- is owed the trial version, because it carries a different feature set and a
-- charge date. The claim therefore matches "never sent" OR "sent, but the free
-- one". A trial send closes both doors and nothing sends again.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_email_variant text;

COMMENT ON COLUMN public.user_settings.welcome_email_sent_at IS
  'When the getting-started email was sent. Claim column: written by a conditional UPDATE so two triggers cannot both send.';

COMMENT ON COLUMN public.user_settings.welcome_email_variant IS
  'Which getting-started email went out: free or trial. A free send can still be upgraded to a trial send; a trial send is final.';

-- Only two values are ever written, and a typo in either caller would silently
-- create a third that the upgrade path would then never match.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_welcome_email_variant_check'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_welcome_email_variant_check
      CHECK (welcome_email_variant IS NULL OR welcome_email_variant IN ('free', 'trial'));
  END IF;
END $$;

-- Nobody who already has an account is owed a welcome. Without this backfill
-- the first deploy would mail the whole base a "here is what you can do now"
-- note: the free branch fires on any first-auth in a new browser, so it would
-- reach people who have been using the product for months.
--
-- The variant is not uniform, and the difference matters.
--
-- An account already TRIALING or PAID is stamped 'trial', which closes both
-- doors and can never send anything. Stamping those 'free' would leave them
-- matching the free-to-trial upgrade clause above, and a subscription.updated
-- arriving while they are still trialing (the payment-method stamp mutates
-- subscription metadata, which raises one) would greet somebody four days into
-- their trial with "Pro is on for the next 7 days" and a charge date they can
-- already see coming. There are 7 such accounts on the day this is written.
--
-- Everyone else is stamped 'free'. That reads as a small lie, since they never
-- got that email, and it buys the right behaviour: an existing free member who
-- starts a trial later still gets the trial version, which is the one carrying
-- the Pro feature set and their charge date.
UPDATE public.user_settings
SET welcome_email_sent_at = now(),
    welcome_email_variant = CASE
      WHEN subscription_status IN ('trialing', 'active', 'past_due', 'unpaid')
        OR coalesce(subscription_tier, 'free') <> 'free'
      THEN 'trial'
      ELSE 'free'
    END
WHERE welcome_email_sent_at IS NULL;
