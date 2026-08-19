-- Day 4 of the 7-day Pro trial: the reminder send, and the stamp that keeps
-- it to exactly one.
--
-- Two things can decide to send this email: the daily cron at
-- /api/cron/trial-reminders, and Stripe's customer.subscription.trial_will_end
-- webhook. Both claim the send with a conditional UPDATE on this column, so
-- whichever runs first wins and the customer is emailed once. Stripe also
-- retries a webhook it thinks failed, which without the stamp would send a
-- second copy of a legally required billing notice. That is a support ticket
-- every time.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz;

COMMENT ON COLUMN user_settings.trial_reminder_sent_at IS
  'When the day-4 trial reminder was sent. Claimed with a conditional UPDATE by both the cron and the Stripe webhook so exactly one send happens. Reset to NULL if the send itself fails, so the next run retries.';

-- The cron scans for trials ending inside the next 3 days that have not been
-- reminded yet. Partial, because a reminded or non-trialing row is never a
-- candidate again and there is no reason to carry it in the index.
CREATE INDEX IF NOT EXISTS user_settings_trial_reminder_due_idx
  ON user_settings (trial_ends_at)
  WHERE subscription_status = 'trialing' AND trial_reminder_sent_at IS NULL;
